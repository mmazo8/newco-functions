// scripts/seed-trips.js
// Seeds the static 34-trip catalog into Supabase's `trips` table.
// Run once (re-running is safe — it upserts on abbr).
//
// Usage:
//   node -r dotenv/config scripts/seed-trips.js
//
// After seeding, open the `trips` table in Supabase and fill in
// bubble_trip_id for each row to map to your Bubble trip records.

const { getClient, extractTrips } = require("./supabase/client");

async function main() {
  const supabase = getClient();
  const trips = extractTrips();

  const rows = trips.map((t) => ({
    abbr: t.abbr,
    trip_id: t.id,
    name: t.name,
    tier: t.tier,
    type: t.type,
    region: t.region,
    spine_countries: t.spineCountries,
    exp_category: t.expCategory,
    wildlife_core: t.wildlifeCore,
    // bubble_trip_id intentionally omitted — you fill it in Supabase.
    // Upsert will NOT overwrite an existing bubble_trip_id because we
    // don't send the column (ignoreDuplicates:false still only touches
    // the columns provided).
  }));

  const { error } = await supabase
    .from("trips")
    .upsert(rows, { onConflict: "abbr" });

  if (error) {
    console.error("Seed failed:", error.message);
    process.exit(1);
  }

  console.log(`✓ Seeded ${rows.length} trips into Supabase.`);
}

main();