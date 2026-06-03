// scripts/run-engine.js
// Usage: node scripts/run-engine.js <path-to-webhook-json>
// Example: node scripts/run-engine.js data/test-responses/corinne-webhook.json

const fs = require("fs");
const path = require("path");
const { transformToProfile } = require("../lib/profileTransformer");
const {
  runF1,
  printProfileHeader,
  printSummaryTable,
  printConsolidatedTripProfiles,
  printCapDropped,
  printCloseCallCharts,
} = require("../lib/al-v2_36");

// Get webhook JSON path from command line
const jsonPath = process.argv[2];

if (!jsonPath) {
  console.error("Usage: node scripts/run-engine.js <webhook-json-path>");
  console.error(
    "Example: node scripts/run-engine.js data/test-responses/corinne-webhook.json"
  );
  process.exit(1);
}

// Load webhook JSON
const fullPath = path.resolve(jsonPath);

if (!fs.existsSync(fullPath)) {
  console.error(`File not found: ${fullPath}`);
  process.exit(1);
}

const webhookJson = JSON.parse(fs.readFileSync(fullPath, "utf8"));

const userName = webhookJson.form_response?.hidden?.user_id || "unknown";

console.log(`\n═══ Processing ${userName} ═══\n`);

// Step 1: Transform webhook → profile
const profile = transformToProfile(webhookJson);

// Log the profile for debugging
console.log("─── Generated Profile ───");
console.log(`  Home: ${profile.homeCountry} (${profile.residenceCity})`);
console.log(`  Age: ${profile.age}`);
console.log(`  Fitness: ${profile.fitness}/10`);
console.log(`  Visited: ${profile.visitedCountries.join(", ") || "none"}`);
console.log(`  CE Cities: ${profile.visitedCECities.join(", ") || "none"}`);
console.log(
  `  Languages: ${
    profile.languages.map((language) => `${language.lang} (${language.level})`).join(", ") ||
    "none"
  }`
);
console.log(`  F/F: ${profile.friendsFamilyCountries.join(", ") || "none"}`);
console.log(`  Hiking: ${profile.hiking}/5`);
console.log(`  Backpacking: ${profile.backpacking}/5`);
console.log(`  Wildlife: ${profile.wildlife_interest}/10`);
console.log(`  Performing Arts: ${profile.performing_arts}/10`);
console.log(`  Art: ${profile.art}/5`);
console.log(`  History: ${profile.history_rating}/5`);
console.log(`  Extrovert: ${profile.extrovert}/10 ⚠️  (not in survey)`);
console.log(`  Foodie: ${profile.foodie}`);
console.log(`  Road Trip: ${profile.roadTrip}`);
console.log(`  Train: ${profile.trainPref}`);
console.log(`  Fear Snakes: ${profile.fearSnakes}`);
console.log(`  Fear Heights: ${profile.fearHeights}`);
console.log(`  Lived in CA: ${profile.livedInCalifornia}`);
console.log(`  US Resident: ${profile.isUSResident}`);
console.log(
  `  Beaches: ${profile.landscapes.beaches}, Mountains: ${profile.landscapes.mountains}, Lakes: ${profile.landscapes.lakes}`
);
console.log(
  `  Vineyards: ${profile.landscapes.vineyards}, Wildlife: ${profile.landscapes.wildlife}, Rainforests: ${profile.landscapes.rainforests}`
);
console.log(
  `  Deserts: ${profile.landscapes.deserts}, Forests: ${profile.landscapes.forests}`
);
console.log();

// Step 2: Run F1 engine
const f1Result = runF1(profile);

// Step 3: Print results
console.log("\n═══════════════════════════════════════════════════════════════");
console.log(`  ${userName.toUpperCase()} — TOP 8 + NEXT 5`);
console.log("═══════════════════════════════════════════════════════════════\n");

console.log("  TOP 8:");

f1Result.top8.forEach((trip, index) => {
  console.log(`    ${index + 1}. ${trip}`);
});

console.log("\n  NEXT 5:");

f1Result.next5.forEach((trip, index) => {
  console.log(`    ${index + 9}. ${trip}`);
});

// Step 4: Print detailed outputs
printProfileHeader(profile, f1Result);
printSummaryTable(profile, f1Result);
printConsolidatedTripProfiles(profile, f1Result);
printCapDropped(profile, f1Result);
printCloseCallCharts(profile, f1Result);

// Step 5: Save profile for reference
const profilePath = path.join(path.dirname(fullPath), `${userName}-profile.json`);

fs.writeFileSync(profilePath, JSON.stringify(profile, null, 2));

console.log(`\n📄 Profile saved to: ${profilePath}`);