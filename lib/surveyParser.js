// lib/surveyParser.js
// Core parser: converts plain text survey response → Typeform webhook JSON

/**
 * Main entry point
 */
function parseResponse(plainText, formDefinition, options = {}) {
  const fieldLookup = buildFieldLookup(formDefinition);
  const segments = segmentPlainText(plainText, fieldLookup);

  const { answers, definitions, warnings } = matchAndFormat(
    segments,
    fieldLookup,
    formDefinition
  );

  if (warnings.length > 0) {
    console.log("⚠️  Parser warnings:");
    warnings.forEach((warning) => console.log(`  - ${warning}`));
  }

  return assembleWebhook(answers, definitions, formDefinition, options);
}

// ─────────────────────────────────────────────────────────────
// STEP 1: Build field lookup from form definition
// ─────────────────────────────────────────────────────────────

function cleanTitle(title) {
  if (!title) return "";

  return title
    .replace(/[_*]/g, "")
    .replace(/\n/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildFieldLookup(formDef) {
  const fields = [];

  (formDef.fields || []).forEach((field, index) => {
    if (field.type === "statement") return;

    const entry = {
      id: field.id,
      ref: field.ref,
      title: field.title,
      cleanTitle: cleanTitle(field.title),
      type: field.type,
      index,
      choices: [],
      subFields: [],
      allowMultiple: false,
      allowOther: false,
    };

    if (field.properties && field.properties.choices) {
      entry.choices = field.properties.choices.map((choice) => ({
        id: choice.id,
        ref: choice.ref,
        label: choice.label,
        cleanLabel: cleanTitle(choice.label),
      }));

      entry.allowMultiple =
        field.properties.allow_multiple_selection || false;
      entry.allowOther = field.properties.allow_other_choice || false;
    }

    if (
      field.type === "matrix" &&
      field.properties &&
      field.properties.fields
    ) {
      entry.subFields = field.properties.fields.map((subField) => ({
        id: subField.id,
        ref: subField.ref,
        title: subField.title,
        cleanTitle: cleanTitle(subField.title),
        type: subField.type,
        choices:
          subField.properties && subField.properties.choices
            ? subField.properties.choices.map((choice) => ({
                id: choice.id,
                ref: choice.ref,
                label: choice.label,
                cleanLabel: cleanTitle(choice.label),
              }))
            : [],
      }));
    }

    if (field.type === "opinion_scale" && field.properties) {
      entry.steps = field.properties.steps;
      entry.startAtOne = field.properties.start_at_one;
      entry.labels = field.properties.labels;
    }

    fields.push(entry);
  });

  return fields;
}

// ─────────────────────────────────────────────────────────────
// STEP 2: Segment plain text into question-answer pairs
// ─────────────────────────────────────────────────────────────

function buildSearchVariants(title) {
  if (!title) return [];

  const titleLower = title.toLowerCase();

  const variants = [
    titleLower,
    titleLower.substring(0, 80),
    titleLower.substring(0, 60),
    titleLower.substring(0, 40),
    titleLower.substring(0, 25),
  ];

  return [...new Set(variants)].filter((variant) => variant.length >= 10);
}

function buildAnchors(fieldLookup) {
  const titleCounts = new Map();

  return fieldLookup
    .map((field) => {
      const title = field.cleanTitle || cleanTitle(field.title);
      const searches = buildSearchVariants(title);

      const primarySearch = searches[0] || title.toLowerCase();
      const occurrence = titleCounts.get(primarySearch) || 0;

      titleCounts.set(primarySearch, occurrence + 1);

      return {
        field,
        title,
        searches,
        occurrence,
      };
    })
    .filter((anchor) => anchor.title && anchor.searches.length > 0);
}

// ─────────────────────────────────────────────────────────────
// HARDCODED ANCHORS for fields that the generic segmenter
// can't reliably find. These use unique substrings from the
// plain text that only appear once for each question.
// ─────────────────────────────────────────────────────────────

const ANCHOR_OVERRIDES = {
  // Travel questions — all share "Where have you traveled in" prefix.
  // Use the continent name as the unique anchor.
  acJ9V5yo65xF: "where have you traveled in europe",
  "08Ma6ZcRdeZH": "where have you traveled in asia",
  RhjlLeCbiQk8: "where have you traveled in africa",
  offbI97Ont1O: "where have you traveled in north america",
  PQrPzH66lwmT: "where have you traveled in south america",
  S8t2fgFcSU2M: "where have you traveled in oceania",

  // College questions — current vs graduated have similar titles
  XIku4coCODbd: "which college/university did you attend",
  "3WVbR8WwA8N7": "which college/university are you attending",

  // Major — two versions, current student vs graduated
  G4W8BkalCLE6: "what did you major in",
  "5haYxPNDlyyN": "what are you majoring in",

  // Identity question
  yyIGNCOmmTUX: "do you identify with an ethnic",

  // Friends/family abroad
  EREFtxY4MIId: "do you have friends or family abroad",

  // Language overflow
  s4xOmObgOe6A: "if your language is not on the list",

  // Where did you grow up
  sNZgZtvBL0rv: "where did you grow up",

  // Field of work
  sO3gxchC47CO: "what is your field of work",

  // Work travel location
  "0mtOzFzz9bsJ": "where do you usually travel for work",

  // Where live now
  MKfvKAOwxr3E: "where do you live now",
};

function segmentPlainText(plainText, fieldLookup) {
  if (!plainText || typeof plainText !== "string") return [];

  const textLower = plainText.toLowerCase();
  const anchors = buildAnchors(fieldLookup);

  // PHASE 1: Find the start position of each question
  const found = [];

  anchors.forEach((anchor) => {
    const fieldId = anchor.field.id;
    let matchIdx = -1;

    // Check for hardcoded anchor override first
    if (ANCHOR_OVERRIDES[fieldId]) {
      const overrideStr = ANCHOR_OVERRIDES[fieldId].toLowerCase();

      const occurrences = [];
      let searchFrom = 0;

      while (searchFrom < textLower.length) {
        const idx = textLower.indexOf(overrideStr, searchFrom);
        if (idx === -1) break;

        occurrences.push(idx);
        searchFrom = idx + 1;
      }

      if (occurrences.length > 0) {
        for (const occurrence of occurrences) {
          const tooClose = found.some(
            (fieldMatch) => Math.abs(fieldMatch.startIdx - occurrence) < 20
          );

          if (!tooClose) {
            matchIdx = occurrence;
            break;
          }
        }
      }
    }

    // If override didn't find it, fall back to generic search
    if (matchIdx === -1) {
      for (const searchStr of anchor.searches) {
        const occurrences = [];
        let searchFrom = 0;

        while (searchFrom < textLower.length) {
          const idx = textLower.indexOf(searchStr, searchFrom);
          if (idx === -1) break;

          occurrences.push(idx);
          searchFrom = idx + 1;
        }

        if (occurrences.length === 0) continue;

        if (anchor.occurrence < occurrences.length) {
          const candidate = occurrences[anchor.occurrence];

          const tooClose = found.some(
            (fieldMatch) => Math.abs(fieldMatch.startIdx - candidate) < 20
          );

          if (!tooClose) {
            matchIdx = candidate;
            break;
          }
        }

        // Try any unclaimed occurrence
        for (const occurrence of occurrences) {
          const tooClose = found.some(
            (fieldMatch) => Math.abs(fieldMatch.startIdx - occurrence) < 20
          );

          if (!tooClose) {
            matchIdx = occurrence;
            break;
          }
        }

        if (matchIdx !== -1) break;
      }
    }

    if (matchIdx !== -1) {
      const tooClose = found.some(
        (fieldMatch) => Math.abs(fieldMatch.startIdx - matchIdx) < 20
      );

      if (!tooClose) {
        found.push({
          field: anchor.field,
          startIdx: matchIdx,
        });
      }
    }
  });

  found.sort((a, b) => a.startIdx - b.startIdx);

  // Remove fields whose questions do not actually appear in the text.
  // This prevents continent-specific travel questions from stealing
  // answers from neighboring travel questions.
  const TRAVEL_CONTINENT_CHECK = {
    RhjlLeCbiQk8: "africa",
    PQrPzH66lwmT: "south america",
    S8t2fgFcSU2M: "oceania",
  };

  const filtered = found.filter((fieldMatch) => {
    const continentKeyword = TRAVEL_CONTINENT_CHECK[fieldMatch.field.id];

    if (!continentKeyword) return true;

    const nearby = textLower.substring(
      fieldMatch.startIdx,
      fieldMatch.startIdx + 80
    );

    return nearby.includes(continentKeyword);
  });

  // PHASE 2: Extract raw blocks and strip question text to get answers
  const segments = [];

  for (let i = 0; i < filtered.length; i++) {
    const current = filtered[i];

    const nextStart =
      i + 1 < filtered.length
        ? filtered[i + 1].startIdx
        : plainText.length;

    const rawBlock = plainText.substring(current.startIdx, nextStart);
    const answerText = extractAnswer(rawBlock, current.field);

    if (answerText && answerText.length > 0) {
      segments.push({
        field: current.field,
        questionText: rawBlock.substring(
          0,
          rawBlock.length - answerText.length
        ),
        answerText,
      });
    }
  }

  return segments;
}

/**
 * Find where the question text ends in the raw block.
 * Uses character-level scanning instead of word matching
 * to avoid consuming characters from the answer.
 */
function findQuestionEnd(rawBlock, field) {
  const cleanFieldTitle = field.cleanTitle;
  if (!cleanFieldTitle) return 0;

  const cleanFieldTitleLower = cleanFieldTitle.toLowerCase();
  const rawNoMd = rawBlock.replace(/[_*]/g, "");
  const rawLower = rawNoMd.toLowerCase();

  // Strategy 1: Direct substring search for the clean title
  const directIdx = rawLower.indexOf(cleanFieldTitleLower);

  if (directIdx !== -1) {
    let endPos = directIdx + cleanFieldTitleLower.length;

    while (endPos < rawNoMd.length) {
      const ch = rawNoMd[endPos];

      if (
        ch === " " ||
        ch === "\n" ||
        ch === "?" ||
        ch === ":" ||
        ch === "."
      ) {
        endPos++;
      } else {
        break;
      }
    }

    return mapToOriginal(rawBlock, endPos);
  }

  // Strategy 2: Try progressively shorter prefixes
  const prefixLengths = [
    Math.floor(cleanFieldTitleLower.length * 0.9),
    Math.floor(cleanFieldTitleLower.length * 0.75),
    Math.floor(cleanFieldTitleLower.length * 0.6),
    40,
    25,
  ];

  for (const len of prefixLengths) {
    if (len < 15 || len > cleanFieldTitleLower.length) continue;

    const prefix = cleanFieldTitleLower.substring(0, len);
    const idx = rawLower.indexOf(prefix);

    if (idx !== -1) {
      let endPos = idx + prefix.length;
      let titlePos = len;

      while (
        endPos < rawLower.length &&
        titlePos < cleanFieldTitleLower.length
      ) {
        if (rawLower[endPos] === cleanFieldTitleLower[titlePos]) {
          endPos++;
          titlePos++;
        } else if (
          rawLower[endPos] === " " ||
          rawLower[endPos] === "\n" ||
          rawLower[endPos] === "_" ||
          rawLower[endPos] === "*"
        ) {
          endPos++;
        } else if (cleanFieldTitleLower[titlePos] === " ") {
          titlePos++;
        } else {
          break;
        }
      }

      while (endPos < rawNoMd.length) {
        const ch = rawNoMd[endPos];

        if (ch === " " || ch === "\n" || ch === "?" || ch === ":") {
          endPos++;
        } else {
          break;
        }
      }

      return mapToOriginal(rawBlock, endPos);
    }
  }

  // Strategy 3: fallback
  return Math.min(20, rawBlock.length);
}

/**
 * Map a position in markdown-stripped text back to original text.
 * Accounts for _* characters that were removed.
 */
function mapToOriginal(original, strippedPos) {
  let originalIndex = 0;
  let strippedIndex = 0;

  while (originalIndex < original.length && strippedIndex < strippedPos) {
    const ch = original[originalIndex];

    if (ch === "_" || ch === "*") {
      originalIndex++;
    } else {
      originalIndex++;
      strippedIndex++;
    }
  }

  return originalIndex;
}

function extractAnswer(rawBlock, field) {
  let answerText = rawBlock.substring(findQuestionEnd(rawBlock, field)).trim();

  answerText = stripForExampleBlock(answerText).trim();

  if (field.type === "opinion_scale") {
    answerText = stripScaleLabels(answerText);

    const numPattern = answerText.match(
      /(\d+(?:\.\d+)?\s*\/\s*\d+|\d+(?:\.\d+)?)/
    );

    if (numPattern) {
      return answerText.substring(numPattern.index).trim();
    }
  }

  if (field.type === "short_text") {
    const numPattern = answerText.match(
      /(\d+(?:\.\d+)?\s*\/\s*\d+|\d+(?:\.\d+)?)/
    );

    if (numPattern && numPattern.index < 80) {
      return answerText.substring(numPattern.index).trim();
    }

    return stripQuestionTail(answerText).trim();
  }

  if (field.type === "long_text") {
    return stripQuestionTail(answerText).trim();
  }

  return answerText;
}

function stripForExampleBlock(text, returnRemovedBlock = false) {
  if (!text) return "";

  const match = text.match(/^\s*For example:?\s*(?:[^\n]*\n?){0,4}/i);

  if (!match) {
    return returnRemovedBlock ? "" : text;
  }

  return returnRemovedBlock ? match[0] : text.substring(match[0].length).trim();
}

function stripScaleLabels(text) {
  if (!text) return "";

  return text
    .replace(/\b(?:very|extremely|not at all|neutral|likely|unlikely)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Strip leaked question/example text from the front of an answer.
 */
function stripQuestionTail(text) {
  if (!text) return "";

  const markers = [
    /For example[:\s]*(?:[^\n]*(?:\n|$)){0,4}/gi,
    /If (?:not|you haven't)[^.]*(?:put NA|put na)[.\s]*/gi,
    /Click "Other" to add[^.]*\.\s*/gi,
  ];

  let cleaned = text;

  markers.forEach((marker) => {
    const matches = [...cleaned.matchAll(marker)];

    if (matches.length > 0) {
      const lastMatch = matches[matches.length - 1];
      const afterMatch = lastMatch.index + lastMatch[0].length;

      if (afterMatch < cleaned.length) {
        cleaned = cleaned.substring(afterMatch).trim();
      }
    }
  });

  return cleaned;
}

// ─────────────────────────────────────────────────────────────
// STEP 3: Match segments to fields and format answers
// ─────────────────────────────────────────────────────────────

function parseMatrixBlock(text, subFields) {
  const results = [];

  if (!text || !subFields || subFields.length === 0) {
    return results;
  }

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length >= subFields.length / 2) {
    return parseMatrixLines(lines, subFields);
  }

  return parseMatrixContinuous(text, subFields);
}

function parseMatrixLines(lines, subFields) {
  const results = [];

  lines.forEach((line) => {
    const match = line.match(/^(.+?)\s+(\d+)\s*$/);
    if (!match) return;

    const itemText = match[1].trim();
    const rating = match[2];

    let bestSubField = null;
    let bestScore = 0;

    subFields.forEach((subField) => {
      if (results.some((result) => result.subField.id === subField.id)) {
        return;
      }

      const subFieldTitle = (
        subField.cleanTitle || subField.title
      ).toLowerCase();

      const itemTextLower = itemText.toLowerCase();

      if (itemTextLower === subFieldTitle) {
        bestSubField = subField;
        bestScore = 1;
        return;
      }

      if (
        itemTextLower.includes(subFieldTitle) ||
        subFieldTitle.includes(itemTextLower)
      ) {
        if (0.85 > bestScore) {
          bestSubField = subField;
          bestScore = 0.85;
        }

        return;
      }

      const score = similarityScore(
        itemText,
        subField.cleanTitle || subField.title
      );

      if (score > bestScore && score >= 0.4) {
        bestScore = score;
        bestSubField = subField;
      }
    });

    if (bestSubField) {
      results.push({
        subField: bestSubField,
        item: bestSubField.title,
        rating,
      });
    }
  });

  return results;
}

function parseMatrixContinuous(text, subFields) {
  const results = [];
  const textLower = text.toLowerCase();
  const titlePositions = [];

  subFields.forEach((subField) => {
    const title = (subField.cleanTitle || subField.title).toLowerCase();
    let idx = textLower.indexOf(title);

    if (idx === -1 && title.length > 15) {
      idx = textLower.indexOf(title.substring(0, 15));
    }

    if (idx !== -1) {
      titlePositions.push({
        subField,
        startIdx: idx,
        titleLength: title.length,
      });
    }
  });

  titlePositions.sort((a, b) => a.startIdx - b.startIdx);

  for (let i = 0; i < titlePositions.length; i++) {
    const current = titlePositions[i];
    const afterTitle = current.startIdx + current.titleLength;

    const nextStart =
      i + 1 < titlePositions.length
        ? titlePositions[i + 1].startIdx
        : text.length;

    const between = text.substring(afterTitle, nextStart).trim();
    const numMatch = between.match(/^[^\d]*(\d+)/);

    if (numMatch) {
      results.push({
        subField: current.subField,
        item: current.subField.title,
        rating: numMatch[1],
      });
    }
  }

  return results;
}

function similarityScore(a, b) {
  if (!a || !b) return 0;

  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();

  if (aLower === bLower) return 1;
  if (aLower.includes(bLower) || bLower.includes(aLower)) return 0.9;

  const aWords = new Set(
    aLower.split(/\s+/).filter((word) => word.length > 2)
  );

  const bWords = new Set(
    bLower.split(/\s+/).filter((word) => word.length > 2)
  );

  if (aWords.size === 0 || bWords.size === 0) return 0;

  let overlap = 0;

  aWords.forEach((word) => {
    if (bWords.has(word)) overlap++;
  });

  return overlap / Math.max(aWords.size, bWords.size);
}

function findBestFieldMatch(
  questionText,
  fieldLookup,
  usedFieldIds = new Set()
) {
  const cleaned = cleanTitle(questionText);
  let bestMatch = null;
  let bestScore = 0;

  fieldLookup.forEach((field) => {
    if (usedFieldIds.has(field.id)) return;

    const score = similarityScore(cleaned, field.cleanTitle);

    if (score > bestScore && score >= 0.4) {
      bestScore = score;
      bestMatch = field;
    }
  });

  return bestMatch ? { field: bestMatch, score: bestScore } : null;
}

function matchChoices(answerText, field) {
  const text = answerText.trim();

  if (field.allowMultiple) {
    const sortedChoices = [...field.choices].sort(
      (a, b) => b.label.length - a.label.length
    );

    const matched = [];
    let remaining = text;

    sortedChoices.forEach((choice) => {
      if (remaining.toLowerCase().includes(choice.label.toLowerCase())) {
        matched.push(choice);

        remaining = remaining
          .toLowerCase()
          .replace(choice.label.toLowerCase(), "");
      }
    });

    if (field.allowOther && matched.length === 0) {
      return {
        type: "other",
        labels: [text],
      };
    }

    return {
      type: "choices",
      choices: matched,
    };
  }

  let bestChoice = null;
  let bestScore = 0;

  field.choices.forEach((choice) => {
    const score = similarityScore(text, choice.cleanLabel || choice.label);

    if (score > bestScore) {
      bestScore = score;
      bestChoice = choice;
    }
  });

  if (!bestChoice || bestScore < 0.5) {
    field.choices.forEach((choice) => {
      if (
        text
          .toLowerCase()
          .startsWith(choice.label.toLowerCase().substring(0, 30))
      ) {
        bestChoice = choice;
        bestScore = 1;
      }
    });
  }

  if (bestChoice && bestScore >= 0.3) {
    return {
      type: "choice",
      choice: bestChoice,
    };
  }

  if (field.allowOther) {
    return {
      type: "other",
      labels: [text],
    };
  }

  return null;
}

function parseOpinionScale(answerText) {
  const text = answerText.trim();

  const slashMatch = text.match(/(\d+(?:\.\d+)?)\s*\/\s*\d+/);
  if (slashMatch) return parseFloat(slashMatch[1]);

  const numMatch = text.match(/^(\d+(?:\.\d+)?)/);
  if (numMatch) return parseFloat(numMatch[1]);

  return null;
}

function parseLanguageMatrix(text, field) {
  const LEVELS = ["Little Bit", "Proficient", "Fluent", "Native"];
  const results = [];

  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length <= 1 && text.length > 0) {
    const langNames = field.subFields.map((subField) => subField.title.trim());
    let splitText = text;

    langNames.forEach((name) => {
      const idx = splitText.indexOf(name);

      if (idx > 0) {
        splitText =
          splitText.substring(0, idx) + "\n" + splitText.substring(idx);
      }
    });

    const newLines = splitText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (newLines.length > lines.length) {
      lines.length = 0;
      newLines.forEach((line) => lines.push(line));
    }
  }

  lines.forEach((line) => {
    let matched = false;

    field.subFields.forEach((subField) => {
      if (matched) return;

      const langName = subField.title.trim();

      LEVELS.forEach((level) => {
        if (matched) return;

        const pattern = `${langName} ${level}`;

        if (line.toLowerCase() === pattern.toLowerCase()) {
          results.push({
            subField,
            item: langName,
            rating: level,
          });

          matched = true;
        }
      });
    });

    if (!matched) {
      for (const level of LEVELS) {
        if (line.toLowerCase().endsWith(level.toLowerCase())) {
          const langPart = line
            .substring(0, line.length - level.length)
            .trim();

          const subField = field.subFields.find(
            (fieldSubField) =>
              fieldSubField.title.toLowerCase().trim() ===
              langPart.toLowerCase()
          );

          if (subField) {
            results.push({
              subField,
              item: langPart,
              rating: level,
            });
          }

          break;
        }
      }
    }
  });

  return results;
}

function matchAndFormat(segments, fieldLookup, formDef) {
  const answers = [];
  const definitions = [];
  const warnings = [];

  segments.forEach((seg) => {
    const { field, answerText } = seg;

    if (!answerText || answerText.length === 0) return;

    let answer = null;

    const fieldDef = {
      id: field.id,
      title: field.title,
      type: field.type,
    };

    switch (field.type) {
      case "opinion_scale": {
        const value = parseOpinionScale(answerText);

        if (value !== null) {
          answer = {
            field: {
              id: field.id,
              type: "opinion_scale",
            },
            type: "number",
            number: value,
          };
        } else {
          warnings.push(
            `opinion_scale ${field.id}: could not parse number from "${answerText.substring(
              0,
              50
            )}"`
          );
        }

        break;
      }

      case "multiple_choice": {
        const result = matchChoices(answerText, field);

        if (result) {
          if (result.type === "choice") {
            answer = {
              field: {
                id: field.id,
                type: "multiple_choice",
              },
              type: "choice",
              choice: {
                label: result.choice.label,
              },
            };

            if (result.choice.id) {
              answer.choice.id = result.choice.id;
            }
          } else if (result.type === "choices") {
            const combinedLabel = result.choices
              .map((choice) => choice.label)
              .join(" ");

            answer = {
              field: {
                id: field.id,
                type: "multiple_choice",
              },
              type: "choice",
              choice: {
                label: combinedLabel,
              },
            };
          } else if (result.type === "other") {
            answer = {
              field: {
                id: field.id,
                type: "multiple_choice",
              },
              type: "choice",
              choice: {
                label: result.labels[0],
              },
            };
          }
        } else {
          warnings.push(
            `multiple_choice ${field.id}: no match for "${answerText.substring(
              0,
              50
            )}"`
          );
        }

        break;
      }

      case "matrix": {
        const isLanguageMatrix =
          field.id === "kjjYJnA6LPji" ||
          field.cleanTitle.toLowerCase().includes("what languages");

        let matrixText;

        if (isLanguageMatrix) {
          const parsed = parseLanguageMatrix(answerText, field);

          matrixText = parsed
            .map((result) => `${result.item} ${result.rating}`)
            .join(" ");
        } else {
          const parsed = parseMatrixBlock(answerText, field.subFields);

          matrixText = parsed
            .map((result) => `${result.item} ${result.rating}`)
            .join(" ");
        }

        if (matrixText.length > 0) {
          answer = {
            field: {
              id: field.id,
              type: "matrix",
            },
            type: "text",
            text: matrixText,
          };
        } else {
          warnings.push(
            `matrix ${field.id}: no items parsed from "${answerText.substring(
              0,
              80
            )}"`
          );
        }

        break;
      }

      case "short_text": {
        const cleaned = stripQuestionTail(answerText).trim();
        const numCheck = cleaned.match(/^(\d+(?:\.\d+)?)\s*$/);

        if (numCheck) {
          answer = {
            field: {
              id: field.id,
              type: "short_text",
            },
            type: "number",
            number: parseFloat(numCheck[1]),
          };
        } else {
          answer = {
            field: {
              id: field.id,
              type: "short_text",
            },
            type: "text",
            text: cleaned,
          };
        }

        break;
      }

      case "long_text": {
        const cleaned = stripQuestionTail(answerText).trim();

        answer = {
          field: {
            id: field.id,
            type: "long_text",
          },
          type: "text",
          text: cleaned,
        };

        break;
      }

      default:
        warnings.push(
          `Unhandled field type: ${field.type} for field ${field.id}`
        );
    }

    if (answer) {
      answers.push(answer);
      definitions.push(fieldDef);
    }
  });

  return {
    answers,
    definitions,
    warnings,
  };
}

// ─────────────────────────────────────────────────────────────
// STEP 4: Assemble webhook JSON
// ─────────────────────────────────────────────────────────────

function assembleWebhook(answers, definitions, formDef, options = {}) {
  const now = new Date().toISOString();

  const eventId =
    options.eventId ||
    `parsed_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const token = options.token || `parsed_token_${Date.now()}`;
  const userId = options.userId || "unknown";

  return {
    event_id: eventId,
    event_type: "form_response",
    form_response: {
      form_id: formDef.id || "e6CmL0dp",
      token,
      landed_at: options.landedAt || now,
      submitted_at: options.submittedAt || now,
      hidden: {
        user_id: userId,
      },
      definition: {
        id: formDef.id || "e6CmL0dp",
        title: formDef.title || "Macro Survey",
        fields: definitions,
      },
      answers,
    },
  };
}

module.exports = {
  parseResponse,
  buildFieldLookup,
  buildSearchVariants,
  buildAnchors,
  segmentPlainText,
  extractAnswer,
  findQuestionEnd,
  mapToOriginal,
  stripForExampleBlock,
  stripScaleLabels,
  stripQuestionTail,
  matchAndFormat,
  assembleWebhook,
  cleanTitle,
  similarityScore,
  findBestFieldMatch,
  parseMatrixBlock,
  parseMatrixLines,
  parseMatrixContinuous,
  parseLanguageMatrix,
  matchChoices,
  parseOpinionScale,
};