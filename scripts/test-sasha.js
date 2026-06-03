// scripts/test-sasha.js

const { parseResponse } = require("../lib/surveyParser");
const fs = require("fs");
const path = require("path");

const formDef = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../data/form-definition.json"), "utf8")
);

const plainText = fs.readFileSync(
  path.join(__dirname, "../data/test-responses/sasha.txt"),
  "utf8"
);

console.log("Parsing Sasha's response...\n");

const result = parseResponse(plainText, formDef, {
  userId: "sasha",
});

console.log(`Total answers: ${result.form_response.answers.length}\n`);

result.form_response.answers.forEach((ans, i) => {
  const fieldId = ans.field.id;
  const type = ans.field.type;
  let value;

  if (ans.type === "number") value = ans.number;
  else if (ans.type === "text")
    value =
      ans.text.substring(0, 100) + (ans.text.length > 100 ? "..." : "");
  else if (ans.type === "choice")
    value =
      ans.choice.label.substring(0, 100) +
      (ans.choice.label.length > 100 ? "..." : "");
  else value = JSON.stringify(ans).substring(0, 100);

  console.log(`  ${i + 1}. [${type}] ${fieldId}: ${value}`);
});

// Sasha-specific expected fields
const EXPECTED_FIELDS = [
  "rGJHiQPC6YD9", // comfort zone
  // f0Egg5nC1H90 — NOT expected (Sasha skipped travel purpose)
  "imcDksACfHVO", // city vs nature
  "XmikHcnAic72", // landscapes matrix
  "0x8c5F8VyE4m", // history culture
  "4OK6bgj8mjof", // budget
  "PDx6LCSOU2yz", // ambition scale
  "Iib2xCJM6151", // walking
  "PS04AKhb1UzV", // fitness
  "4Y82MbNwQOv3", // exercise matrix
  "Nw34RFmC1T2t", // outdoors
  "RGqk0WRelI7e", // outdoor activities 1
  "d7NrWkACycGW", // outdoor activities 2
  "6Jp4tlFSHJdV", // wildlife interest
  "GYrm9O2JscuZ", // wildlife detail matrix
  "tlh7xL8lgugA", // performing arts
  "TLNebk3UxIjN", // performing arts detail
  "zVmbD4KV4v2f", // watching sports
  "qtv5pdVj4g2j", // watching sports detail
  "Tq3dolCNUjwg", // playing sports scale
  "GuvWK9h6azVP", // playing sports text
  "r38BMM1QIoVW", // passions matrix
  "JWJuH90XmSYq", // foodie
  "4uRWPbCRTre5", // train/car
  "FOXl1vIEYtOK", // road trips
  "haby0w4obGjr", // fears (multi-select: 6 items)
  "OiuZOiCbweRS", // learning interest
  "wEpXrngXNA2V", // learning fields matrix
  "238YFvBaFH7P", // other passions
  "CsLKPNw2PFWA", // home country
  "H0nLmjA33sl2", // continents visited
  "acJ9V5yo65xF", // europe countries
  "08Ma6ZcRdeZH", // asia countries
  "offbI97Ont1O", // north america countries
  // No Oceania, Africa, S.America — she didn't visit those
  // No Italy places — she visited Italy but no detail question answered
  // No US cities — she's not a US resident who gets this
  "MKfvKAOwxr3E", // where live now
  "sNZgZtvBL0rv", // where grew up
  "Q", // where else lived
  "EREFtxY4MIId", // friends family abroad
  "kjjYJnA6LPji", // languages
  // No s4xOmObgOe6A — no overflow languages
  "hQm2oxFAh3mv", // age
  "XIku4coCODbd", // university
  "G4W8BkalCLE6", // major
  "sO3gxchC47CO", // field of work
  "bOoOfBktKMMw", // work travel frequency
  "0mtOzFzz9bsJ", // work travel location
  "s7kdGy4SisAA", // special occasion
  "zluFViGTaev3", // gender
  // No yyIGNCOmmTUX — she skipped identity question
  "4cTqb7XLM8aR", // kids
  "DHutOpUAO7DI", // 23-35 employed (Sasha-specific)
];

console.log("\n─── Validation ───");
const parsedFieldIds = new Set(
  result.form_response.answers.map((a) => a.field.id)
);
const missing = EXPECTED_FIELDS.filter((id) => !parsedFieldIds.has(id));
const extra = [...parsedFieldIds].filter(
  (id) => !EXPECTED_FIELDS.includes(id)
);

if (missing.length > 0) {
  console.log(`\n⚠️  MISSING (${missing.length}):`);
  missing.forEach((id) => console.log(`  - ${id}`));
} else {
  console.log("\n✅ All expected fields found!");
}

