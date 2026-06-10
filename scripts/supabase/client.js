// scripts/supabase/client.js
// Shared Supabase client + helper to read TRIPS straight from the engine
// source (so the catalog never drifts from al-v2_36.js).

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

// Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from the environment.
// Put them in a .env file (gitignored) and load with `node -r dotenv/config`.
function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment"
    );
  }
  // Service-role key bypasses RLS — safe here because this runs server-side
  // in your terminal, never in the browser. Never ship this key to Bubble.
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

// Pull the TRIPS array literal out of the engine file and eval it in
// isolation. No imports from the engine, so its console output / side
// effects don't run.
function extractTrips() {
  const enginePath = path.join(__dirname, "..", "..", "lib", "al-v2_36.js");
  const src = fs.readFileSync(enginePath, "utf8");
  const start = src.indexOf("const TRIPS = [");
  if (start === -1) throw new Error("Could not find TRIPS array in engine");
  const end = src.indexOf("];", start) + 2;
  const literal = src.slice(start + "const TRIPS = ".length, end);
  // eslint-disable-next-line no-eval
  return eval(literal);
}

module.exports = { getClient, extractTrips };