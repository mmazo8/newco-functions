// scripts/test-corinne.js
// Local test script — run with: node scripts/test-corinne.js

const { parseResponse } = require("../lib/surveyParser");
const fs = require("fs");
const path = require("path");

// Load form definition
const formDef = JSON.parse(
  fs.readFileSync(path.join(__dirname, "../data/form-definition.json"), "utf8")
);

// Corinne's plain text response
const plainText = fs.readFileSync(
  path.join(__dirname, "../data/test-responses/corinne.txt"),
  "utf8"
);

console.log("Parsing Corinne's response...\n");

const result = parseResponse(plainText, formDef, {
  userId: "corinne",
});

console.log(`Parsed ${result.form_response.answers.length} answers\n`);

// Print each answer summary
result.form_response.answers.forEach((ans, i) => {
  const fieldId = ans.field.id;
  const type = ans.field.type;
  let value;

  if (ans.type === "number") {
    value = ans.number;
  } else if (ans.type === "text") {
    value =
      ans.text.substring(0, 80) + (ans.text.length > 80 ? "..." : "");
  } else if (ans.type === "choice") {
    value =
      ans.choice.label.substring(0, 80) +
      (ans.choice.label.length > 80 ? "..." : "");
  } else {
    value = JSON.stringify(ans).substring(0, 80);
  }

  console.log(`  ${i + 1}. [${type}] ${fieldId}: ${value}`);
});

// Validate against expected fields
const EXPECTED_FIELDS = [
  "rGJHiQPC6YD9", // comfort zone
  "f0Egg5nC1H90", // travel purpose
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
  "Tq3dolCNUjwg", // playing sports
  "r38BMM1QIoVW", // passions matrix
  "JWJuH90XmSYq", // foodie
  "4uRWPbCRTre5", // train/car
  "FOXl1vIEYtOK", // road trips
  "haby0w4obGjr", // fears
  "OiuZOiCbweRS", // learning interest
  "wEpXrngXNA2V", // learning fields matrix
  "CsLKPNw2PFWA", // home country
  "H0nLmjA33sl2", // continents visited
  "acJ9V5yo65xF", // europe countries
  "08Ma6ZcRdeZH", // asia countries
  "offbI97Ont1O", // north america countries
  "S8t2fgFcSU2M", // oceania countries
  "Y0ulFDtBAbRP", // italy places
  "oNpneoenwYnO", // us cities
  "MKfvKAOwxr3E", // where live now
  "sNZgZtvBL0rv", // where grew up
  "QsQOnTicExlO", // where else lived
  "EREFtxY4MIId", // friends family abroad
  "kjjYJnA6LPji", // languages
  "s4xOmObgOe6A", // language overflow
  "hQm2oxFAh3mv", // age
  "XIku4coCODbd", // university
  "G4W8BkalCLE6", // major
  "sO3gxchC47CO", // field of work
  "bOoOfBktKMMw", // work travel frequency
  "0mtOzFzz9bsJ", // work travel location
  "s7kdGy4SisAA", // special occasion
  "zluFViGTaev3", // gender
  "yyIGNCOmmTUX", // identity groups
  "4cTqb7XLM8aR", // kids
];

console.log("\n─── Validation ───");

const parsedFieldIds = new Set(
  result.form_response.answers.map((answer) => answer.field.id)
);

const missing = EXPECTED_FIELDS.filter((id) => !parsedFieldIds.has(id));
const extra = [...parsedFieldIds].filter((id) => !EXPECTED_FIELDS.includes(id));

if (missing.length > 0) {
  console.log(`\n⚠️  MISSING (${missing.length}):`);
  missing.forEach((id) => console.log(`  - ${id}`));
} else {
  console.log("\n✅ All expected fields found!");
}

if (extra.length > 0) {
  console.log(`\nℹ️  EXTRA (${extra.length}) — fields parsed but not in expected list:`);
  extra.forEach((id) => console.log(`  + ${id}`));
}

// Write output
const outputPath = path.join(
  __dirname,
  "../data/test-responses/corinne-webhook.json"
);

fs.writeFileSync(outputPath, JSON.stringify(result, null, 2));

console.log(`\n📄 Output written to: ${outputPath}`);