if (extra.length > 0) {
  console.log(
    `\nℹ️  EXTRA (${extra.length}) — fields parsed but not in expected list:`
  );
  extra.forEach((id) => console.log(`  + ${id}`));
}

// Spot-check critical values
console.log("\n─── Spot Checks ───");
const getAnswer = (id) =>
  result.form_response.answers.find((a) => a.field.id === id);

const checks = [
  {
    id: "PDx6LCSOU2yz",
    expected: 8,
    label: "Ambition",
    get: (a) => a?.number,
  },
  {
    id: "PS04AKhb1UzV",
    expected: 8,
    label: "Fitness",
    get: (a) => a?.number,
  },
  {
    id: "Nw34RFmC1T2t",
    expected: 10,
    label: "Outdoors",
    get: (a) => a?.number,
  },
  {
    id: "6Jp4tlFSHJdV",
    expected: 10,
    label: "Wildlife",
    get: (a) => a?.number,
  },
  {
    id: "tlh7xL8lgugA",
    expected: 10,
    label: "Performing arts",
    get: (a) => a?.number,
  },
  {
    id: "zVmbD4KV4v2f",
    expected: 9,
    label: "Watching sports",
    get: (a) => a?.number,
  },
  {
    id: "Tq3dolCNUjwg",
    expected: 6,
    label: "Playing sports",
    get: (a) => a?.number,
  },
  {
    id: "OiuZOiCbweRS",
    expected: 10,
    label: "Learning",
    get: (a) => a?.number,
  },
  {
    id: "1AabF3P1DnE8",
    expected: null,
    label: "New friends (should be absent)",
    get: (a) => a?.number,
  },
  {
    id: "hQm2oxFAh3mv",
    expected: 24,
    label: "Age",
    get: (a) => a?.number,
  },
  {
    id: "MKfvKAOwxr3E",
    expected: "Los Angeles",
    label: "Lives now",
    get: (a) => a?.text,
  },
  {
    id: "sNZgZtvBL0rv",
    expected: "Mountain View, CA",
    label: "Grew up",
    get: (a) => a?.text,
  },
  {
    id: "QsQOnTicExlO",
    expected: "Eugene, OR",
    label: "Else lived",
    get: (a) => a?.text,
  },
  {
    id: "EREFtxY4MIId",
    expected: "Italy, UK, France",
    label: "F/F abroad",
    get: (a) => a?.text,
  },
  {
    id: "G4W8BkalCLE6",
    expected: "Art & Technology",
    label: "Major",
    get: (a) => a?.text,
  },
  {
    id: "sO3gxchC47CO",
    expected: "Design/ Technology",
    label: "Field of work",
    get: (a) => a?.text,
  },
];

checks.forEach((check) => {
  const ans = getAnswer(check.id);
  const got = check.get(ans);
  const pass =
    check.expected === null
      ? got === undefined || got === null
      : got === check.expected;
  console.log(
    `  ${pass ? "✅" : "🔴"} ${check.label}: got ${JSON.stringify(got)}, expected ${JSON.stringify(check.expected)}`
  );
});

// Check fears multi-select
const fears = getAnswer("haby0w4obGjr");
if (fears) {
  const fearsLabel = fears.choice?.label || "";
  const expectedFears = [
    "Riding motorbikes or scooters",
    "Bungee jumping",
    "Ziplining",
    "Hang gliding",
    "Fear of heights",
    "Fear of snakes",
  ];
  const allPresent = expectedFears.every((f) =>
    fearsLabel.toLowerCase().includes(f.toLowerCase())
  );
  console.log(
    `  ${allPresent ? "✅" : "🔴"} Fears: ${allPresent ? "all 6 items found" : "MISSING items"} in "${fearsLabel.substring(0, 80)}..."`
  );
} else {
  console.log("  🔴 Fears: field not found");
}

// Check learning matrix has Science separately from Political Science
const learning = getAnswer("wEpXrngXNA2V");
if (learning) {
  const txt = learning.text || "";
  const hasPoliticalScience = txt.includes(
    "Political Science, International Relations 5"
  );
  // Check for standalone "Science 5" not preceded by "Political"
  const hasScience = /(?<!Political\s)Science 5/.test(txt);
  console.log(
    `  ${hasPoliticalScience ? "✅" : "🔴"} Learning: Political Science present`
  );
  console.log(
    `  ${hasScience ? "✅" : "🔴"} Learning: standalone Science present`
  );
}

// Write output
const outputPath = path.join(
  __dirname,
  "../data/test-responses/sasha-webhook.json"
);
fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));
console.log(`\n📄 Output written to: ${outputPath}`);