// lib/formDefinition.js
// Helper to load and cache the form definition from a local file
// Place your form definition JSON at: data/form-definition.json

import fs from "fs";
import path from "path";

let cached = null;

export function getFormDefinition() {
  if (cached) return cached;

  const filePath = path.join(process.cwd(), "data", "form-definition.json");
  const raw = fs.readFileSync(filePath, "utf8");
  cached = JSON.parse(raw);
  return cached;
}