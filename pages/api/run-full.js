// pages/api/run-full.js

import { parseResponse } from "../../lib/surveyParser";
import { getFormDefinition } from "../../lib/formDefinition";
import { transformToProfile } from "../../lib/profileTransformer";
import { runF1, findTrip } from "../../lib/al-v2_36";

export default function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      success: false,
      error: "Method not allowed",
    });
  }

  try {
    const { plainText, userId } = req.body;

    if (!plainText) {
      return res.status(400).json({
        success: false,
        error: "plainText required",
      });
    }

    // Step 1: Parse plain text survey response into Typeform-style webhook JSON
    const formDef = getFormDefinition();

    const webhookJson = parseResponse(plainText, formDef, {
      userId: userId || "unknown",
    });

    // Step 2: Transform webhook JSON into AL profile
    const profile = transformToProfile(webhookJson);

    // Step 3: Run F1 engine
    const f1Result = runF1(profile);

    const DISCLOSURE_FLAGS = [
      "fear_snakes",
      "fear_heights",
      "left_side_driving",
      "right_side_driving",
    ];

    const enrichTrip = (abbr) => {
      const trip = findTrip(abbr);

      if (!trip) {
        return {
          trip: abbr,
        };
      }

      const rawFlags = f1Result.gates?.g13?.flags?.[abbr] || [];

      const flags = rawFlags.filter(
        (flag) => !DISCLOSURE_FLAGS.includes(flag)
      );

      let ff = null;

      if (flags.includes("friends_family")) {
        const overlap = (profile.friendsFamilyCountries || []).filter(
          (country) =>
            trip.spineCountries?.some(
              (spineCountry) =>
                spineCountry.toLowerCase() === country.toLowerCase()
            )
        );

        if (overlap.length > 0) {
          ff = overlap.join(", ");
        }
      }

      return {
        trip: abbr,
        name: trip.name,
        tier: trip.type === "Big4" ? "B4" : `T${trip.tier}`,
        type: trip.type,
        region: trip.region,
        flags: flags.filter((flag) => flag !== "friends_family"),
        ff,
        spineCountries: trip.spineCountries,
      };
    };

    return res.status(200).json({
      success: true,
      profile,
      top8: f1Result.top8.map(enrichTrip),
      next5: f1Result.next5.map(enrichTrip),
      gates: {
        g1: {
          excluded: f1Result.gates?.g1?.excluded || [],
        },
        g2: f1Result.gates?.g2 || {},
        g4: {
          touchedRegions: f1Result.gates?.g4?.touchedRegions || [],
        },
        g10: {
          age: f1Result.gates?.g10?.age,
          band: f1Result.gates?.g10?.band,
          ypActive: f1Result.gates?.g10?.ypActive,
        },
        g17: f1Result.gates?.g17 || {},
      },
      webhook: webhookJson,
      answersCount: webhookJson.form_response?.answers?.length || 0,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}