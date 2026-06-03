// pages/index.js

import { useEffect, useState } from "react";

export default function Home() {
  const [activeTab, setActiveTab] = useState("parse");
  const [plainText, setPlainText] = useState("");
  const [userName, setUserName] = useState("");
  const [webhookPath, setWebhookPath] = useState("");
  const [output, setOutput] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Saved webhook files discovered from server
  const [savedFiles, setSavedFiles] = useState([]);

  // Load saved files on mount
  useEffect(() => {
    fetch("/api/list-files")
      .then((response) => response.json())
      .then((data) => setSavedFiles(data.files || []))
      .catch(() => {});
  }, []);

  const runParser = async () => {
    if (!plainText.trim()) return;

    setLoading(true);
    setError(null);
    setOutput(null);

    try {
      const response = await fetch("/api/parse-survey-simple", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plainText,
          userId: userName || "unknown",
          name: userName || "unknown",
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error);
      }

      setOutput({
        type: "parse",
        data,
      });
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const runEngine = async (filePath) => {
    const target = filePath || webhookPath;

    if (!target.trim()) return;

    setLoading(true);
    setError(null);
    setOutput(null);

    try {
      const response = await fetch("/api/run-engine", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          webhookPath: target,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error);
      }

      setOutput({
        type: "engine",
        data,
      });
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const runFull = async () => {
    if (!plainText.trim()) return;

    setLoading(true);
    setError(null);
    setOutput(null);

    try {
      const response = await fetch("/api/run-full", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          plainText,
          userId: userName || "unknown",
        }),
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error);
      }

      setOutput({
        type: "full",
        data,
      });
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>AL Travel Engine</h1>
        <p className="subtitle">
          Survey Parser → Profile → Trip Recommendations
        </p>
      </header>

      <nav className="tabs">
        <button
          className={`tab ${activeTab === "parse" ? "active" : ""}`}
          onClick={() => setActiveTab("parse")}
        >
          1. Parse Survey
        </button>

        <button
          className={`tab ${activeTab === "engine" ? "active" : ""}`}
          onClick={() => setActiveTab("engine")}
        >
          2. Run Engine
        </button>

        <button
          className={`tab ${activeTab === "full" ? "active" : ""}`}
          onClick={() => setActiveTab("full")}
        >
          Full Pipeline
        </button>
      </nav>

      <main className="main">
        {/* TAB 1: Parse Survey */}
        {activeTab === "parse" && (
          <div className="panel">
            <h2>Parse Plain Text Survey → Webhook JSON</h2>

            <div className="input-row">
              <label>User Name</label>
              <input
                type="text"
                value={userName}
                onChange={(event) => setUserName(event.target.value)}
                placeholder="e.g., corinne, sasha"
                className="input-small"
              />
            </div>

            <div className="input-row">
              <label>Plain Text Survey Response</label>
              <textarea
                value={plainText}
                onChange={(event) => setPlainText(event.target.value)}
                placeholder="Paste the full plain text survey response here..."
                rows={12}
                className="textarea"
              />
            </div>

            <button
              onClick={runParser}
              disabled={loading || !plainText.trim()}
              className="btn btn-primary"
            >
              {loading ? "Parsing..." : "Parse Survey"}
            </button>
          </div>
        )}

        {/* TAB 2: Run Engine */}
        {activeTab === "engine" && (
          <div className="panel">
            <h2>Run AL Engine on Webhook JSON</h2>

            {savedFiles.length > 0 && (
              <div className="saved-files">
                <label>Quick Select</label>

                <div className="file-buttons">
                  {savedFiles.map((file) => (
                    <button
                      key={file}
                      onClick={() => {
                        setWebhookPath(file);
                        runEngine(file);
                      }}
                      className="btn btn-file"
                    >
                      {file.split("/").pop().replace("-webhook.json", "")}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="input-row">
              <label>Webhook JSON Path</label>

              <div className="input-with-btn">
                <input
                  type="text"
                  value={webhookPath}
                  onChange={(event) => setWebhookPath(event.target.value)}
                  placeholder="data/test-responses/corinne-webhook.json"
                  className="input-full"
                />

                <button
                  onClick={() => runEngine()}
                  disabled={loading || !webhookPath.trim()}
                  className="btn btn-primary"
                >
                  {loading ? "Running..." : "Run Engine"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: Full Pipeline */}
        {activeTab === "full" && (
          <div className="panel">
            <h2>Full Pipeline: Plain Text → Top 8</h2>

            <div className="input-row">
              <label>User Name</label>
              <input
                type="text"
                value={userName}
                onChange={(event) => setUserName(event.target.value)}
                placeholder="e.g., corinne, sasha"
                className="input-small"
              />
            </div>

            <div className="input-row">
              <label>Plain Text Survey Response</label>
              <textarea
                value={plainText}
                onChange={(event) => setPlainText(event.target.value)}
                placeholder="Paste the full plain text survey response here..."
                rows={12}
                className="textarea"
              />
            </div>

            <button
              onClick={runFull}
              disabled={loading || !plainText.trim()}
              className="btn btn-primary"
            >
              {loading ? "Processing..." : "Run Full Pipeline"}
            </button>
          </div>
        )}

        {/* ERROR */}
        {error && (
          <div className="error-box">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* RESULTS */}
        {output && output.type === "parse" && (
          <ParseResults data={output.data} />
        )}

        {output && (output.type === "engine" || output.type === "full") && (
          <EngineResults data={output.data} />
        )}
      </main>
    </div>
  );
}

// ── Parse Results Component ──

function ParseResults({ data }) {
  const webhook = data.webhook;
  const answers = webhook?.form_response?.answers || [];

  const renderAnswerValue = (answer) => {
    if (answer.type === "number") {
      return <span className="num">{answer.number}</span>;
    }

    if (answer.type === "text") {
      return <span className="text">{answer.text}</span>;
    }

    if (answer.type === "choice") {
      return <span className="choice">{answer.choice?.label || ""}</span>;
    }

    return <span className="text">{JSON.stringify(answer)}</span>;
  };

  return (
    <div className="results">
      <h2>
        Parse Results
        <span className="badge">{data.meta?.answersCount} answers</span>
      </h2>

      <div className="answers-grid">
        {answers.map((answer, index) => (
          <div key={`${answer.field.id}-${index}`} className="answer-card">
            <div className="answer-type">{answer.field.type}</div>
            <div className="answer-id">{answer.field.id}</div>
            <div className="answer-value">{renderAnswerValue(answer)}</div>
          </div>
        ))}
      </div>

      <details className="raw-json">
        <summary>Raw Webhook JSON</summary>
        <pre>{JSON.stringify(webhook, null, 2)}</pre>
      </details>
    </div>
  );
}

// ── Engine Results Component ──

function EngineResults({ data }) {
  const { profile, top8, next5, gates, capDropped, closeCallCharts } = data;

  return (
    <div className="results">
      {/* Profile Summary */}
      <div className="profile-card">
        <h2>
          Profile: {profile?.residenceCity || "Unknown"}
          <span className="badge">Age {profile?.age}</span>
        </h2>

        <div className="profile-grid">
          <div className="profile-item">
            <label>Home</label>
            <span>
              {profile?.homeCountry} ({profile?.residenceCity})
            </span>
          </div>

          <div className="profile-item">
            <label>Visited</label>
            <span>{profile?.visitedCountries?.join(", ") || "none"}</span>
          </div>

          <div className="profile-item">
            <label>Languages</label>
            <span>
              {profile?.languages
                ?.map((language) => `${language.lang} (${language.level})`)
                .join(", ") || "none"}
            </span>
          </div>

          <div className="profile-item">
            <label>F/F Abroad</label>
            <span>{profile?.friendsFamilyCountries?.join(", ") || "none"}</span>
          </div>

          <div className="profile-item">
            <label>Exclusions</label>
            <span className="exclusions">
              {gates?.g1?.excluded?.join(", ") || "none"}
            </span>
          </div>

          <div className="profile-item">
            <label>YP Band</label>
            <span>
              {gates?.g10?.band} active: {String(gates?.g10?.ypActive)}
            </span>
          </div>
        </div>

        <div className="profile-scores">
          <div className="score-row">
            <ScoreBadge label="Hiking" value={profile?.hiking} max={5} />
            <ScoreBadge label="Backpack" value={profile?.backpacking} max={5} />
            <ScoreBadge
              label="Wildlife"
              value={profile?.wildlife_interest}
              max={10}
            />
            <ScoreBadge
              label="Perf Arts"
              value={profile?.performing_arts}
              max={10}
            />
            <ScoreBadge label="Art" value={profile?.art} max={5} />
            <ScoreBadge
              label="History"
              value={profile?.history_rating}
              max={5}
            />
            <ScoreBadge
              label="Extrovert"
              value={profile?.extrovert}
              max={10}
              warn={true}
            />
            <ScoreBadge label="Fitness" value={profile?.fitness} max={10} />
            <ScoreBadge label="Outdoors" value={profile?.outdoors} max={10} />
          </div>

          <div className="score-row">
            <ScoreBadge
              label="Beaches"
              value={profile?.landscapes?.beaches}
              max={10}
            />
            <ScoreBadge
              label="Mountains"
              value={profile?.landscapes?.mountains}
              max={10}
            />
            <ScoreBadge
              label="Lakes"
              value={profile?.landscapes?.lakes}
              max={10}
            />
            <ScoreBadge
              label="Vineyards"
              value={profile?.landscapes?.vineyards}
              max={10}
            />
            <ScoreBadge
              label="Deserts"
              value={profile?.landscapes?.deserts}
              max={10}
            />
            <ScoreBadge
              label="Forests"
              value={profile?.landscapes?.forests}
              max={10}
            />
            <ScoreBadge
              label="Rainforests"
              value={profile?.landscapes?.rainforests}
              max={10}
            />
          </div>

          <div className="score-row">
            <ScoreBadge label="Snorkel" value={profile?.snorkeling} max={5} />
            <ScoreBadge label="Scuba" value={profile?.scuba} max={5} />
            <ScoreBadge label="Sailing" value={profile?.sailing} max={5} />
            <ScoreBadge label="Camping" value={profile?.camping} max={5} />
            <ScoreBadge label="Fishing" value={profile?.fishing} max={5} />
            <ScoreBadge label="Kayak" value={profile?.kayaking} max={5} />
          </div>
        </div>
      </div>

      {/* Top 8 + Next 5 */}
      <div className="trips-section">
        <h2>Top 8</h2>

        <div className="trip-list">
          {top8?.map((trip, index) => (
            <TripCard
              key={`${trip.trip}-${index}`}
              rank={index + 1}
              trip={trip}
              isTop8={true}
            />
          ))}
        </div>

        <h2>Next 5</h2>

        <div className="trip-list">
          {next5?.map((trip, index) => (
            <TripCard
              key={`${trip.trip}-${index}`}
              rank={index + 9}
              trip={trip}
              isTop8={false}
            />
          ))}
        </div>
      </div>

      {/* Continent Status */}
      {gates?.g4 && (
        <div className="continent-status">
          <h3>Continent Status</h3>

          <div className="continent-grid">
            {[
              "Europe",
              "Asia",
              "SSA",
              "South America",
              "Oceania",
              "North America",
              "MENA",
            ].map((region) => {
              const touched = gates.g4.touchedRegions?.includes(region);
              const isHome = gates.g2?.homeRegion === region;

              return (
                <div
                  key={region}
                  className={`continent-badge ${
                    isHome ? "home" : touched ? "touched" : "untouched"
                  }`}
                >
                  <span className="continent-name">{region}</span>
                  <span className="continent-label">
                    {isHome ? "HOME" : touched ? "TOUCHED" : "UNTOUCHED"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Close Calls */}
      {closeCallCharts && closeCallCharts.length > 0 && (
        <div className="close-calls">
          <h3>Close Call Charts</h3>

          {closeCallCharts.map((closeCall, index) => (
            <div key={index} className="close-call-card">
              <div className="cc-header">
                ⚡ {closeCall.challenger} vs {closeCall.holder}
              </div>

              <div className="cc-body">
                <div className="cc-col">
                  <strong>Holder: {closeCall.holder}</strong>
                  <div>Flags: {closeCall.holderFlags}</div>
                  <div>F/F: {closeCall.holderFF || "none"}</div>
                </div>

                <div className="cc-col">
                  <strong>Challenger: {closeCall.challenger}</strong>
                  <div>Flags: {closeCall.challengerFlags}</div>
                  <div>F/F: {closeCall.challengerFF || "none"}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cap Dropped */}
      {capDropped && capDropped.length > 0 && (
        <details className="raw-json">
          <summary>Cap Dropped</summary>
          <pre>{JSON.stringify(capDropped, null, 2)}</pre>
        </details>
      )}

      {/* Raw gate logs */}
      <details className="raw-json">
        <summary>Raw Gate Logs</summary>
        <pre>{JSON.stringify(gates, null, 2)}</pre>
      </details>

      <details className="raw-json">
        <summary>Full Profile JSON</summary>
        <pre>{JSON.stringify(profile, null, 2)}</pre>
      </details>
    </div>
  );
}

// ── Score Badge Component ──

function ScoreBadge({ label, value, max, warn }) {
  const pct = max > 0 ? (value || 0) / max : 0;

  let color = "score-low";

  if (pct >= 0.7) {
    color = "score-high";
  } else if (pct >= 0.4) {
    color = "score-mid";
  }

  return (
    <div className={`score-badge ${color} ${warn ? "score-warn" : ""}`}>
      <span className="score-label">{label}</span>
      <span className="score-value">
        {value || 0}/{max}
      </span>
    </div>
  );
}

// ── Trip Card Component ──

function TripCard({ rank, trip, isTop8 }) {
  return (
    <div className={`trip-card ${isTop8 ? "top8" : "next5"}`}>
      <div className="trip-rank">#{rank}</div>

      <div className="trip-info">
        <div className="trip-name">{trip.trip}</div>

        <div className="trip-meta">
          <span className="trip-tier">{trip.tier}</span>
          <span className="trip-region">{trip.region}</span>
          {trip.type && <span className="trip-type">{trip.type}</span>}
        </div>

        {trip.flags && trip.flags.length > 0 && (
          <div className="trip-flags">
            {trip.flags.map((flag) => (
              <span key={flag} className="flag-tag">
                {flag}
              </span>
            ))}
          </div>
        )}

        {trip.cities && trip.cities.length > 0 && (
          <div className="trip-cities">
            Cities: {trip.cities.join(", ")}
          </div>
        )}

        {trip.ff && <div className="trip-ff">F/F: {trip.ff}</div>}
      </div>
    </div>
  );
}