// pages/api/chat.js
// ─────────────────────────────────────────────────────────────────────────
// THE ADVISOR endpoint — conversational layer over the ranking engine.
//
// Bubble calls this when a user is selected and types a message. It:
//   1. Loads that user's stored engine run from Supabase (profile + ranked
//      trips), written earlier by scripts/load-user.js.
//   2. Builds a grounded system prompt (lib/chatbot/guidance.js).
//   3. Calls the Anthropic API and returns the reply text.
//
// The engine has ALREADY ranked the trips; this endpoint never re-ranks.
//
// Request body (POST, JSON):
//   {
//     "userId": "sasha",
//     "message": "what do you recommend for beach trips?",
//     "history": [ { "role": "user"|"assistant", "content": "..." }, ... ]   // optional
//   }
//
// Response:
//   { "success": true, "reply": "...", "userId": "sasha" }
//
// Env vars required (set in .env.local / hosting env, NEVER in Bubble):
//   ANTHROPIC_API_KEY
//   SUPABASE_URL
//   SUPABASE_ANON_KEY            (read-only; RLS read policies already in place)

const { createClient } = require("@supabase/supabase-js");
const { buildSystemPrompt } = require("../../lib/chatbot/guidance");

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 1024;
const MAX_HISTORY_TURNS = 12; // keep context bounded

function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

// Load the stored run + ranked trips for one user.
async function loadUserContext(supabase, userId) {
  // profile + display name
  const [{ data: runRow, error: runErr }, { data: userRow, error: userErr }] =
    await Promise.all([
      supabase
        .from("user_runs")
        .select("profile")
        .eq("user_id", userId)
        .single(),
      supabase
        .from("users")
        .select("name")
        .eq("user_id", userId)
        .single(),
    ]);

  if (runErr) throw new Error(`Could not load profile for "${userId}": ${runErr.message}`);

  // ranked trips for this user.
  const { data: tripRows, error: tripErr } = await supabase
    .from("user_trips")
    .select("abbr, bucket, rank, tier_label, flags, ff")
    .eq("user_id", userId)
    .order("rank", { ascending: true });

  if (tripErr) throw new Error(`Could not load trips for "${userId}": ${tripErr.message}`);

  // Fetch the static catalog separately and merge on abbr. This avoids
  // depending on a PostgREST FK embed between user_trips and trips (the
  // existing Bubble join uses bubble_trip_id, so the abbr FK may not exist).
  const abbrs = [...new Set((tripRows || []).map((r) => r.abbr))];
  let catalog = {};
  if (abbrs.length) {
    const { data: catRows, error: catErr } = await supabase
      .from("trips")
      .select("abbr, name, region, spine_countries")
      .in("abbr", abbrs);
    if (catErr) throw new Error(`Could not load trip catalog: ${catErr.message}`);
    catalog = Object.fromEntries((catRows || []).map((c) => [c.abbr, c]));
  }

  const shape = (r) => {
    const c = catalog[r.abbr] || {};
    return {
      trip: r.abbr,
      name: c.name || r.abbr,
      region: c.region || null,
      spineCountries: c.spine_countries || [],
      tier: r.tier_label || null,
      flags: r.flags || [],
      ff: r.ff || null,
    };
  };

  const top8 = (tripRows || []).filter((r) => r.bucket === "top8").map(shape);
  const next5 = (tripRows || []).filter((r) => r.bucket === "next5").map(shape);

  return {
    profile: runRow?.profile || {},
    name: userRow?.name || userId,
    top8,
    next5,
  };
}

// Normalize incoming history to the Anthropic messages shape, bounded.
function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter(
      (m) =>
        m &&
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim()
    )
    .slice(-MAX_HISTORY_TURNS)
    .map((m) => ({ role: m.role, content: m.content }));
}

module.exports = async function handler(req, res) {
  // CORS — Bubble calls this from the browser/server; allow it.
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") {
    return res.status(405).json({ success: false, error: "Method not allowed" });
  }

  try {
    const { userId, message, history } = req.body || {};

    if (!userId || typeof userId !== "string") {
      return res.status(400).json({ success: false, error: "userId required" });
    }
    if (!message || typeof message !== "string" || !message.trim()) {
      return res.status(400).json({ success: false, error: "message required" });
    }
    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ success: false, error: "Server missing ANTHROPIC_API_KEY" });
    }

    // 1. Load this user's stored engine output.
    const supabase = getSupabase();
    const ctx = await loadUserContext(supabase, userId);

    // 2. Build grounded system prompt + message list.
    const systemPrompt = buildSystemPrompt(ctx);
    const messages = [
      ...sanitizeHistory(history),
      { role: "user", content: message.trim() },
    ];

    // 3. Call the Anthropic API.
    const apiResp = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: systemPrompt,
        messages,
      }),
    });

    if (!apiResp.ok) {
      const detail = await apiResp.text();
      return res
        .status(502)
        .json({ success: false, error: `Anthropic API error (${apiResp.status})`, detail });
    }

    const data = await apiResp.json();
    const reply = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return res.status(200).json({
      success: true,
      userId,
      reply: reply || "(no response)",
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
}