// scripts/load-user.js
// Runs the full pipeline for ONE user and writes the result to Supabase,
// overwriting any previous run for that user_id.
//
// Usage (plain-text survey):
//   node -r dotenv/config scripts/load-user.js --text data/test-responses/sasha.txt --user sasha --name "Sasha"
//
// Usage (already-parsed webhook JSON, e.g. from a Typeform export):
//   node -r dotenv/config scripts/load-user.js --webhook data/test-responses/corinne-webhook.json --user corinne --name "Corinne"
//
// Flags:
//   --text <path>     plain-text survey response  (will be parsed)
//   --webhook <path>  Typeform-style webhook JSON  (skips parsing)
//   --user <id>       user_id (defaults to webhook hidden.user_id or filename)
//   --name <name>     display name for the dropdown

const fs = require("fs");
const path = require("path");

const { parseResponse } = require("../lib/surveyParser");
const { transformToProfile } = require("../lib/profileTransformer");

// lib/formDefinition.js uses ESM `import` and only works inside Next.js.
// For a plain CommonJS terminal script we read the form definition
// directly (same file, same cache behaviour).
let _formDefCache = null;
function getFormDefinition() {
  if (_formDefCache) return _formDefCache;
  const fp = path.join(__dirname, "..", "data", "form-definition.json");
  _formDefCache = JSON.parse(fs.readFileSync(fp, "utf8"));
  return _formDefCache;
}
const { runF1, findTrip } = require("../lib/al-v2_36");
const { getClient } = require("./supabase/client");

// ── arg parsing ──────────────────────────────────────────────
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      args[a.slice(2)] = argv[i + 1];
      i++;
    }
  }
  return args;
}

// ── trip enrichment (same logic as pages/api/run-full.js) ─────
const DISCLOSURE_FLAGS = [
  "fear_snakes",
  "fear_heights",
  "left_side_driving",
  "right_side_driving",
];

function enrichTrip(abbr, profile, f1Result) {
  const trip = findTrip(abbr);
  if (!trip) return { trip: abbr };

  const rawFlags = f1Result.gates?.g13?.flags?.[abbr] || [];
  const flags = rawFlags.filter((f) => !DISCLOSURE_FLAGS.includes(f));

  let ff = null;
  if (flags.includes("friends_family")) {
    const overlap = (profile.friendsFamilyCountries || []).filter((c) =>
      trip.spineCountries?.some(
        (sc) => sc.toLowerCase() === c.toLowerCase()
      )
    );
    if (overlap.length > 0) ff = overlap.join(", ");
  }

  return {
    trip: abbr,
    name: trip.name,
    tier: trip.type === "Big4" ? "B4" : `T${trip.tier}`,
    type: trip.type,
    region: trip.region,
    flags: flags.filter((f) => f !== "friends_family"),
    ff,
    spineCountries: trip.spineCountries,
  };
}

// ── main ──────────────────────────────────────────────────────
async function main() {
  const args = parseArgs(process.argv);

  if (!args.text && !args.webhook) {
    console.error("Provide --text <path> or --webhook <path>");
    process.exit(1);
  }

  // 1. Get a webhook JSON, either by parsing plain text or loading it.
  let webhookJson;
  let rawResponse = null;

  if (args.text) {
    const textPath = path.resolve(args.text);
    rawResponse = fs.readFileSync(textPath, "utf8");
    const formDef = getFormDefinition();
    webhookJson = parseResponse(rawResponse, formDef, {
      userId: args.user || "unknown",
      respondentName: args.name || null,
    });
  } else {
    const whPath = path.resolve(args.webhook);
    webhookJson = JSON.parse(fs.readFileSync(whPath, "utf8"));
  }

  // 2. Resolve user_id.
  const userId =
    args.user ||
    webhookJson.form_response?.hidden?.user_id ||
    "unknown";

  // 3. Transform → profile, then run the engine.
  const profile = transformToProfile(webhookJson);
  const f1Result = runF1(profile);

  const top8 = f1Result.top8.map((a) => enrichTrip(a, profile, f1Result));
  const next5 = f1Result.next5.map((a) => enrichTrip(a, profile, f1Result));

  // Trim gates to the subset the UI/chatbot actually use (keeps the row small).
  const gates = {
    g1: { excluded: f1Result.gates?.g1?.excluded || [] },
    g2: f1Result.gates?.g2 || {},
    g4: { touchedRegions: f1Result.gates?.g4?.touchedRegions || [] },
    g10: {
      age: f1Result.gates?.g10?.age,
      band: f1Result.gates?.g10?.band,
      ypActive: f1Result.gates?.g10?.ypActive,
    },
    g13: { flagCounts: f1Result.gates?.g13?.flagCounts },
    g17: f1Result.gates?.g17 || {},
  };

  // 4. Write to Supabase (overwrite semantics).
  const supabase = getClient();
  const now = new Date().toISOString();

  // 4a. users — upsert on user_id
  let { error: uErr } = await supabase.from("users").upsert(
    {
      user_id: userId,
      name: args.name || profile.name || userId,
      age: profile.age || null,
      home_country: profile.homeCountry || null,
      residence_city: profile.residenceCity || null,
      last_run_at: now,
    },
    { onConflict: "user_id" }
  );
  if (uErr) throw new Error(`users upsert: ${uErr.message}`);

  // 4b. user_runs — one row per user, upsert on user_id
  let { error: rErr } = await supabase.from("user_runs").upsert(
    {
      user_id: userId,
      profile,
      gates,
      raw_response: rawResponse,
      webhook_json: webhookJson,
      created_at: now,
    },
    { onConflict: "user_id" }
  );
  if (rErr) throw new Error(`user_runs upsert: ${rErr.message}`);

  // 4c. user_trips — delete old, insert fresh
  let { error: dErr } = await supabase
    .from("user_trips")
    .delete()
    .eq("user_id", userId);
  if (dErr) throw new Error(`user_trips delete: ${dErr.message}`);

  const tripRows = [
    ...top8.map((t, i) => ({ ...t, bucket: "top8", rank: i + 1 })),
    ...next5.map((t, i) => ({ ...t, bucket: "next5", rank: i + 1 })),
  ].map((t) => ({
    user_id: userId,
    abbr: t.trip,
    bucket: t.bucket,
    rank: t.rank,
    tier_label: t.tier || null,
    flags: t.flags || [],
    ff: t.ff || null,
  }));

  let { error: tErr } = await supabase.from("user_trips").insert(tripRows);
  if (tErr) throw new Error(`user_trips insert: ${tErr.message}`);

  console.log(`✓ Loaded ${userId}`);
  console.log(`  top8:  ${top8.map((t) => t.trip).join(", ")}`);
  console.log(`  next5: ${next5.map((t) => t.trip).join(", ")}`);
}

main().catch((e) => {
  console.error("Load failed:", e.message);
  process.exit(1);
});