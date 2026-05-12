// pages/api/parse-survey.js (Next.js API route)

import { parseResponse } from "../../lib/surveyParser";

// The form definition would be loaded once — either from a file or env
// For now we'll expect it posted alongside the text, or loaded from a static file
let cachedFormDef = null;

export const config = {
  api: {
    bodyParser: {
      sizeLimit: "4mb", // form definition is large
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { plainText, formDefinition, options } = req.body;

    if (!plainText) {
      return res.status(400).json({ error: "plainText is required" });
    }

    // Use provided form definition, or cached, or return error
    const formDef = formDefinition || cachedFormDef;
    if (!formDef) {
      return res.status(400).json({
        error: "formDefinition is required (provide in body or pre-load)",
      });
    }

    // Cache for subsequent requests
    if (formDefinition && !cachedFormDef) {
      cachedFormDef = formDefinition;
    }

    const result = parseResponse(plainText, formDef, options || {});

    return res.status(200).json({
      success: true,
      webhook: result,
      meta: {
        answersCount: result.form_response.answers.length,
        parsedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Parse error:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
}