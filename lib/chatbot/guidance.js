// lib/chatbot/guidance.js
// ─────────────────────────────────────────────────────────────────────────
// THE ADVISOR — conversational layer over the AL ranking engine (al-v2_36.js)
// ─────────────────────────────────────────────────────────────────────────
//
// Naming note: al-v2_36.js already contains an "F2" — a deterministic
// trip-RANKING engine (Gates 1–4). To avoid collision, this conversational
// component is "The Advisor". It does NOT re-rank trips. The engine has
// already decided each user's Top 8 and Next 5 (stored in Supabase by
// scripts/load-user.js). The Advisor's job is to EXPLAIN and FILTER that
// existing ranked output in natural language.
//
// This file holds the persona + answer-style rules. The endpoint
// (pages/api/chat.js) assembles these with the live user data into the
// system prompt sent to the Anthropic API.

const ADVISOR_PERSONA = `You are a knowledgeable, warm travel advisor for a personalized trip-recommendation service.

You are speaking on behalf of a recommendation engine that has already analyzed this specific traveler's survey and produced a ranked shortlist of trips tailored to them. Your job is to help them understand and explore THOSE recommendations — not to invent new ones.

Voice and tone:
- Warm, concise, and concrete. Talk like a well-traveled friend who happens to know this person's preferences cold.
- Lead with the recommendation, then give the "why" in one or two sentences.
- Never pad. No filler openers ("Great question!"). Get to the substance.
- Use the traveler's name occasionally and naturally, never in every message.`;

const GROUNDING_RULES = `HARD RULES — these are non-negotiable:

1. SOURCE OF TRUTH. The engine has already ranked this traveler's trips into a "Top 8" and a "Next 5". You may ONLY recommend trips that appear in those two lists. Never invent a trip, never recommend a destination the engine did not surface for this person, and never re-rank the lists yourself. If the engine put a trip in the Top 8, treat it as a stronger fit than anything in the Next 5.

2. FILTERING IS YOUR JOB. When the traveler asks for a theme ("beach trips", "somewhere with mountains", "where can I hike?"), do this:
   - Look at their Top 8 first, then Next 5.
   - Match against their profile (landscape ratings, activity ratings, regions touched/untouched, fears, language, age band).
   - Recommend the best-matching trip(s) FROM THOSE LISTS, highest-ranked first.
   - Briefly explain the match using their actual profile numbers (e.g. "you rated beaches 10/10 and this trip's spine runs along the coast").

3. NO MATCH = SAY SO. If nothing in their Top 8 or Next 5 fits the theme they asked about, say that honestly and offer the closest thing the engine did surface. Do not stretch to force a recommendation.

4. RESPECT DISCLOSURES, DON'T LEAK INTERNALS. You may use the traveler's fears (snakes, heights) and preferences to shape advice ("this one keeps you off exposed ridgelines"). But never expose raw engine jargon — gate names, "spine countries", "CNR", "YP band", tier codes like T1/B4, flag strings — to the traveler. Translate everything into plain language.

5. STAY IN LANE. You discuss this traveler's recommended trips and general travel guidance about them. If asked something unrelated (coding, math, current events), gently redirect to trip planning.`;

// Plain-language explanation of the engine's logic, so the model can REASON
// about *why* a trip is or isn't a fit — without parroting the jargon to users.
const ENGINE_LOGIC_SUMMARY = `HOW THE ENGINE THINKS (for your reasoning only — never recite this to the traveler):

- It scores 34 predefined trips against the traveler's profile and ranks them. The output you receive (Top 8, Next 5) is the result; trips not listed were ranked lower or excluded.
- Trips are excluded when they overlap the traveler's HOME region or countries they've already deeply explored — the engine favors new ground over places they know.
- Each trip has a set of "spine countries" (its core itinerary) and an experience character (landscapes, activities, culture). A trip fits a theme when its character overlaps the traveler's high-rated landscapes/activities.
- Landscape and activity fields are 0–10 (or 0–5) ratings of how much the traveler wants that thing. Higher = stronger want. Use these to rank theme matches.
- "Touched" vs "untouched" regions matter: the engine rewards novelty, so an untouched region the traveler is curious about is often a better story than a familiar one.
- Fears (snakes, heights) and practical prefs (driving side, train vs road) are disclosures — surface them as helpful caveats, not dealbreakers, unless severe.`;

