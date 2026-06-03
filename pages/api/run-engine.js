// pages/api/run-engine.js

import fs from "fs";
import path from "path";
import { transformToProfile } from "../../lib/profileTransformer";
import {
  runF1,
  findTrip,
  PRIMARY_YP,
  SECONDARY_YP,
} from "../../lib/al-v2_36";

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { webhookPath } = req.body;
    const fullPath = path.resolve(process.cwd(), webhookPath);

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ success: false, error: `File not found: ${webhookPath}` });
    }

    const webhookJson = JSON.parse(fs.readFileSync(fullPath, "utf8"));
    const profile = transformToProfile(webhookJson);
    const f1Result = runF1(profile);

    // Build enriched trip data for the UI
    const DISCLOSURE_FLAGS = [
      "fear_snakes", "fear_heights",
      "left_side_driving", "right_side_driving",
    ];

    const enrichTrip = (abbr) => {
      const trip = findTrip(abbr);
      if (!trip) return { trip: abbr };

      const flags = (f1Result.gates.g13.flags[abbr] || []).filter(
        (f) => !DISCLOSURE_FLAGS.includes(f)
      );

      const cities = [];
      const ESSENTIAL_CITIES = {
        London: "Top4", Paris: "Top4", "New York": "Top4", Tokyo: "Top4",
        "San Francisco": "Top10", "Washington DC": "Top10", Madrid: "Top10",
        Rome: "Top10", Amsterdam: "Top10", Sydney: "Top10",
        Seoul: "Top25", Beijing: "Top25", "Cape Town": "Top25",
        Milan: "Top25", Shanghai: "Top25", "Hong Kong": "Top25",
        "Los Angeles": "Top25", "Buenos Aires": "Top25", Rio: "Top25",
        "Mexico City": "Top25", Barcelona: "Top25", Berlin: "Top25",
        Cairo: "Top25", Istanbul: "Top25", Bangkok: "Top25", Athens: "Top25",
      };

      // Get F/F
      let ff = null;
      if (flags.includes("friends_family")) {
        const overlap = (profile.friendsFamilyCountries || []).filter((c) =>
          trip.spineCountries.some(
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
        cities,
        ff,
        spineCountries: trip.spineCountries,
        expCategory: trip.expCategory,
      };
    };

    const top8 = f1Result.top8.map(enrichTrip);
    const next5 = f1Result.next5.map(enrichTrip);

    return res.status(200).json({
      success: true,
      profile,
      top8,
      next5,
      gates: {
        g1: { excluded: f1Result.gates.g1.excluded, log: f1Result.gates.g1.log },
        g2: f1Result.gates.g2,
        g3: { results: f1Result.gates.g3.results },
        g4: { touchedRegions: f1Result.gates.g4.touchedRegions },
        g10: { age: f1Result.gates.g10.age, band: f1Result.gates.g10.band, ypActive: f1Result.gates.g10.ypActive },
        g13: { flagCounts: f1Result.gates.g13.flagCounts },
        g17: f1Result.gates.g17,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}