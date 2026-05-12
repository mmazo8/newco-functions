// pages/api/parse-survey-simple.js
// Simplified endpoint: only needs plainText, loads form def from file

import { parseResponse } from "../../lib/surveyParser";
import { getFormDefinition } from "../../lib/formDefinition";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { plainText, userId, name } = req.body;

    if (!plainText) {
      return res.status(400).json({ error: "plainText is required" });
    }

    const formDef = getFormDefinition();

    const result = parseResponse(plainText, formDef, {
      userId: userId || "unknown",
      respondentName: name || null,
    });

    return res.status(200).json({
      success: true,
      webhook: result,
      meta: {
        answersCount: result.form_response.answers.length,
        parsedAt: new Date().toISOString(),
        respondent: name || "unknown",
      },
    });
  } catch (error) {
    console.error("Parse error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}