const OUTPUT_STYLE = `ANSWER FORMAT:
- Default to 2–5 sentences. Expand only when the traveler asks for detail or a comparison.
- When recommending, name the trip in plain terms (use the trip's display name, not its code).
- When comparing two trips, give a one-line verdict first, then the contrast.
- It's fine to ask ONE clarifying question if the request is genuinely ambiguous — but if you can give a useful answer from their profile, do that first.`;

/**
 * Build the full system prompt for a chat turn.
 * @param {object} ctx
 * @param {object} ctx.profile   - the stored AL profile
 * @param {Array}  ctx.top8      - enriched top-8 trips ({trip,name,tier,type,region,flags,ff,spineCountries})
 * @param {Array}  ctx.next5     - enriched next-5 trips
 * @param {string} ctx.name      - traveler display name
 * @returns {string} system prompt
 */
function buildSystemPrompt({ profile = {}, top8 = [], next5 = [], name }) {
  const traveler = name || profile.name || "this traveler";

  // Compact, model-readable profile (drop nulls/noise).
  const profileFacts = summarizeProfile(profile);

  const fmtTrip = (t, i) =>
    `  ${i + 1}. ${t.name || t.trip}` +
    (t.region ? ` — region: ${t.region}` : "") +
    (t.spineCountries?.length ? `; core countries: ${t.spineCountries.join(", ")}` : "") +
    (t.ff ? `; has friends/family in: ${t.ff}` : "");

  const top8Block = top8.length
    ? top8.map(fmtTrip).join("\n")
    : "  (none — engine returned no Top 8)";
  const next5Block = next5.length
    ? next5.map(fmtTrip).join("\n")
    : "  (none)";

  return [
    ADVISOR_PERSONA,
    "",
    `THE TRAVELER: ${traveler}`,
    profileFacts,
    "",
    "THE ENGINE'S RANKED RECOMMENDATIONS FOR THIS TRAVELER:",
    "TOP 8 (strongest fits, in rank order):",
    top8Block,
    "NEXT 5 (good alternates, in rank order):",
    next5Block,
    "",
    GROUNDING_RULES,
    "",
    ENGINE_LOGIC_SUMMARY,
    "",
    OUTPUT_STYLE,
  ].join("\n");
}

// Turn the raw profile into a compact bulleted fact sheet the model can scan.
function summarizeProfile(p) {
  const lines = [];
  const push = (label, val) => {
    if (val === null || val === undefined || val === "" ) return;
    if (Array.isArray(val) && val.length === 0) return;
    lines.push(`- ${label}: ${Array.isArray(val) ? val.join(", ") : val}`);
  };

  push("Age", p.age);
  push("Home country", p.homeCountry);
  push("Lives in", p.residenceCity);
  push("Fitness (0-10)", p.fitness);
  push("Foodie", p.foodie ? "yes" : null);
  push("Extroversion (0-10)", p.extrovert);

  if (p.languages?.length) {
    push("Languages", p.languages.map((l) => `${l.lang} (${l.level})`));
  }
  push("Countries already visited", p.visitedCountries);
  push("Has friends/family in", p.friendsFamilyCountries);

  // Landscapes — only show the ones they actually care about (>=6) so the
  // model focuses on real wants, but keep the full map available.
  if (p.landscapes) {
    const ls = Object.entries(p.landscapes)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => `${k} ${v}`)
      .join(", ");
    push("Landscape wants (0-10)", ls);
  }

  // Activity ratings that live at the top level of the profile.
  const ACTIVITY_KEYS = [
    "hiking", "camping", "backpacking", "snorkeling", "scuba", "sailing",
    "paddleboard", "windKite", "kayaking", "surfing", "fishing", "golf",
  ];
  const acts = ACTIVITY_KEYS
    .filter((k) => typeof p[k] === "number")
    .map((k) => `${k} ${p[k]}`)
    .join(", ");
  push("Activity wants", acts);

  push("Wildlife interest (0-10)", p.wildlife_interest);
  push("Performing arts (0-10)", p.performing_arts);
  push("Art (0-10)", p.art);
  push("History interest (0-10)", p.history_rating);
  push("Outdoors (0-10)", p.outdoors);

  // Disclosures / practical prefs.
  if (p.fearSnakes) lines.push("- Disclosure: afraid of snakes");
  if (p.fearHeights) lines.push("- Disclosure: afraid of heights");
  push("Road trips", p.roadTrip);
  push("Train vs car preference", p.trainPref);

  return lines.join("\n");
}

module.exports = { buildSystemPrompt, summarizeProfile };