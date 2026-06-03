
// ═══════════════════════════════════════════════════════════════════
// AL SPECIFICATION v2.36 — TRAVEL RECOMMENDATION ENGINE
// Pure computation engine. No UI. Profiles and activity table
// passed at runtime.
// ═══════════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────────
// CHANGELOG (v2.25 → v2.26)
// ─────────────────────────────────────────────────────────────────
// v2.26  | Bake-in of 15 patches accumulated against v2.25.
//        |
//        | (1) printF2CloseCallCharts: scan ALL pairs (i, j) where
//        |     i < j in the ranked list, not just adjacent (i, i+1).
//        |     Triggers unchanged. Surfaces non-adjacent anomalies.
//        |
//        | (2) Gate 3 footer additions (printF2GateFooter, new):
//        |     Gate-passing count line + Exotic Island position
//        |     check (FP/Seychelles must be at last position).
//        |
//        | (3) Adaptation Add for Near Misses (f2Gate1 post-pass):
//        |     Promotes NEAR_MISS trips to PASS via sub-500mi
//        |     ADAPT entries on absent wants. Distance parsed from
//        |     ADAPT text via regex /~(\d[\d,]*)\s*mi/g — see
//        |     FUTURE WORK note. Metadata: { adaptationAdd,
//        |     adaptationAddWants, adaptationAddScore,
//        |     adaptationAddPassed, adaptationAddWscore,
//        |     adaptationAddBreakdown, priorStatus }.
//        |
//        | (4) Profile header section (printProfileHeader, new):
//        |     Renders Residence (city + state + country + region),
//        |     home region exclusions, age + YP band, Exotic Island
//        |     selection, continent status. Called before Gate 1.
//        |
//        | (5) Per-Trip Citation Report (printAdaptExtendReport,
//        |     completely rewritten): per-want format
//        |     "want: TIER (rating) — on-spine text" with ADAPT/
//        |     EXTEND indented. Trip headers surface rescue/
//        |     promotion metadata.
//        |
//        | (6) Visited-country warning (f2Gate1 post-pass): for
//        |     every PASS trip, emits ONE warning per visited spine
//        |     country with "DEFAULT: demote to Near Misses."
//        |     Advisory only. Field: visitedSpineWarning.
//        |
//        | (7) Weighted Score (wscore) computation in f2Gate1:
//        |     WC=6, NWC=4, absent=0 (NWC differs from raw score).
//        |     Stored on each result with breakdown array.
//        |     Recomputed for variants and Adaptation Add. See
//        |     DUAL SCORING CONVENTION below.
//        |
//        | (8) Balancing Test (printBalancingTest, new): emits
//        |     wscore breakdown table + NOTE for any pair where
//        |     lower-ranked trip has higher wscore than
//        |     higher-ranked trip. Suppresses when higher trip
//        |     is protected by Exception 1 (Big 4) or Exception 2
//        |     (T1 SD + untouched continent + Primary YP).
//        |
//        | (9) f2Gate1 signature change:
//        |     f2Gate1(wants, activityTable) →
//        |     f2Gate1(wants, activityTable, profile)
//        |     Profile needed for visited-country warning pass and
//        |     unconditional flag table. runF2 signature unchanged
//        |     externally — passes profile through.
//        |
//        | (10) Per-trip unconditional advisory flags
//        |      (UNCONDITIONAL_FLAGS table in f2Gate1): emits
//        |      structural advisories whenever a trip reaches PASS
//        |      regardless of query content. Currently:
//        |      • Australia: LOGISTICAL BURDEN trip
//        |        (Melbourne→Cairns→Sydney internal flight chain).
//        |      Extensible — add entries as CP grows.
//        |
//        | (11) Australia comparison line (printAustraliaComparison,
//        |      new): when Australia in F2 ranked list, emits
//        |      indented follow-up listing all other ranked trips
//        |      with wscore ≥ Australia's wscore + CP guidance.
//        |
//        | (12) Removed: Full-Score Override analysis. CP v2.13
//        |      replaces it with the F2 Weighted Score Ranking +
//        |      Balancing Test framework. The Balancing Test
//        |      exception filter mirrors the former Full-Score
//        |      Override protective logic exactly.
//        |
//        | (13) Profile schema additions: residenceCity (optional
//        |      string) — surfaces in printProfileHeader for AIQC's
//        |      locator.
//        |
//        | (14) Per-Trip Citation Report parses fg3.log for
//        |      "blocked by" / "excluded by" patterns to surface
//        |      block reasons on trip headers. See FUTURE WORK note.
//        |
//        | (15) f2Gate3 ranking integrity preserved. The all-pairs
//        |      CLOSE_CALL scan and the Balancing Test scan both
//        |      consume the same ranked list from f2Gate3.ranked —
//        |      no changes to f2Gate3's ranking logic itself.
//        |      Adaptation-Add-promoted trips flow through Gate 2
//        |      and Gate 3 via the standard PASS classification.
//        |
// ─────────────────────────────────────────────────────────────────
// CHANGELOG (v2.26 → v2.27)
// ─────────────────────────────────────────────────────────────────
// v2.27  | Post-bake-in patches to printBalancingTest:
//        |
//        | (1) Blocking Power Classification table: emitted before
//        |     lockout checks and wscore NOTEs. Classifies each
//        |     ranked trip as Level 1 (Big 4), Level 2 (trifecta:
//        |     T1 + untouched continent + Primary YP + in-band),
//        |     Level 3 (Primary YP, touched continent), or None.
//        |     Appends structural notes for Australia (logistical
//        |     burden) and FP/Seychelles (Exotic Island subordinated).
//        |
//        | (2) Pre-computed Primary YP lockout checks: for every
//        |     pair where a non-Primary-YP trip is ranked above a
//        |     Level 3 Primary YP trip, emits the four-condition
//        |     check (all WC, more wants, unvisited country/
//        |     untouched continent, wscore gap ≥6) with per-
//        |     condition YES/NO and final verdict (OVERCOME/HOLDS).
//        |     Short-circuits on first failure.
//        |
//        | (3) One-way ratification wscore NOTEs: replaces simple
//        |     "AIQC: apply Balancing Test" with structured format.
//        |     When no override factors exist: "Wscore governs."
//        |     When factors exist: names them explicitly with
//        |     "AIQC may override ONLY using these factors."
//        |     Australia pairs include "logistical burden trigger
//        |     active" counter-factor.
//
// ─────────────────────────────────────────────────────────────────
// CHANGELOG (v2.27 → v2.28)
// ─────────────────────────────────────────────────────────────────
// v2.28  | Bake-in of close-call chart patches (Patches 1–3) plus
//        | post-patch fixes accumulated against v2.27.
//        |
//        | (1) printAustraliaComparison: now prints its output
//        |     directly via console.log instead of returning an
//        |     array. Consistent with all other print* functions.
//        |
//        | (2) Door analysis block in close-call charts: emitted
//        |     after Prior lines when Prior status is asymmetric
//        |     (NEW/Light vs SIMILAR). Shows expCategory, prior
//        |     trip count, max-rated alignment flags for the
//        |     NEW/Light trip, and T8 redundancy for the SIMILAR
//        |     trip. Applied to both printCloseCallCharts and
//        |     printCapDropped.
//        |
//        | (3) Prior label rename: FAMILIAR → SIMILAR in
//        |     priorExpDesc (both renderers).
//        |
//        | (4) Cancellation block: emitted for every close-call
//        |     chart. Surfaces shared flags + structural factors
//        |     that cancel, plus unique flags per trip with
//        |     contextual spine destinations and T8 redundancy
//        |     counts (e.g. "redundant on T8 — 4 providers").
//        |
//        | (5) SA Pairing BINDING: when Patagonia vs B&A appears
//        |     as a close-call and Peru is on T8, checks if
//        |     hiking + backpacking are at 0-5 personal max and
//        |     mountains at 0-10 personal max. If so, emits
//        |     binding directive: Patagonia replaces B&A on T8,
//        |     B&A to Next 5, Patagonia LOCKED at last T8
//        |     position, Function 15 lock. The Patagonia vs B&A
//        |     close-call chart is suppressed.
//        |
//        | (6) Discovery presumption: when Door analysis shows
//        |     NEW (0 prior) vs SIMILAR (4+ prior) and the NEW
//        |     trip has 2+ max-rated alignment flags, emits
//        |     binding presumption that tier and essential cities
//        |     alone cannot overcome.
//        |
//        | (7) Hammer (binding): when cancellation residuals
//        |     show one trip has a higher-ranked essential city
//        |     AND an unserved dimension (0 T8 providers,
//        |     including friends_family as structural dimension)
//        |     while the other trip's only non-redundant unique
//        |     advantage is tier, emits binding directive:
//        |     challenger replaces holder on T8, Function 15
//        |     lock. The close-call chart is suppressed. Position
//        |     accounts for SA Pairing lock when active.
//
// ─────────────────────────────────────────────────────────────────
// CHANGELOG (v2.28 → v2.29)
// ─────────────────────────────────────────────────────────────────
// v2.29  | Gate 15 integrated mechanisms and N5 deliberate curation.
//        |
//        | (1) Mechanism 1 — SA Three-Way Fork: profile-driven
//        |     selection of second SA trip after Peru. Forks to
//        |     Patagonia (hiking/backpacking/mountains/outdoors),
//        |     Galápagos (wildlife + marine field + scuba/snorkel),
//        |     or B&A (extrovert ≥6 or beaches ≥6). Tiebreak:
//        |     Patagonia under 30, then Galápagos, then B&A.
//        |
//        | (2) Mechanism 2 — Asia SE Asia Default: for under-30
//        |     travelers, SE Asia defaults as second Asia slot
//        |     unless profile is SE-Asia-hostile (beaches ≤2 AND
//        |     extrovert ≤3 AND snorkeling ≤1 AND scuba ≤1).
//        |
//        | (3) Mechanism 3 — Tanzania Opportunity Cost: when SSA
//        |     is touched, CAf is eliminated, and 3+ continents
//        |     are untouched, Tanzania removed from T8. Best N5
//        |     candidate promoted (excludes mechanicallyDisplaced).
//        |
//        | (4) Mechanism 4 — ISE Hammer: cancellation-based swap.
//        |     Cancels shared flags between ISE and opponent, then
//        |     checks if opponent's unique residuals are all
//        |     redundant (3+ other T8 providers). Fires when ISE
//        |     has F/F advantage and/or Top 4 city advantage.
//        |     Requires UK not visited.
//        |
//        | (5) Mechanism 5 — Language Proficiency Elevation:
//        |     ensures proficient/native non-English language trips
//        |     get N5 representation. Safety net for M6.
//        |
//        | (6) Mechanism 6 — N5 Second Pass (Deliberate Curation):
//        |     rebuilds N5 from scratch scoring every eligible trip.
//        |     Weights: Primary YP 60, Secondary YP 40, F/F 50,
//        |     language pure immersion 100, mixed immersion 70,
//        |     Top 4 city 40, Top 10 city 25, Top 25 city 10,
//        |     2YP + Top 10 city interaction +25 (under 30),
//        |     untouched continent 15, tier 1 bonus 15,
//        |     alignment flags 2× count, dual IC/YP +10,
//        |     Australia burden −35.
//        |
//        | (7) Post-mechanism re-sort: judgment-call zone sorted
//        |     with Primary YP (3) > dual IC/YP (2) > plain
//        |     Secondary YP (1). SA Fork entries sort last.
//        |
//        | (8) Profile schema: motivationPrimary, outdoors, major,
//        |     fieldOfWork added.
//        |
//        | (9) Display-layer guards: SA Pairing and ISE hammer
//        |     display output suppressed when Gate 15 mechanisms
//        |     already performed the swap.
//        |
//        | (10) Athens added to ESSENTIAL_CITIES (Top 25, Greece).
//
// ─────────────────────────────────────────────────────────────────
// CHANGELOG (v2.29 → v2.30)
// ─────────────────────────────────────────────────────────────────
// v2.30  | Bake-in of patches accumulated against v2.29.
//        | Consolidates Gate 15 mechanism additions and the F2
//        | post-sort reordering pass into a single clean baseline.
//        |
//        | === Gate 15 (F1) changes ===
//        |
//        | (1) SA Fork Path 1 — Maximum-hiking qualifier.
//        |     Patagonia now qualifies via TWO paths:
//        |       Path 1: hiking ≥ 5 AND fitness ≥ 7
//        |               (serious hiker, no backpacking required)
//        |       Path 2: hiking ≥ 4 AND backpacking ≥ 4
//        |               AND mountains ≥ 7 AND outdoors ≥ 8
//        |               (existing outdoor-adventurer threshold)
//        |     Path 1 captures profiles like Corinne (refugio-to-
//        |     refugio hikers) without requiring backpacking. Path
//        |     2 preserves prior behavior for Will/Sasha-type
//        |     adventurers.
//        |
//        | (2) MENA Mature Premium Elevation (new Mechanism, runs
//        |     between Mechanism 5 and the post-mechanism re-sort).
//        |     For travelers age ≥ 30 with cultural/logistical
//        |     travel maturity (SSA touched OR India visited),
//        |     MENA may displace the weakest European T8 trip.
//        |     Scores Euro T8 trips by: essential-city tier
//        |     (Top 4 = 40, Top 10 = 25, Top 25 = 10), F/F (+30),
//        |     dual IC/YP (+20), Primary IC (age-scaled), flag
//        |     count (×1). MENA scores: untouched continent +30,
//        |     essential cities by tier, flag count. MENA displaces
//        |     the weakest Euro trip if menaScore > weakestScore.
//        |     Sets `menaJustElevated` flag for downstream
//        |     coordination.
//        |
//        | (3) Age-scaled Primary IC bonus.
//        |     In MENA Mature Premium scoring, Primary IC bonus
//        |     scales with age: +25 when age ≥ 30, +15 otherwise.
//        |     Mature travelers value Primary IC trips more
//        |     heavily. Effect: protects Greece from MENA
//        |     displacement for 30+ profiles where Greece's IC
//        |     status anchors it above peer European SDs.
//        |
//        | (4) SA Fork pre-pass.
//        |     Before the post-mechanism re-sort, SA Fork entries
//        |     (Patagonia / Galápagos when Peru is on T8) sink to
//        |     the bottom of the non-Big4/non-PB region. Skips
//        |     past MENA when `menaJustElevated` is set, preserving
//        |     MENA's elevated slot. This guarantees SA Fork trips
//        |     land in the judgment zone for the SA-Fork-sorts-last
//        |     rule, regardless of where the SA Fork mechanism
//        |     originally inserted them.
//        |
//        | === F2 changes ===
//        |
//        | (5) Wscore scale change.
//        |     Per-want value: WC 5 → WC 6, NWC unchanged at 4.
//        |     Increases the WC/NWC gap from 1 to 2, sharpening
//        |     the distinction between high-peak partial coverage
//        |     and uniform NWC coverage. Updated in:
//        |       - f2Gate1 base scoring pass
//        |       - f2Gate1 variant rescue/enhancement pass
//        |       - f2Gate1 adaptation-add pass
//        |       - printBalancingTest header and breakdown labels
//        |       - all changelog and explanatory comments
//        |
//        | (6) Lockout condition (d) threshold scaled.
//        |     Primary YP lockout override condition (d): wscore
//        |     gap ≥ 5 → wscore gap ≥ 6. Reflects the new wscore
//        |     scale (preserves the "challenger needs ~one full WC
//        |     more than the Primary YP trip" semantics). Updated
//        |     in checkLockoutOverride and printBalancingTest
//        |     display.
//        |
//        | (7) F2 post-sort reordering pass (new in f2Gate3).
//        |     After the preliminary Gate 3 sort produces `ranked`,
//        |     a 9-step reordering pass produces the final
//        |     ranking:
//        |       Step 0: Declarations (f2g1Results,
//        |               visitedSpineClassification).
//        |       Step 1: G3 ELIMINATED handling — multi-country
//        |               spine all-visited removed; single-country
//        |               spine PRESUME QUALIFIED, competes as
//        |               clean.
//        |       Step 2: Visited-spine classification —
//        |               core-affected vs adaptation-corner.
//        |               Single-country fully-visited explicitly
//        |               left unclassified (presume qualified).
//        |       Step 3: Blocking-power map (Big4 = 1, Trifecta = 2,
//        |               Primary YP = 3, none = 99).
//        |       Step 4: getWscore helper — returns
//        |               adaptationAddWscore for adaptation-add
//        |               trips, adaptationWscore for rescued
//        |               trips, base wscore otherwise.
//        |       Step 5: Hedging math for core-affected trips.
//        |               Ceiling/floor/midpoint, with minimum
//        |               spread floor ≥ ceiling + max(2, ⌊n/3⌋)
//        |               and ceiling-biased midpoint
//        |               round(ceiling + (floor - ceiling)/3).
//        |               cleanTrips wscore-sorted descending so
//        |               cleanTrips.indexOf reflects natural
//        |               wscore position.
//        |       Step 6: Final sort — blocking power first, then
//        |               lockout override (Level 3 vs None),
//        |               then hedged-vs-clean midpoint comparison,
//        |               then wscore + structural tiebreaker
//        |               chain. Tiebreakers: structural score
//        |               (essential cities, YP, dual IC/YP, lang
//        |               match, F/F, tier), then passed count,
//        |               then WC count.
//        |       Step 6b: Rescued trips (passed === 0) sink below
//        |               self-qualifying trips.
//        |       Step 7: Australia logistical burden — demoted
//        |               below compact-routing trips of comparable
//        |               wscore. Skips rescued trips when
//        |               computing demotion target.
//        |       Step 8: Cap at 8 — overflow trips logged as
//        |               Near Misses.
//        |       Step 9: FP subordination — moves to last position
//        |               WITHIN the capped list (runs after cap so
//        |               FP doesn't get kicked when overflowing).
//        |
//        | (8) Display improvements.
//        |     - Effective wscore display: per-trip Gate 1
//        |       scoring shows `wscore=N→M(eff)` for adaptation-
//        |       add and rescued trips, where M is the
//        |       sort-relevant value used by getWscore. Plain
//        |       trips show `wscore=N`.
//        |     - Adaptation labels in F2 ranked list:
//        |       `(+Tarifa — Adapted)` for adaptation-add,
//        |       `(+Zanzibar — Rescued)` for rescued via variant.
//        |     - Single-country presume-qualified asterisk:
//        |       `Mexico*` with footnote explaining clarifying-
//        |       question semantics. Surfaces in runner output
//        |       only (not the engine).
//        |
//        | === Function-signature changes ===
//        |
//        | (9) f2Gate3 signature extended.
//        |     Was: f2Gate3(f2g2Result, gate4Results, gate13Result,
//        |       gate1Result, gate17Result, f1Top8)
//        |     Now: f2Gate3(f2g2Result, gate4Results, gate13Result,
//        |       gate1Result, gate17Result, f1Top8, profile, f2g1,
//        |       gate3Results)
//        |     New parameters thread profile (for age-30 lockout
//        |     check, language match, F/F), f2g1 (per-trip
//        |     scoring for hedging math), and gate3Results (for
//        |     ELIMINATED filtering in Step 1). runF2 updated
//        |     accordingly.
//
// ─────────────────────────────────────────────────────────────────
// CHANGELOG (v2.30 → v2.31)
// ─────────────────────────────────────────────────────────────────
// v2.31  | Bake-in of five fixes accumulated against v2.30. All
//        | changes localized to Gate 15 (mechanisms + post-mechanism
//        | re-sort). No F2 changes; no signature changes; no
//        | export changes.
//        |
//        | (1) MENA LANGUAGE_MATRIX correction.
//        |     LANGUAGE_MATRIX["MENA"] previously contained
//        |     `{ lang:"French", w:1 }` as a soft secondary
//        |     entry. None of MENA's spine countries (Turkey,
//        |     Jordan, Israel, Egypt) are French-speaking. The
//        |     soft entry could spuriously trigger language-match
//        |     bonuses for French-speaking travelers. Entry
//        |     removed; MENA now lists only Arabic (w:5).
//        |
//        | (2) Re-sort: independent YP and IC scoring.
//        |     The post-mechanism re-sort previously used a
//        |     three-tier shorthand (PriYP=3, dualIC/YP=2,
//        |     SecYP=1) that conflated the YP and IC dimensions
//        |     and bonus-bumped trips that happen to be both
//        |     Secondary YP and Primary IC. Replaced with two
//        |     independent scoring functions:
//        |       ypScore(abbr): Primary YP +20, Secondary YP +10
//        |       icScore(abbr): Primary IC age-scaled (+25 if
//        |         age≥30, else +15); Secondary IC +5
//        |     Combined as `ypScore(abbr) + icScore(abbr)` for
//        |     the comparator. Removed the `isDualICYP` helper.
//        |     Effect: distinct totals for trips like Greece
//        |     (1YP/1IC), Spain North (2YP/1IC), Scandinavia
//        |     (2YP only), Italy South (2YP/2IC).
//        |
//        | (3) SE Asia anchor — only when Mechanism 2 placed it.
//        |     The post-mechanism re-sort previously anchored
//        |     SE Asia at its current position whenever it was
//        |     in T8, advancing `judgmentStart` past it
//        |     unconditionally. This locked SE Asia and
//        |     everything before it out of the judgment zone
//        |     even when SE Asia entered T8 through normal SD
//        |     bucket sorting (not via Mechanism 2). Now gated
//        |     by a `seaPlacedByMech2` flag that is set only
//        |     inside Mechanism 2's swap-success branch. When
//        |     SE Asia enters T8 organically (e.g., for
//        |     under-30 SD-seeded profiles), it competes in the
//        |     judgment zone normally.
//        |
//        | (4) Untouched-above-touched promoted to primary sort
//        |     factor.
//        |     The "untouched continent above touched continent"
//        |     check was previously a tiebreaker after YP+IC.
//        |     Promoted to the primary differentiator (runs
//        |     immediately after the SA-Fork-sorts-last branch).
//        |     Untouched-continent trips now sort above touched-
//        |     continent trips regardless of YP+IC totals; YP+IC
//        |     differentiates only within the same continent-
//        |     status tier. Effect: MENA (untouched) jumps above
//        |     Greece/Spain North/SE Asia (touched) for
//        |     mature-traveler profiles where MENA was promoted
//        |     by Mechanism 6.
//        |
//        | (5) ypScore age suppression.
//        |     For travelers age ≥30, ypScore returns 0 for all
//        |     trips. Rationale: YP (young professional) tier
//        |     hooks address career-stage life-arc fit, which
//        |     becomes irrelevant once that life stage has
//        |     passed. Primary IC remains age-scaled upward
//        |     (+25 for ≥30 vs +15 for <30) to reflect mature
//        |     travelers' increased valuation of cultural
//        |     immersion. Effect: for over-30 profiles, Greece
//        |     and Spain North tie at IC=25 each; tier and flag
//        |     count then differentiate (Spain North 8 flags vs
//        |     Greece 3 flags → Spain North wins).
//
// ─────────────────────────────────────────────────────────────────
// CHANGELOG (v2.31 → v2.32)
// ─────────────────────────────────────────────────────────────────
// v2.32  | Five patches from synthetic case testing (Sasha D).
//        |
//        | (1) Canada moved to NO_CHECKOFF. Only the United States
//        |     checks off North America for continent-coverage
//        |     purposes. Canada and Mexico are peripheral visits
//        |     that do not capture the core exploratory value of
//        |     the continent, same precedent as Singapore for Asia
//        |     and Dubai for MENA. Affects non-American travelers
//        |     who have visited Canada but not the US — North
//        |     America remains UNTOUCHED for them.
//        |
//        | (2) Seychelles subordination in F2 Gate 3 Step 9.
//        |     Step 9 now reads gate17Result.selected to determine
//        |     which Exotic Island to subordinate, instead of
//        |     hardcoding FP. Fixes bug where Seychelles (selected
//        |     for European travelers) was not moved to last
//        |     position on the F2 main list.
//        |
//        | (3) Gate 7 European resident Big 4 ordering. When home
//        |     region is Europe, CC leads the Big 4 ordering
//        |     (CC → CA → CAf), mirroring the CE-first rule for
//        |     non-Europeans. CC is to Europeans what CE is to the
//        |     rest of the world — the highest priority Big 4 for
//        |     the mean European traveler.
//        |
//        | (4) European resident Euro floor in Gate 15. After the
//        |     post-mechanism re-sort, guarantees minimum one
//        |     European SD trip on T8 when the traveler's home
//        |     region is Europe. Selects the highest-ranking
//        |     eligible European SD per Gate 11 hierarchy and
//        |     displaces the weakest non-Big4/non-PB trip in the
//        |     judgment zone. Prevents untouched-continent flood
//        |     from pushing all European SDs off the T8 for
//        |     European residents who need at least one Euro slot.
//        |
//        | (5) Gate 7 cosmetic fix. Gate 7 now receives
//        |     gate1Result as a fourth parameter and filters
//        |     Gate 1 excluded trips from the eligible Big 4 list
//        |     before ordering. Fixes misleading log output where
//        |     excluded trips (e.g., CC for California residents)
//        |     appeared in Gate 7's ordered array despite being
//        |     dead on arrival. No downstream behavior change —
//        |     Gate 15 already filtered exclusions before
//        |     placement.
//
// ─────────────────────────────────────────────────────────────────
// CHANGELOG (v2.32 → v2.33)
// ─────────────────────────────────────────────────────────────────
// v2.33  | Three patches from synthetic case testing (Sasha J,
//        | Sasha D, Will regression fix).
//        |
//        | (1) Big 4 SD Blocking table and mechanism. SD trips
//        |     that deep-dive into a Big 4's spine countries are
//        |     blocked until that Big 4 is completed (eliminated
//        |     by Gate 3) or excluded (by Gate 1). Generalizes
//        |     the prior Tanzania/CAf-specific block into a
//        |     lookup table (BIG4_SD_BLOCKS) covering all four
//        |     Big 4s. CE blocks Italy North, Italy South,
//        |     Italy M&L, France South, ISE. CA blocks India
//        |     North, China East. CAf blocks Tanzania. CC blocks
//        |     SW Parks USA. CC does NOT block East Coast USA
//        |     (different headline of America, no spine overlap).
//        |     Applied in both T8 placement loop and cap-dropped
//        |     N5 displacement filter.
//        |
//        | (2) Mechanism 3 (Tanzania Opportunity Cost) rewrite.
//        |     Candidate pool broadened from current N5 contents
//        |     to ALL eligible non-T8 trips, eliminating order
//        |     sensitivity to upstream bucket placement. Scoring
//        |     weights rebalanced: untouched continent 100 → 30,
//        |     Australia logistical burden −35 (new), MENA age
//        |     suppression −30 for under-30 travelers (new).
//        |     Fixes regression where blocking India North via
//        |     Big 4 SD rule changed N5 contents at Mech 3
//        |     evaluation time, causing Australia to incorrectly
//        |     replace Scandinavia on Will's T8. Also prevents
//        |     MENA from displacing YP trips for young travelers
//        |     — YP urgency takes precedence over non-YP
//        |     untouched trips for in-band travelers.
//        |
//        | (3) Big 4 SD Blocking integrated into Mech 3 candidate
//        |     evaluation. Mech 3's broadened candidate pool
//        |     checks the BIG4_SD_BLOCKS table, preventing
//        |     blocked SDs from being promoted to fill Tanzania's
//        |     vacated slot.
//
// ─────────────────────────────────────────────────────────────────
// DUAL SCORING CONVENTION
// ─────────────────────────────────────────────────────────────────
// Two distinct scores live on each f2Gate1 result, serving
// different purposes. They MUST NOT be conflated:
//
//   raw `score` and `passed`
//     • Per-want value: WC=5, NWC=3, absent=0
//     • Sum stored as `score`
//     • Threshold counter `passed` = number of wants where the
//       value is ≥3 (i.e. NWC or WC)
//     • Drives PASS / NEAR_MISS / CNR status:
//         passed >= needed         → PASS
//         passed == needed - 1     → NEAR_MISS
//         passed < needed - 1      → CNR
//     • Drives F2 Close-Call charts (compares passed counts).
//     • Drives Adaptation Add promotion eligibility.
//
//   weighted `wscore`
//     • Per-want value: WC=6, NWC=4, absent=0
//     • Sum stored as `wscore`
//     • Per-want detail in `breakdown` array
//     • Drives the F2 Balancing Test ranking-anomaly detector.
//     • Distinguishes "uniform NWC coverage" trips (Costa Rica
//       at 12 = three NWCs) from "high-peak partial coverage"
//       trips (CAf at 12 = two WCs + one absent). Raw `score`
//       collapses these to similar values; wscore separates them.
//
// Why two scores: a trip with `passed: 3/3` may have a different
// wscore than a trip with `passed: 2/3`. Costa Rica passes 3/3 at
// wscore 12; CAf passes 2/3 at wscore 12 (two WCs tying three NWCs).
// Gate passage (passed count) and "weighted want coverage" (wscore)
// answer different questions. Both are needed because F2 has to (a)
// decide whether a trip is in the gate-passing set, and (b) raise
// anomalies when the gate-passing set's priority order disagrees with
// weighted
// coverage. A single metric collapses (a) and (b) into one number
// and loses information.
//
// ─────────────────────────────────────────────────────────────────
// CHANGELOG (v2.35 → v2.36)
// ─────────────────────────────────────────────────────────────────
// v2.36  | Oceanian traveler handling, F2 Adaptation Add fix.
//        | Four patches from Sasha A and F2 regression testing.
//        |
//        | (1) NZ PB strip for Oceania residents. In
//        |     unifiedScore, NZ loses its +60 Continental PB
//        |     bonus when the traveler's home region is
//        |     Oceania. NZ is a backyard trip for Australians
//        |     — same principle as CC excluded for Californians
//        |     and CE excluded for Europeans. NZ competes on
//        |     raw score without PB structural priority.
//        |
//        | (2) SE Asia virgin exception for Oceania residents.
//        |     In Gate 9, the VIRGIN_HARD_EXCLUDE on SE Asia
//        |     is waived when the traveler's home region is
//        |     Oceania. SE Asia is the backyard trip for
//        |     Australians — Bangkok is a 9-hour flight from
//        |     Sydney. Not the scary developing-world stretch
//        |     it would be for an American or Japanese virgin.
//        |
//        | (3) SE Asia pin to last T8 position for Oceanian
//        |     virgins. When SE Asia makes the T8 for an
//        |     Oceanian virgin, it is pinned to position 8 as
//        |     a personal statement: "on your radar because of
//        |     where you're from, but trips above it are
//        |     higher priority." Same mechanic as SA Fork pin.
//        |
//        | (4) F2 Adaptation Add extended to CNR trips. In
//        |     f2Gate1, the Adaptation Add post-pass now scans
//        |     CNR trips (status === "CNR") in addition to
//        |     NEAR_MISS trips. A trip with 0/3 base rating
//        |     but valid ADAPT entries on absent wants can now
//        |     be promoted to PASS. Fixes MENA +Dahab which
//        |     had 3 ADAPT entries within 500mi but was
//        |     invisible to the system because 0/3 base
//        |     classified it as CNR, and the Adaptation Add
//        |     only scanned NEAR_MISS. Now MENA +Dahab passes
//        |     at 3/3 adapted with wscore 18.
//
// ─────────────────────────────────────────────────────────────────
// CHANGELOG (v2.34 → v2.35)
// ─────────────────────────────────────────────────────────────────
// v2.35  | Language matrix, Gate 3 CA fix, 30+ traveler
//        | mechanisms. Six patches from Aaron case testing
//        | plus language matrix implementation.
//        |
//        | (1) Language scoring matrix implemented. New
//        |     LANG_SCORE_MATRIX constant and computeLangScore
//        |     helper function. Scaled by divisor 3 from raw
//        |     floor+duration framework values. Weights:
//        |     proficient/native W5 pure 33, W5 mixed 23,
//        |     W3 15, W1 8. Little bit: W5 pure 10, W5 mixed
//        |     7, W3 5, W1 3. Native language excluded (no
//        |     activation value). English excluded (lingua
//        |     franca, not a differentiator). Multiple
//        |     languages on same trip summed. Integrated as
//        |     additive factor in unifiedScore.
//        |
//        | (2) Gate 3 CA elimination logic. Japan visited alone
//        |     now eliminates CA. South Korea alone does not —
//        |     CA is adapted to Tokyo/Kyoto + extensions.
//        |     Japan IS Classic Asia; visiting Japan captures
//        |     the heart of the trip.
//        |
//        | (3) Italy North Primary Depth bonus for 30+
//        |     travelers. Italy North is the single most
//        |     important SD trip for 30+ travelers who haven't
//        |     been to Italy — near-PB urgency. When Italy
//        |     unvisited: +30. When Italy visited (Rome via CE)
//        |     but no Italy SD: age-scaled +15 (30-35), +20
//        |     (36-45), +30 (45+). Reflects escalating urgency
//        |     as the gap persists.
//        |
//        | (4) Europe cap raise for 30+ with 3+ unvisited 1IC
//        |     countries in Gate 6. When traveler is 30+ and
//        |     has 3 or more unvisited Primary IC countries
//        |     (Italy, Spain, Greece, Switzerland), Europe cap
//        |     raises to min(2 + count, 4). Allows catching up
//        |     on fundamental European basics. Threshold of 3
//        |     prevents triggering for travelers like Corinne
//        |     with only 2 unvisited 1IC countries whose
//        |     existing cap of 2 is sufficient.
//        |
//        | (5) SA Fork Galápagos qualification gate revised.
//        |     Removed marine biology field keyword requirement.
//        |     Replaced with activity score comparison:
//        |     galapagosActivityScore (scuba + snorkeling +
//        |     wildlife/2) vs patagoniaActivityScore (hiking +
//        |     backpacking + mountains/2). Galápagos wins when
//        |     marine/wildlife activities outscore hiking/
//        |     mountain activities for the specific traveler.
//        |     Minimum threshold unchanged: wildlife ≥8 AND
//        |     (scuba ≥4 OR snorkeling ≥4 OR sailing ≥4).
//        |
//        | (6) MENA Mature Premium qualification gate broadened.
//        |     Added China visited as qualifying condition
//        |     alongside SSA touched and India visited. China's
//        |     cultural complexity (language barrier, political
//        |     environment, infrastructure challenges)
//        |     demonstrates readiness for MENA's cultural
//        |     demands.
//
// ─────────────────────────────────────────────────────────────────
// CHANGELOG (v2.33 → v2.34)
// ─────────────────────────────────────────────────────────────────
// v2.34  | Unified Scoring Engine. Major refactor of Gate 15's
//        | non-Big-4 ordering system, plus data fixes and
//        | mechanism simplifications.
//        |
//        | (1) Unified Scoring Engine replaces three separate
//        |     sub-mechanisms: hardcoded Continental PB placement,
//        |     post-mechanism re-sort (binary untouched/touched,
//        |     T1/T2, YP+IC, flag count), and N5 re-sort
//        |     (untouched/touched with flag count only). All
//        |     non-Big-4 trips now compete on one point-based
//        |     scored playing field. Mechanisms handle membership
//        |     (who competes). Scoring handles ordering (where
//        |     they rank). Replaced code preserved as comments.
//        |
//        |     Scoring weights: Continental PB +60, Primary YP
//        |     +50 (0 if age ≥30), Secondary YP +20 (0 if ≥30),
//        |     Primary IC +15 (<30) / +25 (≥30), Secondary IC
//        |     +5, untouched continent +20, T1 +15, Top 4 city
//        |     +20, Top 10 city +12, Top 25 city +5, F/F +15,
//        |     flags ×2, SA Fork selected +25, Australia burden
//        |     −25, MENA under-30 −20, MENA MP +30 (qualifying),
//        |     Scandinavia MP +30 (age ≥30).
//        |
//        |     Tiebreaker chain: YP tier (1YP > 2YP > none),
//        |     then flag count.
//        |
//        | (2) SA Fork modified to set saForkSelected flag
//        |     instead of hard-swapping T8 arrays. Gated by
//        |     virgin + 3 Big4s check — skips SA Fork for
//        |     virgins squeezed by 3 Big 4s (Peru displaced,
//        |     SA Fork inert). SA Fork selected trip gets
//        |     exclusive SA #2 slot (non-selected SA trips
//        |     blocked) and is pinned to T8 position 8 as
//        |     personal statement.
//        |
//        | (3) Mechanism 2 (SEA U30 Default) commented out.
//        |     Redundant — SE Asia competes on 1YP +50 score,
//        |     Big 4 SD blocking handles India North / China
//        |     East suppression.
//        |
//        | (4) Mechanism 3 (Tanzania Opportunity Cost) simplified
//        |     to removal-only. Sets tanzaniaExcluded flag when
//        |     preconditions met. Promotion scoring removed —
//        |     unified engine handles slot filling implicitly.
//        |
//        | (5) MENA Mature Premium Elevation mechanism commented
//        |     out. MP +30 bonus integrated into unifiedScore
//        |     with same qualification gate (age ≥30, SSA
//        |     touched OR India visited).
//        |
//        | (6) Post-mechanism re-sort, M6 N5 Second Pass, old
//        |     Euro Floor, cap-dropped N5 displacement, and N5
//        |     re-sort all commented out. Replaced by unified
//        |     engine Steps 1-6.
//        |
//        | (7) Euro Floor integrated into unified engine Step 6
//        |     as post-scoring check. Same behavior: guarantees
//        |     one Euro SD for European residents.
//        |
//        | (8) Europe soft cap in Gate 6: raised to 3 when
//        |     traveler is under 30 with fewer than 3 Big 4s
//        |     remaining. Gate 6 signature extended with
//        |     gate3Results and gate1Result parameters.
//        |
//        | (9) Switzerland West removed from SECONDARY_YP. Data
//        |     error — not listed in CP or Trip Data Reference.
//        |     10 Secondary YP trips, not 11.
//        |
//        | (10) Scandinavia and Greece Mature Premium. Both
//        |      receive +30 bonus for travelers age ≥30. No
//        |      qualification gate beyond age. Scandinavia:
//        |      Amsterdam art/design depth, Norwegian
//        |      contemplation, mature culture appreciation.
//        |      Greece: Acropolis, Santorini, Athens tavernas
//        |      reward maturity. Second and third active MPs
//        |      after MENA.
//
// ─────────────────────────────────────────────────────────────────
// FUTURE WORK NOTES (v2.36+)
// ─────────────────────────────────────────────────────────────────
//
// • Adaptation Add distance parsing currently uses regex
//   /~(\d[\d,]*)\s*mi/g over ADAPT text. Fragile — if a future
//   activity table writer uses "100 miles" or "1,200 km" the
//   parser silently fails. Recommended change: add explicit
//   `distanceMi: number` field to ADAPT entry schema.
//
// • Citation-report Gate 3 block-reason parsing
//   currently regex-parses fg3.log strings. Recommended change:
//   f2Gate3 stores block reasons as structured metadata
//   on the result object (e.g. `r.gate3Block = {reason, since}`)
//   rather than only as log strings.
//
// • The Balancing Test exception filter duplicates
//   logic that previously lived in the deleted
//   printFullScoreOverrideAnalysis. Could factor it into a
//   helper `isProtectedByExceptions(tripKey, f1Result)` exported
//   from al.js.
//
// ─────────────────────────────────────────────────────────────────
// PRIOR CHANGELOG (v2.2 → v2.25)
// ─────────────────────────────────────────────────────────────────
// v2.2   | Base version. Shared data, F1 (17 gates), F2 (4 gates),
//        |   mapSurveyToProfile, CAP-DROPPED output, ESSENTIAL_CITIES.
// v2.3   | Added normalizeCountry() for country aliases.
//        | Added CLOSE_CALL detection in CAP-DROPPED.
//        | Separated disclosure flags from alignment flags.
//        | Added Tanzania hard rule in Gate 15.
// v2.4   | Added CONSOLIDATED TRIP PROFILES output section.
// v2.5   | Added ISE to FLAG_THRESHOLDS.
// v2.6   | Added mechanical lean to CLOSE_CALL charts. [removed v2.9]
// v2.7   | Filtered non-competitive CLOSE_CALLs. [partly removed v2.9]
// v2.8   | Removed coverage labels from Gate 14 and CLOSE_CALL.
// v2.9   | Stripped dimension coverage analysis and mechanical lean.
// v2.10  | Structural restoration. Restored F2 engine.
// v2.12  | Removed Singapore from ESSENTIAL_CITIES (orphaned).
// v2.14  | Added printSummaryTable.
// v2.15  | Added expCategory field to TRIPS.
// v2.16  | Added wildlifeCore boolean to TRIPS.
// v2.17  | CLOSE_CALL charts: Cities row suppression; Prior exp row.
// v2.18  | CLOSE_CALL charts: row reorder; Tanzania deferral; N5
//        |   displacement.
// v2.19  | Decoupled CLOSE_CALL charts from CAP-DROPPED eligibility.
// v2.20  | Fixed Prior line; fixed Next 5 fill; Next 5 re-sort.
// v2.21  | Added normalizeRating(); fixed Next 5 re-sort interleave.
// v2.22  | Fixed Next 5 re-sort to use alignment-flag count only.
// v2.23  | Big 4 trips display "B4" instead of "T1".
// v2.24  | F2 architecture overhaul: activity table at runtime.
// v2.25  | F2 fixes 1–9 (rescue, Tanzania block, Gate 1/17 filters,
//        |   FLAG_THRESHOLDS additions, fear_heights flag, gardens
//        |   flag, runF1 input normalization, prior-exp formatting).
// ─────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════
// SECTION 1: SHARED DATA
// ═══════════════════════════════════════════════════════════════════

const TRIPS = [
  { id:1,  name:"Classic Europe",    abbr:"CE",              tier:1, type:"Big4",           region:"Europe",        spineCountries:["UK","France","Italy"],                          expCategory:"city",   wildlifeCore:false },
  { id:2,  name:"Classic Asia",      abbr:"CA",              tier:1, type:"Big4",           region:"Asia",          spineCountries:["Japan","South Korea"],                          expCategory:"city",   wildlifeCore:false },
  { id:3,  name:"Classic California",abbr:"CC",              tier:1, type:"Big4",           region:"North America", spineCountries:["US"],                                          expCategory:"mixed",  wildlifeCore:false },
  { id:4,  name:"Classic Africa",    abbr:"CAf",             tier:1, type:"Big4",           region:"SSA",           spineCountries:["South Africa","Zimbabwe","Botswana"],           expCategory:"nature", wildlifeCore:true },
  { id:5,  name:"Peru",             abbr:"Peru",             tier:1, type:"ContinentalPB",  region:"South America", spineCountries:["Peru"],                                        expCategory:"mixed",  wildlifeCore:false },
  { id:6,  name:"New Zealand",      abbr:"NZ",               tier:1, type:"ContinentalPB",  region:"Oceania",       spineCountries:["New Zealand"],                                 expCategory:"nature", wildlifeCore:false },
  { id:7,  name:"Italy North",      abbr:"Italy North",      tier:1, type:"SD",             region:"Europe",        spineCountries:["Italy"],                                       expCategory:"mixed",  wildlifeCore:false },
  { id:8,  name:"Italy South",      abbr:"Italy South",      tier:2, type:"SD",             region:"Europe",        spineCountries:["Italy"],                                       expCategory:"mixed",  wildlifeCore:false },
  { id:9,  name:"Italy M&L",        abbr:"Italy M&L",        tier:2, type:"SD",             region:"Europe",        spineCountries:["Italy"],                                       expCategory:"mixed",  wildlifeCore:false },
  { id:10, name:"France South",     abbr:"France South",     tier:1, type:"SD",             region:"Europe",        spineCountries:["France","Monaco"],                              expCategory:"mixed",  wildlifeCore:false },
  { id:11, name:"Spain North",      abbr:"Spain North",      tier:1, type:"SD",             region:"Europe",        spineCountries:["Spain","France"],                               expCategory:"mixed",  wildlifeCore:false },
  { id:12, name:"Portugal",         abbr:"Portugal",          tier:2, type:"SD",             region:"Europe",        spineCountries:["Portugal"],                                    expCategory:"mixed",  wildlifeCore:false },
  { id:13, name:"Switzerland West", abbr:"Switzerland West",  tier:1, type:"SD",             region:"Europe",        spineCountries:["Switzerland","France"],                         expCategory:"mixed",  wildlifeCore:false },
  { id:14, name:"Switzerland East", abbr:"Switzerland East",  tier:2, type:"SD",             region:"Europe",        spineCountries:["Switzerland","Italy"],                          expCategory:"mixed",  wildlifeCore:false },
  { id:15, name:"Germany South",    abbr:"Germany South",     tier:1, type:"SD",             region:"Europe",        spineCountries:["Germany","Austria"],                            expCategory:"mixed",  wildlifeCore:false },
  { id:16, name:"ISE",              abbr:"ISE",               tier:2, type:"SD",             region:"Europe",        spineCountries:["Ireland","UK"],                                expCategory:"mixed",  wildlifeCore:false },
  { id:17, name:"Eastern Europe",   abbr:"Eastern Europe",    tier:2, type:"SD",             region:"Europe",        spineCountries:["Germany","Czech Republic","Austria","Hungary"], expCategory:"city",   wildlifeCore:false },
  { id:18, name:"Scandinavia",      abbr:"Scandinavia",       tier:1, type:"SD",             region:"Europe",        spineCountries:["Netherlands","Sweden","Norway"],                expCategory:"mixed",  wildlifeCore:false },
  { id:19, name:"Greece",           abbr:"Greece",            tier:1, type:"SD",             region:"Europe",        spineCountries:["Greece"],                                      expCategory:"mixed",  wildlifeCore:false },
  { id:20, name:"SE Asia",          abbr:"SE Asia",           tier:1, type:"SD",             region:"Asia",          spineCountries:["Thailand","Cambodia","Vietnam"],                expCategory:"mixed",  wildlifeCore:false },
  { id:21, name:"India North",      abbr:"India North",       tier:1, type:"SD",             region:"Asia",          spineCountries:["India"],                                       expCategory:"mixed",  wildlifeCore:true },
  { id:22, name:"China East",       abbr:"China East",        tier:1, type:"SD",             region:"Asia",          spineCountries:["China"],                                       expCategory:"city",   wildlifeCore:false },
  { id:23, name:"MENA",             abbr:"MENA",              tier:1, type:"SD_OB",          region:"MENA",          spineCountries:["Turkey","Jordan","Israel","Egypt"],             expCategory:"mixed",  wildlifeCore:false },
  { id:24, name:"Tanzania",         abbr:"Tanzania",           tier:2, type:"SD",             region:"SSA",           spineCountries:["Tanzania"],                                    expCategory:"nature", wildlifeCore:true },
  { id:25, name:"Seychelles",       abbr:"Seychelles",        tier:1, type:"ExoticIsland",   region:"SSA",           spineCountries:["Seychelles"],                                  expCategory:"nature", wildlifeCore:false },
  { id:26, name:"Mexico",           abbr:"Mexico",            tier:2, type:"SD_OB",          region:"North America", spineCountries:["Mexico"],                                      expCategory:"mixed",  wildlifeCore:false },
  { id:27, name:"Galápagos",        abbr:"Galápagos",         tier:2, type:"SD",             region:"South America", spineCountries:["Ecuador"],                                     expCategory:"nature", wildlifeCore:true },
  { id:28, name:"Patagonia",        abbr:"Patagonia",          tier:2, type:"SD",             region:"South America", spineCountries:["Argentina","Chile"],                           expCategory:"nature", wildlifeCore:false },
  { id:29, name:"Costa Rica",       abbr:"Costa Rica",        tier:2, type:"SD_OB",          region:"North America", spineCountries:["Costa Rica"],                                  expCategory:"nature", wildlifeCore:true },
  { id:30, name:"B&A",              abbr:"B&A",               tier:1, type:"SD",             region:"South America", spineCountries:["Brazil","Argentina"],                          expCategory:"mixed",  wildlifeCore:true },
  { id:31, name:"Australia",        abbr:"Australia",          tier:2, type:"SD",             region:"Oceania",       spineCountries:["Australia"],                                   expCategory:"mixed",  wildlifeCore:false },
  { id:32, name:"FP",               abbr:"FP",                tier:2, type:"ExoticIsland",   region:"Oceania",       spineCountries:["French Polynesia"],                            expCategory:"nature", wildlifeCore:false },
  { id:33, name:"East Coast USA",   abbr:"East Coast USA",    tier:1, type:"SD",             region:"North America", spineCountries:["US"],                                          expCategory:"city",   wildlifeCore:false },
  { id:34, name:"SW Parks USA",     abbr:"SW Parks USA",      tier:1, type:"SD",             region:"North America", spineCountries:["US"],                                          expCategory:"nature", wildlifeCore:false },
];

// ── Region Checkoff ──────────────────────────────────────────────

const REGION_CHECKOFF = {
  Asia:            ["Japan","South Korea","China","Taiwan","Thailand","Vietnam","Cambodia",
                    "Indonesia","Philippines","Malaysia","Laos","Myanmar","India","Nepal","Sri Lanka"],
  Europe:          ["UK","France","Italy","Spain","Portugal","Switzerland","Germany","Ireland",
                    "Greece","Norway","Sweden","Denmark","Netherlands","Czech Republic","Austria",
                    "Hungary","Poland","Croatia","Monaco"],
  SSA:             ["South Africa","Kenya","Tanzania","Botswana","Zimbabwe","Namibia","Rwanda"],
  "South America": ["Peru","Brazil","Argentina","Chile","Colombia","Ecuador","Bolivia"],
  Oceania:         ["Australia","New Zealand"],
  "North America": ["United States","US"],
  MENA:            ["Israel","Jordan","Egypt","Turkey","Morocco","Oman"],
};

const NO_CHECKOFF = [
  "Singapore","Hong Kong","Dubai","UAE","Mexico","Costa Rica","Panama",
  "French Polynesia","Seychelles","Maldives","Mauritius","Galápagos","Canada"
];

// ── Virgin Classifications ───────────────────────────────────────

const VIRGIN_HARD_EXCLUDE    = ["SE Asia"];
const VIRGIN_DISCLOSURE_ONLY = ["CAf","CA"];
const VIRGIN_FLAGGED         = ["Mexico","Peru","B&A","MENA","India North",
                                "Patagonia","China East","Costa Rica",
                                "Galápagos","Tanzania","Australia"];
const VIRGIN_SAFE            = ["Italy North","Italy South","Italy M&L",
                                "France South","Spain North","Portugal",
                                "Switzerland West","Switzerland East",
                                "Germany South","ISE","Eastern Europe",
                                "Scandinavia","Greece","NZ","FP","Seychelles",
                                "East Coast USA","SW Parks USA","CE","CC"];

// ── YP / IC Classifications ─────────────────────────────────────

const PRIMARY_YP      = ["CE","CC","SE Asia","Greece"];
const SECONDARY_YP    = ["Spain North","B&A","East Coast USA","Australia",
                         "Mexico","NZ","SW Parks USA","Scandinavia","ISE",
                         "Patagonia"];
const SECONDARY_EURO_IC = ["Italy South","Italy M&L","Switzerland East"];

// ── Asia Trips (Gate 5) ──────────────────────────────────────────

const ASIA_TRIPS = ["CA","SE Asia","India North","China East"];

// ── Physically Demanding ─────────────────────────────────────────

const PHYSICALLY_DEMANDING = ["Patagonia","Tanzania","NZ","CAf","Peru"];

// ── Oddballs & Exotic Islands ────────────────────────────────────

const ODDBALLS       = ["Mexico","Costa Rica","MENA"];
const EXOTIC_ISLANDS = ["FP","Seychelles"];

// ── Big 4 SD Blocking ────────────────────────────────────────
// SD trips that deep-dive into a Big 4's spine countries are
// blocked until that Big 4 is completed (eliminated by Gate 3)
// or excluded (by Gate 1 home-region rule). The Big 4 must be
// on the T8 (eligible, not yet completed, not excluded) for
// blocks to be active. When the Big 4 is eliminated or excluded,
// blocks release — the traveler either already did it or has
// organic regional context from living there.
const BIG4_SD_BLOCKS = {
  "CE":  ["Italy North","Italy South","Italy M&L","France South","ISE"],
  "CA":  ["India North","China East"],
  "CAf": ["Tanzania"],
  "CC":  ["SW Parks USA"],
};

// ── Canonical Counts (oddball/exotic excluded) ───────────────────

const CANONICAL_COUNTS = {
  Europe: 14, Asia: 4, SSA: 2,
  "South America": 4, Oceania: 2, "North America": 3
};

// ── Language Matrix ──────────────────────────────────────────────

const LANGUAGE_MATRIX = {
  "CE":               [{ lang:"French",w:3 },{ lang:"Italian",w:3 },{ lang:"English",w:3 }],
  "CA":               [{ lang:"Japanese",w:5 },{ lang:"Korean",w:3 },{ lang:"English",w:1 }],
  "CC":               [{ lang:"English",w:5 },{ lang:"Spanish",w:1 }],
  "CAf":              [{ lang:"English",w:5 }],
  "Peru":             [{ lang:"Spanish",w:5 }],
  "NZ":               [{ lang:"English",w:5 }],
  "Italy North":      [{ lang:"Italian",w:5 }],
  "Italy South":      [{ lang:"Italian",w:5 }],
  "Italy M&L":        [{ lang:"Italian",w:5 }],
  "France South":     [{ lang:"French",w:5 }],
  "Spain North":      [{ lang:"Spanish",w:5 },{ lang:"French",w:1 }],
  "Portugal":         [{ lang:"Portuguese",w:5 }],
  "Switzerland West": [{ lang:"French",w:5 },{ lang:"German",w:3 }],
  "Switzerland East": [{ lang:"Italian",w:3 },{ lang:"German",w:3 }],
  "Germany South":    [{ lang:"German",w:5 }],
  "ISE":              [{ lang:"English",w:5 }],
  "Eastern Europe":   [{ lang:"German",w:1 }],
  "Scandinavia":      [{ lang:"English",w:3 }],
  "Greece":           [{ lang:"Greek",w:5 },{ lang:"English",w:3 }],
  "SE Asia":          [{ lang:"Thai",w:3 },{ lang:"English",w:1 }],
  "India North":      [{ lang:"Hindi",w:5 },{ lang:"English",w:3 }],
  "China East":       [{ lang:"Chinese",w:5 }],
  "MENA":             [{ lang:"Arabic",w:5 }],
  "Tanzania":         [{ lang:"Swahili",w:3 },{ lang:"English",w:2 }],
  "Seychelles":       [{ lang:"French",w:3 },{ lang:"English",w:3 }],
  "Mexico":           [{ lang:"Spanish",w:5 }],
  "Galápagos":        [{ lang:"Spanish",w:5 }],
  "Patagonia":        [{ lang:"Spanish",w:5 }],
  "Costa Rica":       [{ lang:"Spanish",w:5 }],
  "B&A":              [{ lang:"Spanish",w:3 },{ lang:"Portuguese",w:3 }],
  "Australia":        [{ lang:"English",w:5 }],
  "FP":               [{ lang:"French",w:5 }],
  "East Coast USA":   [{ lang:"English",w:5 }],
  "SW Parks USA":     [{ lang:"English",w:5 }],
};

// ── Language Scoring Matrix (scaled for unified engine, divisor 3) ──
// Raw values from floor + duration framework divided by 3 to fit
// unified engine weight scale. Internal proportionality preserved.
//   W5 pure = full trip in language, no other lang at weight ≥3
//   W5 mixed = full trip (weight 5) but diluted by another lang ≥3
//   W3 = major segment, W1 = minor segment
const LANG_SCORE_MATRIX = {
  proficient: { w5pure: 33, w5mixed: 23, w3: 15, w1: 8 },
  native:     { w5pure: 33, w5mixed: 23, w3: 15, w1: 8 },
  "little bit": { w5pure: 10, w5mixed: 7,  w3: 5,  w1: 3 },
};

// Compute language score for a trip given a traveler's language profile.
// Uses LANGUAGE_MATRIX (trip → languages + weights) and LANG_SCORE_MATRIX
// (level × weight tier → points). Multiple languages on same trip are summed.
// Native language excluded (no activation value from mother tongue).
// English excluded (lingua franca — baseline expectation, not activation).
function computeLangScore(tripAbbr, profileLanguages) {
  const tripLangs = LANGUAGE_MATRIX[tripAbbr];
  if (!tripLangs || !profileLanguages || profileLanguages.length === 0) return 0;

  // Build traveler's non-native, non-English language map
  const travelerLangs = {};
  profileLanguages.forEach(l => {
    if (l.level === "native") return;
    if (l.lang.toLowerCase() === "english") return;
    travelerLangs[l.lang.toLowerCase()] = l.level;
  });

  // Determine if trip has multiple significant languages (weight ≥3)
  const significantLangs = tripLangs.filter(m => m.w >= 3);
  const hasMultipleSignificant = significantLangs.length > 1;

  let totalScore = 0;

  tripLangs.forEach(({ lang, w }) => {
    const level = travelerLangs[lang.toLowerCase()];
    if (!level) return;
    const matrix = LANG_SCORE_MATRIX[level];
    if (!matrix) return;

    let points = 0;
    if (w === 5) {
      points = hasMultipleSignificant ? matrix.w5mixed : matrix.w5pure;
    } else if (w === 3) {
      points = matrix.w3;
    } else if (w === 1) {
      points = matrix.w1;
    }
    totalScore += points;
  });

  return totalScore;
}

// ── Gate 13 Flag Thresholds ──────────────────────────────────────

const FLAG_THRESHOLDS = {
  wildlife:           { threshold:"wildlife_interest >= 8",
                        trips:["CAf","Tanzania","Costa Rica","Galápagos","India North","B&A"] },
  hiking_mountains:   { threshold:"hiking >= 4 AND mountains >= 7",
                        trips:["CC","SW Parks USA","Switzerland West","Switzerland East",
                               "Germany South","France South","Italy M&L","Spain North",
                               "Scandinavia","Patagonia","Peru","NZ","Tanzania","CAf"] },
  performing_arts:    { threshold:"performing_arts >= 8",
                        trips:["ISE","East Coast USA","CE","CA","Eastern Europe","CC"] },
  art:                { threshold:"art >= 4",
                        trips:["Italy North","Spain North","Scandinavia","Eastern Europe",
                               "France South","CE","ISE"] },
  scuba_snorkel:      { threshold:"snorkeling >= 4 OR scuba >= 4",
                        trips:["Australia","Mexico","SE Asia","Galápagos","CC",
                               "Seychelles","FP"] },
  road_trip:          { threshold:"roadTrip === 'love'",
                        trips:["CC","NZ","Germany South","Patagonia","CAf"] },
  extrovert:          { threshold:"extrovert >= 7",
                        trips:["B&A","Greece","Spain North","SE Asia","East Coast USA"] },
  camping_backpacking:{ threshold:"camping >= 4 OR backpacking >= 4",
                        trips:["Patagonia","CC","NZ","Tanzania","SW Parks USA"] },
  deserts:            { threshold:"landscapes.deserts >= 7",
                        trips:["MENA","Peru","SW Parks USA","India North","CC","CAf"] },
  // Greece added (Mediterranean foodie destination).
  foodie:             { threshold:"foodie === true",
                        trips:["Italy North","Spain North","Mexico","Peru","SE Asia",
                               "CA","France South","East Coast USA","B&A","Greece"] },
  beaches:            { threshold:"landscapes.beaches >= 8",
                        trips:["Greece","SE Asia","Mexico","Australia","FP","Seychelles",
                               "Italy South","Portugal","CAf","Costa Rica"] },
  rainforests:        { threshold:"landscapes.rainforests >= 7",
                        trips:["Costa Rica","SE Asia","India North","B&A"] },
  lakes:              { threshold:"landscapes.lakes >= 7",
                        trips:["Italy North","Germany South","Switzerland West",
                               "Switzerland East","NZ","Scandinavia","CC","Peru","ISE"] },
  // Italy North added (Roman/Renaissance/Etruscan history).
  history:            { threshold:"history_rating >= 4",
                        trips:["MENA","Peru","CA","China East","India North","Greece",
                               "Eastern Europe","SE Asia","CE","Italy South","ISE","Italy North"] },
  train_preference:   { threshold:"trainPref === 'train'",
                        trips:["CE","CA","Eastern Europe","Spain North","Switzerland East",
                               "India North","East Coast USA","Scandinavia","ISE"] },
  vineyards_wine:     { threshold:"landscapes.vineyards >= 7",
                        trips:["France South","Italy North","Portugal","Spain North",
                               "CC","CAf","Australia"] },
  sailing_boating:    { threshold:"sailing >= 4",
                        trips:["CC","Italy North","Switzerland West","Greece","FP",
                               "Seychelles","CAf","Scandinavia","NZ","Germany South",
                               "Australia"] },
  fishing:            { threshold:"fishing >= 4",
                        trips:["NZ","Patagonia","CC"] },
  golf:               { threshold:"golf >= 4",
                        trips:["CC","East Coast USA","Spain North","Australia","NZ","CAf","ISE"] },
  // gardens flag.
  gardens:            { threshold:"art >= 4 (proxy — no gardens field in profile)",
                        trips:["CE","CA","CC","CAf","Italy North","Italy South","Italy M&L",
                               "Spain North","Portugal","ISE","Eastern Europe","Scandinavia",
                               "Switzerland East","China East","B&A","Australia","East Coast USA"] },
  fear_snakes:        { threshold:"fearSnakes === true (AIQC flag)",
                        trips:["CAf","India North","SE Asia","Costa Rica","B&A",
                               "Tanzania","Australia"] },
  // fear_heights AIQC disclosure flag.
  fear_heights:       { threshold:"fearHeights === true (AIQC flag)",
                        trips:["Patagonia","Switzerland West","Switzerland East",
                               "SW Parks USA","NZ","Peru","Italy M&L","CC"] },
  left_side_driving:  { threshold:"AIQC flag for drivers",
                        trips:["CAf","NZ","Australia","ISE"] },
  right_side_driving: { threshold:"AIQC flag for drivers",
                        trips:["CC","Germany South","Patagonia","Costa Rica","Italy North",
                               "France South","Portugal","Spain North","Greece","Mexico",
                               "Switzerland West","Switzerland East"] },
};

// ── F2 Activity Table (external input) ──────────────────────────
// The activity table is NO LONGER a hardcoded constant. It is
// passed into runF2() at runtime, the same way the profile is
// passed. Callers construct the table from their own data source
// (spreadsheet, database, JSON file, etc.) and hand it to the
// engine.
//
// SCHEMA
// ------
// activityTable: {
//   [tripKey: string]: {
//     [columnName: string]: {
//       rating: number,      // 0 = absent, 3 = NWC, 5 = WC
//       entries: [            // optional; defaults to []
//         { type: "ON-SPINE" | "ADAPT" | "EXTEND", text: string }
//       ]
//     }
//   }
// }
//
// KEYS
// ----
// - tripKey matches the TRIPS[].abbr field (e.g. "CE", "Mexico",
//   "Spain North"). Variant keys for the enhancement/rescue
//   pathway follow the convention "<base> +<adaptation>" (e.g.
//   "Portugal +Tarifa", "MENA +Dahab"). Variants are auto-detected:
//   any key containing " +" is treated as a variant of the substring
//   before " +", provided that base key also exists in the table.
// - columnName is any string. The wants array passed to runF2 may
//   contain any column present in the table — not just beach/
//   snorkel/wind_kite. Columns the table does not define return
//   rating 0 and empty entries.
//
// CELL SHORTHAND
// --------------
// Callers may shorten `{ rating: N }` (no entries) to just the
// number N if they prefer a compact form; the engine normalizes
// via getActivityRating/getActivityEntries below.
//
// MISSING TABLE
// -------------
// If runF2 is called without an activityTable (null/undefined),
// every trip receives rating 0 across all wants and F2 returns
// an empty ranking. No exception is thrown.

// Helper: get rating for a (trip, want) pair from an activity table.
// Accepts shorthand (plain number) or full object ({rating, entries}).
function getActivityRating(activityTable, tripKey, want) {
  if (!activityTable) return 0;
  const row = activityTable[tripKey];
  if (!row) return 0;
  const cell = row[want];
  if (cell == null) return 0;
  if (typeof cell === "number") return cell;
  return cell.rating || 0;
}

// Helper: get entries (ON-SPINE/ADAPT/EXTEND) for a (trip, want) pair.
function getActivityEntries(activityTable, tripKey, want) {
  if (!activityTable) return [];
  const row = activityTable[tripKey];
  if (!row) return [];
  const cell = row[want];
  if (cell == null || typeof cell === "number") return [];
  return cell.entries || [];
}

function detectActivityVariants(activityTable) {
  if (!activityTable) return [];
  const pairs = [];
  Object.keys(activityTable).forEach(key => {
    const plusIdx = key.indexOf(" +");
    if (plusIdx <= 0) return;
    const base = key.substring(0, plusIdx);
    if (activityTable[base]) pairs.push({ variant: key, base });
  });
  return pairs;
}

// ── Essential Cities ─────────────────────────────────────────────

const ESSENTIAL_CITIES = {
  // Top 4
  "London":        ["CE","ISE"],
  "Paris":         ["CE"],
  "New York":      ["East Coast USA"],
  "Tokyo":         ["CA"],
  // Top 10
  "San Francisco": ["CC"],
  "Washington DC": ["East Coast USA"],
  "Madrid":        ["Spain North"],
  "Rome":          ["CE","Italy South"],
  "Amsterdam":     ["Scandinavia"],
  "Sydney":        ["Australia"],
  // Top 25
  "Seoul":         ["CA"],
  "Beijing":       ["China East"],
  "Cape Town":     ["CAf"],
  "Milan":         ["Italy North","Switzerland East"],
  "Shanghai":      ["China East"],
  "Hong Kong":     ["China East"],
  "Los Angeles":   ["CC"],
  "Buenos Aires":  ["B&A"],
  "Rio":           ["B&A"],
  "Mexico City":   ["Mexico"],
  "Barcelona":     ["Spain North"],
  "Berlin":        ["Eastern Europe"],
  "Cairo":         ["MENA"],
  "Istanbul":      ["MENA"],
  "Bangkok":       ["SE Asia"],
  "Athens":        ["Greece"],
};


// ═══════════════════════════════════════════════════════════════════
// SECTION 2: F1 ENGINE — 17 Gates
// ═══════════════════════════════════════════════════════════════════

// ── Country Normalization ─────────────────────────────────────────

const COUNTRY_ALIASES = {
  "United Kingdom": "UK",
  "United States": "US",
  "United States of America": "US",
  "USA": "US",
  "Czechia": "Czech Republic",
};

function normalizeCountry(c) {
  return COUNTRY_ALIASES[c] || c;
}

// ── Rating Normalization (output only) ───────────────────────────

const SCALE_10_FIELDS = [
  "wildlife_interest", "performing_arts", "extrovert",
  "beaches", "mountains", "lakes", "forests", "vineyards",
  "wildlife", "rainforests", "deserts", "fitness"
];

function normalizeRating(val, fieldName) {
  if (SCALE_10_FIELDS.includes(fieldName)) {
    return Math.round(val / 2);
  }
  return val;
}

function countriesMatch(a, b) {
  return normalizeCountry(a) === normalizeCountry(b);
}

function countryInList(country, list) {
  const norm = normalizeCountry(country);
  return list.some(c => normalizeCountry(c) === norm);
}

// Countries that drive on the left
const LEFT_DRIVING_COUNTRIES = ["UK","United Kingdom","Australia","New Zealand",
  "Japan","India","South Africa","Ireland","Thailand","Kenya","Tanzania",
  "Botswana","Zimbabwe","Seychelles","Jamaica"];

function filterDrivingDisclosures(disclosures, profile) {
  const home = normalizeCountry(profile.homeCountry || "");
  const drivesRight = !LEFT_DRIVING_COUNTRIES.some(c => normalizeCountry(c) === home);
  return disclosures.filter(d => {
    if (d === "right_side_driving" && drivesRight) return false;
    if (d === "left_side_driving" && !drivesRight) return false;
    return true;
  });
}

// ── Helpers ──────────────────────────────────────────────────────

function findTrip(abbr) {
  return TRIPS.find(t => t.abbr === abbr || t.name === abbr);
}

function getCountryRegion(country) {
  const norm = normalizeCountry(country);
  for (const [region, countries] of Object.entries(REGION_CHECKOFF)) {
    if (countries.some(c => normalizeCountry(c) === norm)) return region;
  }
  return null;
}

function resolveResidenceRegion(profile) {
  if (profile.residenceRegion) return profile.residenceRegion;
  const hc = profile.homeCountry;
  if (["US","United States","United States of America","USA"].includes(hc)) {
    return "North America";
  }
  return getCountryRegion(hc) || null;
}

// ── Gate 1: Home Region Exclusion ────────────────────────────────

function gate1(profile) {
  const log = [];
  const excluded = [];
  const flagged = [];

  TRIPS.forEach(trip => {
    const abbr = trip.abbr;
    if (abbr === "CE" && profile.livedInEurope) {
      excluded.push(abbr);
      log.push("CE: EXCLUDED — lived in Europe (continental rule)");
    }
    else if (abbr === "CAf" && profile.livedInSSA) {
      excluded.push(abbr);
      log.push("CAf: EXCLUDED — lived in SSA");
    }
    else if (abbr === "CA" && profile.livedInJapanOrKorea) {
      excluded.push(abbr);
      log.push("CA: EXCLUDED — lived in Japan or South Korea");
    }
    else if (abbr === "CC" && profile.livedInCalifornia) {
      excluded.push(abbr);
      log.push("CC: EXCLUDED — lived in California");
    }
    else if ((abbr === "East Coast USA" || abbr === "SW Parks USA") && profile.isUSResident) {
      excluded.push(abbr);
      log.push(`${abbr}: EXCLUDED — US resident`);
    }
    else {
      const rc = profile.residenceCountries || [];
      const overlap = trip.spineCountries.filter(sc =>
        rc.some(rc2 => countriesMatch(sc, rc2)));
      if (overlap.length > 0) {
        if (trip.type === "Big4") {
          excluded.push(abbr);
          log.push(`${abbr}: EXCLUDED — lived in spine country (${overlap.join(", ")})`);
        } else {
          flagged.push(abbr);
          log.push(`${abbr}: AIQC FLAGGED — partial overlap (${overlap.join(", ")})`);
        }
      }
    }
  });

  return { excluded, flagged, log };
}

// ── Gate 2: Virgin Classification ────────────────────────────────

function gate2(profile) {
  const homeRegion = resolveResidenceRegion(profile);
  const visitedRegions = new Set();

  (profile.visitedCountries || []).forEach(c => {
    const r = getCountryRegion(c);
    if (r) visitedRegions.add(r);
  });

  const outsideHome = [...visitedRegions].filter(r => r !== homeRegion);
  const isVirgin = outsideHome.length === 0;

  const log = [
    `Home: ${homeRegion} | Visited outside: ${outsideHome.join(", ") || "none"} | Virgin: ${isVirgin}`
  ];

  return { isVirgin, homeRegion, visitedRegions: [...visitedRegions],
           outsideHomeRegions: outsideHome, log };
}

// ── Gate 3: PB Eligibility ───────────────────────────────────────

function gate3(profile) {
  const results = {};
  const log = [];

  const vc = profile.visitedCountries || [];
  const vcNorm = vc.map(normalizeCountry);

  const ceHits = [];
  if (vcNorm.includes("France") ||
      (profile.visitedCECities || []).includes("Paris")) ceHits.push("France→Paris");
  if (vcNorm.includes("UK") ||
      (profile.visitedCECities || []).includes("London")) ceHits.push("UK→London");
  if (vcNorm.includes("Italy") ||
      (profile.visitedCECities || []).includes("Rome")) ceHits.push("Italy→Rome");
  results["CE"] = ceHits.length >= 2 ? "ELIMINATED" : "ELIGIBLE";
  log.push(`CE: ${results["CE"]} (${ceHits.join(", ") || "none"})`);

  const caHits = [];
  if (vcNorm.includes("Japan")) caHits.push("Japan");
  if (vcNorm.includes("South Korea")) caHits.push("South Korea");
  results["CA"] = vcNorm.includes("Japan") ? "ELIMINATED" : "ELIGIBLE";
  log.push(`CA: ${results["CA"]} (${caHits.join(", ") || "none"})`);

  const cafHits = [];
  ["South Africa","Zimbabwe","Botswana"].forEach(c => {
    if (vcNorm.includes(normalizeCountry(c))) cafHits.push(c);
  });
  results["CAf"] = cafHits.length >= 2 ? "ELIMINATED" : "ELIGIBLE";
  log.push(`CAf: ${results["CAf"]} (${cafHits.join(", ") || "none"})`);

  const ccHits = (profile.visitedCCCities || []).filter(c =>
    ["San Francisco","Los Angeles","Yosemite"].includes(c));
  results["CC"] = ccHits.length >= 2 ? "ELIMINATED" : "ELIGIBLE";
  log.push(`CC: ${results["CC"]} (${ccHits.join(", ") || "none"})`);

  results["Peru"] = vcNorm.includes("Peru") ? "ELIMINATED" : "ELIGIBLE";
  results["NZ"] = vcNorm.includes(normalizeCountry("New Zealand")) ? "ELIMINATED" : "ELIGIBLE";
  log.push(`Peru: ${results["Peru"]} | NZ: ${results["NZ"]}`);

  TRIPS.filter(t => !["Big4","ContinentalPB"].includes(t.type)).forEach(trip => {
    const visited = trip.spineCountries.filter(c => vcNorm.includes(normalizeCountry(c)));
    if (visited.length === 0) {
      results[trip.abbr] = "ELIGIBLE";
    } else if (visited.length === trip.spineCountries.length) {
      results[trip.abbr] = "ELIMINATED";
      log.push(`${trip.abbr}: ELIMINATED (all spine: ${visited.join(", ")})`);
    } else {
      results[trip.abbr] = "COUNTRY_ELIMINATED_VERIFY";
      log.push(`${trip.abbr}: COUNTRY_ELIMINATED_VERIFY (${visited.join(",")} of ${trip.spineCountries.join(",")})`);
    }
  });

  return { results, log };
}

// ── Gate 4: Region Checkoff ──────────────────────────────────────

function gate4(profile) {
  const touchedRegions = new Set();
  const log = [];

  (profile.visitedCountries || []).forEach(c => {
    const r = getCountryRegion(c);
    if (r) touchedRegions.add(r);
  });

  const tripStatuses = {};

  TRIPS.forEach(trip => {
    const abbr = trip.abbr;

    if (trip.type === "SD_OB") {
      if (abbr === "MENA") {
        const menaVisited = (profile.visitedCountries || []).some(c =>
          REGION_CHECKOFF.MENA.some(mc => countriesMatch(c, mc)));
        tripStatuses[abbr] = menaVisited ? "TOUCHED_ODDBALL" : "UNTOUCHED_ODDBALL";
      } else {
        const visitedSpine = trip.spineCountries.some(c =>
          countryInList(c, profile.visitedCountries || []));
        tripStatuses[abbr] = visitedSpine ? "TOUCHED_ODDBALL" : "UNTOUCHED_ODDBALL";
      }
    }
    else if (trip.type === "ExoticIsland") {
      const visitedSpine = trip.spineCountries.some(c =>
        countryInList(c, profile.visitedCountries || []));
      tripStatuses[abbr] = visitedSpine
        ? "TOUCHED_EXOTIC_ISLAND" : "UNTOUCHED_EXOTIC_ISLAND";
    }
    else {
      tripStatuses[abbr] = touchedRegions.has(trip.region) ? "TOUCHED" : "UNTOUCHED";
    }

    const visitedSpine = trip.spineCountries.filter(c =>
      countryInList(c, profile.visitedCountries || []));
    if (visitedSpine.length > 0) {
      tripStatuses[abbr] += "|SPINE:" + visitedSpine.join(",");
    }
  });

  log.push(`Touched regions: ${[...touchedRegions].join(", ") || "none"}`);
  return { touchedRegions: [...touchedRegions], tripStatuses, log };
}

// ── Gate 5: Asia Allocation ──────────────────────────────────────

function gate5(profile, gate3Results) {
  const completed = ASIA_TRIPS.filter(t =>
    gate3Results.results[t] === "ELIMINATED").length;
  let maxOnTop8;
  let note = "";
  if (completed <= 1) { maxOnTop8 = 2; }
  else if (completed === 2) { maxOnTop8 = 1; note = "AIQC can justify 2"; }
  else { maxOnTop8 = 1; note = "AIQC justification needed"; }

  const log = [
    `Completed Asia: ${completed}, max on T8: ${maxOnTop8}${note ? " — " + note : ""}`
  ];
  return { completedAsiaTrips: completed, maxAsiaOnTop8: maxOnTop8, log };
}

// ── Gate 6: Continent Caps ───────────────────────────────────────

function gate6(profile, gate2Result, gate4Results, gate3Results, gate1Result) {
  const touchedCount = gate4Results.touchedRegions.length;
  const caps = {
    Europe: 2, Asia: 2, SSA: 2,
    "South America": 2, Oceania: 1,
    "North America": 2, MENA: 1
  };
  const log = [];

  if (gate2Result.isVirgin && gate2Result.homeRegion !== "Europe") {
    caps.Europe = 4;
    log.push("Virgin non-European: Europe cap raised to 4");
  }
  if (touchedCount >= 4) {
    caps.Europe = Math.max(caps.Europe, 3);
    caps.Oceania = 2;
    log.push(`4+ regions touched (${touchedCount}): Europe cap ≥3, Oceania cap 2`);
  }
  const big4CountForCap = ["CE","CA","CC","CAf"].filter(b => {
    const g3r = gate3Results ? gate3Results.results[b] : null;
    const g1e = gate1Result ? gate1Result.excluded : [];
    return g3r !== "ELIMINATED" && !g1e.includes(b);
  }).length;
  if (profile.age < 30 && big4CountForCap < 3) {
    caps.Europe = Math.max(caps.Europe, 3);
    log.push(`Under-30 with ${big4CountForCap} Big4s remaining: Europe cap ≥3 (YP demand)`);
  }
    if (profile.age >= 30) {
      const PRIMARY_IC_COUNTRIES = {
        "Italy North": "Italy",
        "Spain North": "Spain",
        "Switzerland West": "Switzerland",
        "Greece": "Greece",
      };
      const unvisitedICCount = Object.values(PRIMARY_IC_COUNTRIES).filter(country =>
        !(profile.visitedCountries || []).some(vc => normalizeCountry(vc) === country)
      ).length;
      if (unvisitedICCount >= 3) {
        caps.Europe = Math.max(caps.Europe, Math.min(2 + unvisitedICCount, 4));
        log.push(`30+ with ${unvisitedICCount} unvisited 1IC countries: Europe cap raised to ${caps.Europe}`);
      }
    }
  log.push(`Caps: ${JSON.stringify(caps)}`);
  return { caps, log };
}

// ── Gate 7: Big 4 Ordering ───────────────────────────────────────

function gate7(profile, gate2Result, gate3Results, gate1Result) {
  const excluded = (gate1Result && gate1Result.excluded) || [];
  const eligible = ["CE","CA","CC","CAf"].filter(b =>
    gate3Results.results[b] === "ELIGIBLE" && !excluded.includes(b));
  const log = [];
  let ordered = [];
  const homeRegion = gate2Result.homeRegion;

  if (eligible.length === 0) {
    log.push("No eligible Big4s");
    return { ordered: [], log };
  }

  if (gate2Result.isVirgin) {
    if (gate2Result.homeRegion !== "Europe") {
      const familiarToStretch = { CC: 0, CA: 1, CAf: 2 };
      ordered = eligible.includes("CE") ? ["CE"] : [];
      const rest = eligible.filter(b => b !== "CE")
        .sort((a, b) => (familiarToStretch[a] ?? 9) - (familiarToStretch[b] ?? 9));
      ordered = [...ordered, ...rest];
      log.push(`Virgin non-Euro: CE #1, then ${rest.join(" > ")}`);

      const englishLevel = (profile.languages || []).find(l =>
        l.lang.toLowerCase() === "english");
      if (!englishLevel || englishLevel.level === "little bit") {
        log.push("AIQC FLAG: English below proficient for virgin traveler");
      }
    } else {
      ordered = eligible.includes("CC") ? ["CC", ...eligible.filter(b => b !== "CC")]
        : [...eligible];
      log.push(`Virgin European: CC #1`);
    }
  } else if (homeRegion === "Europe") {
    // European resident (non-virgin): CC first, then CA, then CAf
    const euroOrder = ["CC", "CA", "CAf"];
    ordered = euroOrder.filter(b => eligible.includes(b));
    const remainder = eligible.filter(b => !euroOrder.includes(b));
    ordered = [...ordered, ...remainder];
    log.push(`European resident: CC first, then ${ordered.slice(1).join(" > ")}`);
  } else {
    ordered = [...eligible];
    log.push(`Not virgin: ${ordered.join(", ")} (AIQC refines)`);
  }

  return { ordered, log };
}

// ── Gate 8: Continental PB Positioning ────────────────────────────

function gate8(profile, gate2Result, gate3Results, gate7Result, gate13Result) {
  const log = [];
  const pbs = [];
  const displaced = [];

  if (gate3Results.results["NZ"] === "ELIGIBLE") pbs.push("NZ");
  if (gate3Results.results["Peru"] === "ELIGIBLE") pbs.push("Peru");

  if (pbs.length === 0) {
    return { pbs: [], displaced: [], log: ["No eligible Continental PBs"] };
  }

  if (pbs.includes("NZ") && pbs.includes("Peru") &&
      gate2Result.outsideHomeRegions.length <= 1) {
    pbs.length = 0;
    pbs.push("NZ", "Peru");
    log.push("NZ above Peru (inexperienced traveler)");
  }

  if (gate7Result.ordered.length >= 3) {
    pbs.forEach(pb => {
      const fc = gate13Result.flagCounts[pb] || 0;
      if (fc < 3) {
        displaced.push(pb);
        log.push(`${pb}: DISPLACEMENT CANDIDATE (${gate7Result.ordered.length} Big4s, ${fc} flags). AIQC decides.`);
      }
    });
  }

  const sp = (profile.languages || []).find(l =>
    l.lang.toLowerCase() === "spanish");
  if (pbs.includes("Peru") && sp &&
      (sp.level === "proficient" || sp.level === "native")) {
    log.push("Peru: Spanish proficiency noted — AIQC");
  }

  log.push(`PB order: ${pbs.join(", ")}`);
  return { pbs, displaced, log };
}

// ── Gate 9: Virgin First-Trip Filter ─────────────────────────────

function gate9(profile, gate2Result) {
  const log = [];
  const hardExcluded = [];
  const disclosureOnly = [];
  const virginFlagged = [];
  const safe = [];

  if (!gate2Result.isVirgin) {
    return { hardExcluded, disclosureOnly, virginFlagged, safe,
             applies: false, log: ["Not virgin — N/A"] };
  }

  const homeRegion = resolveResidenceRegion(profile);
  TRIPS.forEach(trip => {
    const abbr = trip.abbr;
    if (VIRGIN_HARD_EXCLUDE.includes(abbr)) {
      // Oceanian virgins: SE Asia is their backyard, not a stretch trip
      if (abbr === "SE Asia" && homeRegion === "Oceania") {
        log.push("SE Asia: virgin hard-exclude WAIVED — Oceanian resident (backyard trip)");
      } else {
        hardExcluded.push(abbr);
      }
    }
    else if (VIRGIN_DISCLOSURE_ONLY.includes(abbr)) disclosureOnly.push(abbr);
    else if (VIRGIN_FLAGGED.includes(abbr)) virginFlagged.push(abbr);
    else if (VIRGIN_SAFE.includes(abbr)) safe.push(abbr);
  });

  log.push(`Hard excl: ${hardExcluded.join(", ")}`);
  log.push(`Disclosure only: ${disclosureOnly.join(", ")}`);
  log.push(`Flagged: ${virginFlagged.length} trips`);
  log.push(`Safe: ${safe.length} trips`);

  return { hardExcluded, disclosureOnly, virginFlagged, safe, applies: true, log };
}

// ── Gate 10: YP Assessment ───────────────────────────────────────

function gate10(profile, gate3Results) {
  const age = profile.age;
  let band;
  if (age >= 18 && age <= 22) band = "college_primo";
  else if (age >= 23 && age <= 26) band = "post_college_primo";
  else if (age >= 27 && age <= 28) band = "fading";
  else if (age === 29) band = "last_hurrah";
  else band = "off";

  const ypActive = age < 30;
  const uncompletedPrimaryYP = ypActive
    ? PRIMARY_YP.filter(t => gate3Results.results[t] !== "ELIMINATED") : [];
  const uncompletedSecondaryYP = ypActive
    ? SECONDARY_YP.filter(t => gate3Results.results[t] !== "ELIMINATED") : [];

  const log = [
    `Age ${age}, band: ${band}, YP active: ${ypActive}`,
    `Uncompleted Primary YP: ${uncompletedPrimaryYP.join(", ") || "none"}`,
    `Uncompleted Secondary YP: ${uncompletedSecondaryYP.join(", ") || "none"}`
  ];
  if (!ypActive) log.push("YP cleared. IC governs.");

  return { age, band, ypActive, uncompletedPrimaryYP, uncompletedSecondaryYP, log };
}

// ── Gate 10B: Fitness Window ─────────────────────────────────────

function gate10B(profile) {
  const age = profile.age;
  const fitness = profile.fitness;
  const log = [];
  const flagged = [];

  PHYSICALLY_DEMANDING.forEach(trip => {
    let severity = "none";
    if (age < 35 && fitness >= 7) severity = "none";
    else if (age >= 35 && age <= 45 && fitness >= 7) severity = "minor";
    else if (age >= 35 && age <= 45 && fitness < 7) severity = "aiqc_review";
    else if (age >= 45 && age <= 55 && fitness >= 7) severity = "narrowing";
    else if (age >= 45 && age <= 55 && fitness < 7) severity = "significant";
    else if (age >= 55) severity = "flag_all";

    if (severity !== "none") {
      flagged.push({ trip, severity });
      log.push(`${trip}: fitness ${severity} (age ${age}, fitness ${normalizeRating(fitness, "fitness")}/5)`);
    }
  });

  if (flagged.length === 0) log.push(`No fitness flags (age ${age}, fitness ${normalizeRating(fitness, "fitness")}/5)`);
  return { flagged, log };
}

// ── Gate 11: European SD Priority Hierarchy ──────────────────────

function gate11(profile, gate3Results, gate10Result) {
  const log = [];
  const hierarchy = [];
  const age = profile.age;

  if (age < 30 && gate3Results.results["Greece"] !== "ELIMINATED") {
    hierarchy.push({ trip: "Greece", reason: "Primary YP European — Step 1" });
    log.push("Step 1: Greece → Primary YP European (highest Euro SD)");
  }

  if (gate3Results.results["CE"] === "ELIMINATED" && age >= 23 && age <= 29) {
    const pbDone = profile.completedPBCount || 0;
    const ypDone = profile.completedYPCount || 0;
    let foundationMet = age <= 26 ? (pbDone >= 2 && ypDone >= 2) : (pbDone >= 2);

    if (foundationMet && gate3Results.results["Italy North"] !== "ELIMINATED") {
      hierarchy.push({ trip: "Italy North", reason: "Italy North Special Priority — Step 2" });
      log.push("Step 2: Italy North → Special Priority (CE done, foundation met)");
    } else {
      log.push("Step 2: Italy North — foundation not met");
    }
  }

  const PRIMARY_EURO_IC = ["Italy North", "Spain North", "Switzerland West", "Greece"];
  const dualICYP = ["Spain North"];

  dualICYP.forEach(t => {
    if (gate3Results.results[t] !== "ELIMINATED" && !hierarchy.find(h => h.trip === t)) {
      hierarchy.push({ trip: t, reason: "Dual IC+YP — Step 3" });
      log.push(`Step 3: ${t} → Dual IC+YP (ranks above IC-only)`);
    }
  });

  PRIMARY_EURO_IC.filter(t => !dualICYP.includes(t)).forEach(t => {
    if (gate3Results.results[t] !== "ELIMINATED" && !hierarchy.find(h => h.trip === t)) {
      hierarchy.push({ trip: t, reason: "Primary Euro IC — Step 3" });
      log.push(`Step 3: ${t} → Primary Euro IC`);
    }
  });

  if (age < 30) {
    ["Scandinavia", "ISE"].forEach(t => {
      if (gate3Results.results[t] !== "ELIMINATED" && !hierarchy.find(h => h.trip === t)) {
        hierarchy.push({ trip: t, reason: "Secondary YP Euro — Step 4" });
        log.push(`Step 4: ${t} → Secondary YP (trumps Secondary Euro IC under 30)`);
      }
    });
  }

  SECONDARY_EURO_IC.forEach(t => {
    if (gate3Results.results[t] !== "ELIMINATED" && !hierarchy.find(h => h.trip === t)) {
      hierarchy.push({ trip: t, reason: "Secondary Euro IC — Step 4/5" });
      log.push(`${t} → Secondary Euro IC`);
    }
  });

  if (age >= 30) {
    log.push("Step 5: Age 30+ — IC governs all remaining Euro SDs");
  }

  TRIPS.filter(t => t.region === "Europe" && !["Big4","ContinentalPB"].includes(t.type))
    .forEach(trip => {
      if (gate3Results.results[trip.abbr] !== "ELIMINATED" &&
          !hierarchy.find(h => h.trip === trip.abbr)) {
        hierarchy.push({ trip: trip.abbr, reason: `Remaining Euro SD (T${trip.tier})` });
      }
    });

  return { hierarchy, log };
}

// ── Gate 12: Language Proficiency Matching ────────────────────────

function gate12(profile) {
  const log = [];
  const scores = {};
  const profMultiplier = { native: 3, proficient: 2, "little bit": 1 };

  const spokenMap = {};
  (profile.languages || []).forEach(l => {
    spokenMap[l.lang.toLowerCase()] = l.level;
  });

  TRIPS.forEach(trip => {
    const matrix = LANGUAGE_MATRIX[trip.abbr];
    if (!matrix) { scores[trip.abbr] = 0; return; }
    let score = 0;
    matrix.forEach(({ lang, w }) => {
      const level = spokenMap[lang.toLowerCase()];
      if (level) score += w * (profMultiplier[level] || 0);
    });
    scores[trip.abbr] = score;
  });

  const compounding = {};
  Object.keys(spokenMap).forEach(lang => {
    const level = spokenMap[lang];
    const mult = profMultiplier[level] || 0;
    let tripCount = 0;
    TRIPS.forEach(trip => {
      const mx = LANGUAGE_MATRIX[trip.abbr] || [];
      if (mx.some(m => m.lang.toLowerCase() === lang)) tripCount++;
    });
    compounding[lang] = { tripCount, multiplier: mult, compound: tripCount * mult };
  });

  Object.entries(scores).filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1])
    .forEach(([trip, score]) => log.push(`${trip}: ${score}`));

  Object.entries(compounding).forEach(([lang, data]) => {
    if (data.compound > 0)
      log.push(`Compounding — ${lang}: ${data.tripCount} trips × ${data.multiplier}x = ${data.compound}`);
  });

  return { scores, compounding, log };
}

// ── Gate 13: Profile Alignment Flags ─────────────────────────────

function gate13(profile) {
  const flags = {};
  const flagCounts = {};
  const log = [];

  TRIPS.forEach(trip => {
    const a = trip.abbr;
    const tf = [];

    if (profile.wildlife_interest >= 8 &&
        FLAG_THRESHOLDS.wildlife.trips.includes(a)) tf.push("wildlife");

    if (profile.hiking >= 4 && profile.landscapes.mountains >= 7 &&
        FLAG_THRESHOLDS.hiking_mountains.trips.includes(a)) tf.push("hiking_mountains");

    if (profile.performing_arts >= 8 &&
        FLAG_THRESHOLDS.performing_arts.trips.includes(a)) tf.push("performing_arts");

    if (profile.art >= 4 &&
        FLAG_THRESHOLDS.art.trips.includes(a)) tf.push("art");

    if ((profile.snorkeling >= 4 || profile.scuba >= 4) &&
        FLAG_THRESHOLDS.scuba_snorkel.trips.includes(a)) tf.push("scuba_snorkel");

    if (profile.roadTrip === "love" &&
        FLAG_THRESHOLDS.road_trip.trips.includes(a)) tf.push("road_trip");

    if (profile.extrovert >= 7 &&
        FLAG_THRESHOLDS.extrovert.trips.includes(a)) tf.push("extrovert");

    if ((profile.camping >= 4 || profile.backpacking >= 4) &&
        FLAG_THRESHOLDS.camping_backpacking.trips.includes(a)) tf.push("camping_backpacking");

    if (profile.landscapes.deserts >= 7 &&
        FLAG_THRESHOLDS.deserts.trips.includes(a)) tf.push("deserts");

    if (profile.foodie === true &&
        FLAG_THRESHOLDS.foodie.trips.includes(a)) tf.push("foodie");

    if (profile.landscapes.beaches >= 8 &&
        FLAG_THRESHOLDS.beaches.trips.includes(a)) tf.push("beaches");

    if (profile.landscapes.rainforests >= 7 &&
        FLAG_THRESHOLDS.rainforests.trips.includes(a)) tf.push("rainforests");

    if (profile.landscapes.lakes >= 7 &&
        FLAG_THRESHOLDS.lakes.trips.includes(a)) tf.push("lakes");

    if (profile.sailing >= 4 && FLAG_THRESHOLDS.lakes.trips.includes(a) &&
        !tf.includes("lakes")) tf.push("lakes_via_sailing");

    if (profile.history_rating >= 4 &&
        FLAG_THRESHOLDS.history.trips.includes(a)) tf.push("history");

    if (profile.trainPref === "train" &&
        FLAG_THRESHOLDS.train_preference.trips.includes(a)) tf.push("train_preference");

    if (profile.landscapes.vineyards >= 7 &&
        FLAG_THRESHOLDS.vineyards_wine.trips.includes(a)) tf.push("vineyards_wine");

    if (profile.sailing >= 4 &&
        FLAG_THRESHOLDS.sailing_boating.trips.includes(a)) tf.push("sailing_boating");

    if (profile.fishing >= 4 &&
        FLAG_THRESHOLDS.fishing.trips.includes(a)) tf.push("fishing");

    if (profile.golf >= 4 &&
        FLAG_THRESHOLDS.golf.trips.includes(a)) tf.push("golf");

    // gardens — proxy on art >= 4 until profile schema
    // grows a dedicated gardens field.
    if (profile.art >= 4 &&
        FLAG_THRESHOLDS.gardens.trips.includes(a)) tf.push("gardens");

    if (profile.fearSnakes === true &&
        FLAG_THRESHOLDS.fear_snakes.trips.includes(a)) tf.push("fear_snakes");

    // fearHeights AIQC disclosure flag.
    if (profile.fearHeights === true &&
        FLAG_THRESHOLDS.fear_heights.trips.includes(a)) tf.push("fear_heights");

    if (FLAG_THRESHOLDS.left_side_driving.trips.includes(a)) tf.push("left_side_driving");

    if (FLAG_THRESHOLDS.right_side_driving.trips.includes(a)) tf.push("right_side_driving");

    if (profile.friendsFamilyCountries && profile.friendsFamilyCountries.length > 0) {
      if (trip.spineCountries.some(sc => countryInList(sc, profile.friendsFamilyCountries))) {
        tf.push("friends_family");
      }
    }

    flags[a] = tf;
    let count = tf.filter(f => f !== "friends_family").length;
    if (tf.includes("friends_family")) count += 2;
    flagCounts[a] = count;
  });

  // v2.25 fix #8: fear_heights added to disclosure list.
  const DISCLOSURE_FLAGS = ["fear_snakes","fear_heights","left_side_driving","right_side_driving"];

  Object.entries(flagCounts).filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1])
    .forEach(([trip]) => {
      const tf = flags[trip];
      const align = tf.filter(f => !DISCLOSURE_FLAGS.includes(f));
      const disc = filterDrivingDisclosures(tf.filter(f => DISCLOSURE_FLAGS.includes(f)), profile);
      let line = `${trip}: ${align.join(", ") || "(none)"}`;
      if (disc.length > 0) line += `  |  Disclosures: ${disc.join(", ")}`;
      log.push(line);
    });

  return { flags, flagCounts, log };
}

// ── Gate 14: Unserved Dimension Analysis ─────────────────────────

function gate14(profile, gate13Result, candidatePool) {
  const DIMENSIONS = {
    "outdoor/adventure":     ["hiking_mountains","camping_backpacking","road_trip"],
    "fun/social":            ["extrovert"],
    "cultural/intellectual": ["history","art"],
    "wildlife/nature":       ["wildlife","rainforests"],
    "performing_arts":       ["performing_arts"],
    "visual_art":            ["art"],
    "food/culinary":         ["foodie"],
    "beach/water":           ["beaches","scuba_snorkel","sailing_boating"],
    "mountain/alpine":       ["hiking_mountains","lakes"],
    "road_trip":             ["road_trip"],
  };

  const relevant = {};
  const servingTrips = {};
  const log = [];

  Object.entries(DIMENSIONS).forEach(([dim, flagNames]) => {
    relevant[dim] = flagNames.some(fn =>
      Object.values(gate13Result.flags).some(tf => tf.includes(fn)));
  });

  Object.entries(DIMENSIONS).forEach(([dim, flagNames]) => {
    if (!relevant[dim]) return;
    servingTrips[dim] = candidatePool.filter(tripAbbr => {
      const tf = gate13Result.flags[tripAbbr] || [];
      return flagNames.some(fn => tf.includes(fn));
    });
    const count = servingTrips[dim].length;
    if (count === 0) log.push(`${dim}: 0 trips`);
    else log.push(`${dim}: ${count} trip${count === 1 ? "" : "s"} (${servingTrips[dim].join(", ")})`);
  });

  return { relevant, servingTrips, log };
}

// ── Gate 15: Ranking Assembly ────────────────────────────────────

// Unified scoring function (v2.34) — computes a single point score
// for a non-Big4 trip. Higher score = higher T8 priority. The unified
// scoring engine inside gate15 calls this for every eligible candidate
// then sorts and fills T8/N5 by score.
function unifiedScore(abbr, profile, g2, g4, g6, g13, top8, saForkSelected) {
  const trip = findTrip(abbr);
  if (!trip) return -Infinity;

  let score = 0;
  const st = g4.tripStatuses[abbr] || "";
  const age = profile.age;
  const ypActive = age < 30;

  // Continental PB bonus
  if (trip.type === "ContinentalPB") {
    // Zero out Peru's PB bonus for virgin + 3 Big4s on T8 at scoring time
    const big4Count = top8.filter(t => {
      const tr = findTrip(t);
      return tr && tr.type === "Big4";
    }).length;
    const isVirginWith3Big4s = g2.isVirgin && big4Count >= 3;
    const homeRegion = resolveResidenceRegion(profile);
    if (abbr === "Peru" && isVirginWith3Big4s) {
      // Peru gets no PB bonus — competes on raw merit
    } else if (abbr === "NZ" && homeRegion === "Oceania") {
      // NZ gets no PB bonus — Oceanian resident, backyard trip
    } else {
      score += 60;
    }
  }

  // YP scoring (age-gated)
  if (ypActive) {
    if (PRIMARY_YP.includes(abbr)) score += 50;
    else if (SECONDARY_YP.includes(abbr)) score += 20;
  }

  // IC scoring (age-scaled)
  const PRIMARY_EURO_IC = ["Italy North", "Spain North", "Switzerland West", "Greece"];
  const SEC_EURO_IC = ["Italy South", "Italy M&L", "Switzerland East"];
  if (PRIMARY_EURO_IC.includes(abbr)) {
    score += (age >= 30) ? 25 : 15;
  } else if (SEC_EURO_IC.includes(abbr)) {
    score += 5;
  }

  // Untouched continent
  if (st.startsWith("UNTOUCHED")) score += 20;

  // Tier bonus
  if (trip.tier === 1) score += 15;

  // Essential cities (unvisited only)
  const visitedCities = new Set([
    ...(profile.visitedCECities || []),
    ...(profile.visitedCACities || []),
    ...(profile.visitedCAfCities || []),
    ...(profile.visitedCCCities || []),
  ]);
  for (const [city, trips] of Object.entries(ESSENTIAL_CITIES)) {
    if (trips.includes(abbr) && !visitedCities.has(city)) {
      if (["London","Paris","New York","Tokyo"].includes(city)) score += 20;
      else if (["San Francisco","Washington DC","Madrid","Rome","Amsterdam","Sydney"].includes(city)) score += 12;
      else score += 5;
    }
  }

  // Friends/Family on spine
  if (profile.friendsFamilyCountries && profile.friendsFamilyCountries.length > 0) {
    if (trip.spineCountries.some(sc =>
      profile.friendsFamilyCountries.some(fc => normalizeCountry(fc) === normalizeCountry(sc)))) {
      score += 15;
    }
  }

  // Alignment flag count (uses existing flagCounts which already weights F/F at +2)
  score += (g13.flagCounts[abbr] || 0) * 2;

  // Language proficiency scoring
  score += computeLangScore(abbr, profile.languages || []);

  // Australia logistical burden
  if (abbr === "Australia") score -= 25;

  // MENA age suppression for under-30
  if (abbr === "MENA" && age < 30) score -= 20;

  // MENA Mature Premium Elevation (30+)
  if (abbr === "MENA" && age >= 30) {
    const ssaTouched = g4.touchedRegions.includes("SSA");
    const indiaVisited = (profile.visitedCountries || []).some(c =>
      normalizeCountry(c) === "India");
    const chinaVisited = (profile.visitedCountries || []).some(c =>
      normalizeCountry(c) === "China");
    if (ssaTouched || indiaVisited || chinaVisited) {
      score += 30;
    }
  }

  // Scandinavia Mature Premium (30+) — no qualification gate
  if (abbr === "Scandinavia" && age >= 30) score += 30;

  // Greece Mature Premium (30+) — no qualification gate
  if (abbr === "Greece" && age >= 30) score += 30;

  // Italy North Primary Depth bonus (30+)
  if (abbr === "Italy North" && age >= 30) {
    const italyVisited = (profile.visitedCountries || []).some(c =>
      normalizeCountry(c) === "Italy");
    if (!italyVisited) {
      score += 30;
    } else {
      if (age >= 45) score += 30;
      else if (age >= 36) score += 20;
      else score += 15;
    }
  }

  // SA Fork selected trip bonus
  if (saForkSelected && abbr === saForkSelected) score += 25;

  return score;
}

function gate15(profile, allGates, g17Result) {
  const { gate1: g1, gate2: g2, gate3: g3, gate4: g4, gate5: g5,
          gate6: g6, gate7: g7, gate8: g8, gate9: g9, gate10: g10,
          gate11: g11, gate12: g12, gate13: g13 } = allGates;

  const log = [];
  const top8 = [];
  const next5 = [];
  const regionCounts = {};
  let asiaCount = 0;

  // Unified scoring engine state (v2.34)
  let saForkSelected = null;
  let tanzaniaExcluded = false;

  const isExcluded = (abbr) => {
    if (g1.excluded.includes(abbr)) return true;
    if (g3.results[abbr] === "ELIMINATED") return true;
    if (g9.applies && g9.hardExcluded.includes(abbr)) return true;
    return false;
  };

  const getRegion = (abbr) => findTrip(abbr)?.region;

  const canAddRegion = (abbr) => {
    const region = getRegion(abbr);
    if (!region) return true;
    return (regionCounts[region] || 0) < (g6.caps[region] || 2);
  };

  const canAddAsia = (abbr) => {
    const trip = findTrip(abbr);
    if (!trip || trip.region !== "Asia") return true;
    return asiaCount < g5.maxAsiaOnTop8;
  };

  const addTo = (abbr, list, reason) => {
    if (isExcluded(abbr) || top8.includes(abbr) || next5.includes(abbr)) return false;
    if (list === top8 && top8.length >= 8) return false;
    if (list === next5 && next5.length >= 5) return false;
    if (list === next5 && g17Result && g17Result.cnr === abbr) {
      log.push(`${abbr}: SKIP — Gate 17 CNR (${g17Result.selected} selected)`);
      return false;
    }
    if (list === top8 && !canAddRegion(abbr)) {
      log.push(`${abbr}: SKIP — continent cap (${getRegion(abbr)})`);
      return false;
    }
    if (list === top8 && !canAddAsia(abbr)) {
      log.push(`${abbr}: SKIP — Asia allocation cap`);
      return false;
    }
    list.push(abbr);
    const region = getRegion(abbr);
    if (list === top8 && region) regionCounts[region] = (regionCounts[region] || 0) + 1;
    if (findTrip(abbr)?.region === "Asia" && list === top8) asiaCount++;
    log.push(`${abbr} → ${list === top8 ? "TOP 8" : "NEXT 5"} [${reason}]`);
    return true;
  };

  g7.ordered.forEach(b => addTo(b, top8, "Big4 — G7"));

  // OLD: replaced by unified scoring engine. Continental PBs (Peru, NZ)
  // now compete on score. Peru gets +60 unless virgin+3Big4s, NZ gets +60.
  // g8.pbs.forEach(pb => {
  //   if (!g8.displaced.includes(pb)) addTo(pb, top8, "Continental PB — G8");
  //   else log.push(`${pb}: PB DISPLACED`);
  // });

  const getBucket = (abbr) => {
    const t = findTrip(abbr);
    if (!t) return 99;
    const st = g4.tripStatuses[abbr] || "";
    const un = st.startsWith("UNTOUCHED");
    const fc = g13.flagCounts[abbr] || 0;
    const isYP = PRIMARY_YP.includes(abbr) || SECONDARY_YP.includes(abbr);
    const isIC = SECONDARY_EURO_IC.includes(abbr) || abbr === "Spain North";
    const isOB = t.type === "SD_OB";
    const isEI = t.type === "ExoticIsland";

    if (isEI) return 9;
    if (!isOB && !isEI && un && t.tier === 1 && (fc >= 3 || isYP || isIC)) return 1;
    if (!isOB && !isEI && ((isYP && !un) || (un && t.tier === 2))) return 2;
    if (!isOB && !isEI && un && t.tier === 1 && fc < 3 && !isYP && !isIC) return 3;
    if (!isOB && !isEI && !un) return 4;
    if (isOB && un && t.tier === 1) return 5;
    if (isOB && un && t.tier === 2) return 6;
    if (isOB && !un) return 7;
    return 8;
  };

  const allSDs = TRIPS
    .filter(t => !["Big4","ContinentalPB"].includes(t.type))
    .map(t => t.abbr)
    .filter(a => !isExcluded(a));

  const sdSorted = allSDs.sort((a, b) => {
    const ba = getBucket(a);
    const bb = getBucket(b);
    if (ba !== bb) return ba - bb;
    const ta = findTrip(a);
    const tb = findTrip(b);
    if (ta?.region === "Europe" && tb?.region === "Europe") {
      const ia = g11.hierarchy.findIndex(h => h.trip === a);
      const ib = g11.hierarchy.findIndex(h => h.trip === b);
      if (ia !== -1 && ib !== -1) return ia - ib;
      if (ia !== -1) return -1;
      if (ib !== -1) return 1;
    }
    return (g13.flagCounts[b] || 0) - (g13.flagCounts[a] || 0);
  });

  sdSorted.forEach(abbr => {
    if (top8.length < 8) {
      const pos = top8.length + 1;
      if (pos >= 5 && g9.applies && g9.virginFlagged.includes(abbr)) {
        addTo(abbr, next5, `VirginDefer pos ${pos}`);
        return;
      }
      // Big 4 SD blocking: check if this SD is blocked by an eligible Big 4 on T8
      for (const [big4, blockedSDs] of Object.entries(BIG4_SD_BLOCKS)) {
        if (blockedSDs.includes(abbr) && top8.includes(big4)) {
          log.push(`${abbr}: BLOCKED — ${big4} on T8 (Big 4 SD blocking rule: complete ${big4} first)`);
          return;
        }
      }
      if (!addTo(abbr, top8, `SD B${getBucket(abbr)}`)) {
        addTo(abbr, next5, "SD overflow (cap)");
      }
    } else {
      addTo(abbr, next5, "SD overflow");
    }
  });

  g8.displaced.forEach(pb => {
    if (!top8.includes(pb) && !next5.includes(pb))
      addTo(pb, next5, "Displaced PB backfill");
  });

  const mechanicallyDisplaced = [];
  let menaJustElevated = false;
  let seaPlacedByMech2 = false;

  // ── MECHANISM 1: SA Three-Way Fork ────────────────────────────
  // v2.34: SA Fork now sets saForkSelected flag instead of swapping
  // arrays. The unified scoring engine adds +25 to the selected trip.
  // SA Fork is skipped entirely when virgin+3Big4s (Peru's PB bonus
  // is zeroed in scoring; SA Fork should be inert in that case too).

  const big4CountOnT8 = top8.filter(a => {
    const t = findTrip(a);
    return t && t.type === "Big4";
  }).length;
  const skipSAFork = g2.isVirgin && big4CountOnT8 >= 3;

  if (skipSAFork) {
    log.push(`SA Fork: SKIPPED — virgin + ${big4CountOnT8} Big4s on T8 (Peru displacement expected; saForkSelected stays null)`);
  } else {
    const patagoniaQualifies = (
      // Path 1: Maximum hiking passion alone (serious hiker)
      ((profile.hiking || 0) >= 5 && (profile.fitness || 0) >= 7) ||
      // Path 2: Strong hiking + backpacking combination
      ((profile.hiking || 0) >= 4 && (profile.backpacking || 0) >= 4 &&
       (profile.landscapes.mountains || 0) >= 7 && (profile.outdoors || 0) >= 8)
    );

    const galapagosActivityScore = (profile.scuba || 0) + (profile.snorkeling || 0) + Math.round((profile.wildlife_interest || 0) / 2);
    const patagoniaActivityScore = (profile.hiking || 0) + (profile.backpacking || 0) + Math.round((profile.landscapes?.mountains || 0) / 2);
    const galapagosQualifies = (
      (profile.wildlife_interest || 0) >= 8 &&
      ((profile.scuba || 0) >= 4 || (profile.snorkeling || 0) >= 4 || (profile.sailing || 0) >= 4) &&
      galapagosActivityScore > patagoniaActivityScore
    );

    const baQualifies = (
      (profile.extrovert || 0) >= 6 ||
      (profile.landscapes.beaches || 0) >= 6
    );

    // Determine the right SA trip
    let rightSA;
    const qualifiers = [];
    if (patagoniaQualifies) qualifiers.push("Patagonia");
    if (galapagosQualifies) qualifiers.push("Galápagos");
    if (baQualifies) qualifiers.push("B&A");

    if (qualifiers.length === 0) {
      const candidates = ["Patagonia", "Galápagos", "B&A"].filter(a => !isExcluded(a));
      let bestCandidate = candidates[0];
      let bestFlags = -1;
      candidates.forEach(c => {
        const fc = g13.flagCounts[c] || 0;
        if (fc > bestFlags) { bestFlags = fc; bestCandidate = c; }
      });
      rightSA = bestCandidate;
      log.push(`SA Fork: no prong qualifies positively — ${rightSA} selected by flag count (${bestFlags})`);
    } else if (qualifiers.length === 1) {
      rightSA = qualifiers[0];
    } else {
      if (qualifiers.includes("Patagonia") && profile.age < 30) {
        rightSA = "Patagonia";
      } else if (qualifiers.includes("Galápagos")) {
        rightSA = "Galápagos";
      } else if (qualifiers.includes("Patagonia")) {
        rightSA = "Patagonia";
      } else {
        rightSA = "B&A";
      }
      log.push(`SA Fork: multiple qualify [${qualifiers.join(", ")}] — tiebreak selects ${rightSA}`);
    }

    // v2.34: set flag instead of swapping arrays
    if (!isExcluded(rightSA)) {
      saForkSelected = rightSA;
      log.push(`SA Fork: ${rightSA} SELECTED — saForkSelected flag set (+25 in unified scoring)`);
    } else {
      log.push(`SA Fork: ${rightSA} excluded — saForkSelected stays null`);
    }

    log.push(`SA Fork evaluation: Patagonia ${patagoniaQualifies ? "QUALIFIES" : "no"}, Galápagos ${galapagosQualifies ? "QUALIFIES" : "no"}, B&A ${baQualifies ? "QUALIFIES" : "no"}, selected ${rightSA}`);
  }

  // ── MECHANISM 2: Asia SE Asia Default for Under-30 ────────────
  // OLD: replaced by unified scoring engine + Big4 SD blocking.
  // SE Asia now competes on score (1YP +50 plus untouched Asia +20
  // usually wins it a T8 spot naturally). The blocker function
  // (preventing India North / China East from taking second Asia
  // slot under-30) is now handled by Big4 SD Blocking — CA blocks
  // both India North and China East.
  //
  // if (
  //   profile.age < 30 &&
  //   !isExcluded("SE Asia") &&
  //   !top8.includes("SE Asia") &&
  //   next5.includes("SE Asia")
  // ) {
  //   const asiaOnT8 = top8.filter(abbr => {
  //     const trip = findTrip(abbr);
  //     return trip && trip.region === "Asia" && trip.type !== "Big4";
  //   });
  //
  //   if (asiaOnT8.length > 0) {
  //     const beaches = profile.landscapes.beaches || 0;
  //     const extrovert = profile.extrovert || 0;
  //     const snorkeling = profile.snorkeling || 0;
  //     const scuba = profile.scuba || 0;
  //
  //     const seAsiaHostile = (
  //       beaches <= 2 &&
  //       extrovert <= 3 &&
  //       snorkeling <= 1 &&
  //       scuba <= 1
  //     );
  //
  //     if (!seAsiaHostile) {
  //       const displaced = asiaOnT8[asiaOnT8.length - 1];
  //       const t8Idx = top8.indexOf(displaced);
  //       const n5Idx = next5.indexOf("SE Asia");
  //
  //       if (t8Idx !== -1 && n5Idx !== -1) {
  //         top8[t8Idx] = "SE Asia";
  //         next5[n5Idx] = displaced;
  //         mechanicallyDisplaced.push(displaced);
  //         seaPlacedByMech2 = true;
  //         log.push(`SE Asia: DEFAULT second Asia slot for under-30 (displaced ${displaced} to N5)`);
  //         log.push(`${displaced}: DISPLACED — SE Asia is the natural second Asia step (beaches ${beaches}, extrovert ${extrovert}, snorkel ${snorkeling}, scuba ${scuba})`);
  //       }
  //     } else {
  //       log.push(`SE Asia: under-30 default BLOCKED — profile is SE-Asia-hostile (beaches ${beaches}, extrovert ${extrovert}, snorkel ${snorkeling}, scuba ${scuba}) — current Asia selection holds`);
  //     }
  //   }
  // }

  // ── MECHANISM 3: Tanzania Opportunity Cost ─────────────────────
  // v2.34: simplified to membership-only. When SSA is touched and
  // CAf is eliminated and the traveler has 3+ untouched continents,
  // Tanzania is excluded from the unified scoring candidate pool
  // (goes directly to N5 territory or below). The unified engine
  // handles promotion implicitly by scoring the remaining candidates.

  const ssaTouched = g4.touchedRegions.includes("SSA");
  const cafIsEliminated = g3.results["CAf"] === "ELIMINATED";
  const untouchedContinents = ["Asia", "Europe", "SSA", "South America", "Oceania", "MENA"]
    .filter(r => !g4.touchedRegions.includes(r) && r !== resolveResidenceRegion(profile));

  if (
    ssaTouched &&
    cafIsEliminated &&
    untouchedContinents.length >= 3
  ) {
    tanzaniaExcluded = true;
    log.push(`Tanzania: EXCLUDED by opportunity cost (SSA touched, CAf eliminated, ${untouchedContinents.length} untouched continents) — unified engine will skip Tanzania in candidate pool`);
  }

  // OLD: replaced by unified scoring engine. The promotion scoring
  // logic (allPromotionCandidates, scoring loop, bestAbbr selection)
  // is no longer needed — the unified engine scores all remaining
  // candidates and the highest-scoring eligible trip wins the slot.

  // ── MECHANISM 4: ISE Hammer Mechanical Swap ───────────────────
  // When ISE has F/F on spine and London is NOT presumed captured,
  // and the opponent's unique alignment flags are all redundant,
  // ISE displaces the opponent.

  if (
    next5.includes("ISE") &&
    !mechanicallyDisplaced.includes("ISE")
  ) {
    const iseFlags = g13.flags["ISE"] || [];
    const iseHasFF = iseFlags.includes("friends_family");

    const ukVisited = (profile.visitedCountries || []).some(c =>
      normalizeCountry(c) === "UK"
    );

    if (iseHasFF && !ukVisited) {
      const DISC_FLAGS = ["fear_snakes","fear_heights","left_side_driving","right_side_driving"];

      const euroT8 = top8.filter(abbr => {
        const trip = findTrip(abbr);
        if (!trip || trip.region !== "Europe") return false;
        if (PRIMARY_YP.includes(abbr)) return false;
        if (abbr === "Spain North") return false;
        return true;
      });

      euroT8.forEach(opponent => {
        if (!top8.includes("ISE") && next5.includes("ISE")) {
          const oppFlags = (g13.flags[opponent] || []).filter(f =>
            !DISC_FLAGS.includes(f) && f !== "friends_family"
          );

          const iseAlignFlags = (g13.flags["ISE"] || []).filter(f =>
            !DISC_FLAGS.includes(f) && f !== "friends_family"
          );

          // Cancel shared flags between ISE and opponent
          const sharedFlags = oppFlags.filter(f => iseAlignFlags.includes(f));
          const oppUniqueFlags = oppFlags.filter(f => !iseAlignFlags.includes(f));

          // Check if ALL of opponent's unique-after-cancellation flags are
          // redundant on T8 (served by 3+ other providers)
          const allUniqueRedundant = oppUniqueFlags.length === 0 || oppUniqueFlags.every(flag => {
            const providers = top8.filter(t8 => {
              if (t8 === opponent) return false;
              const tf = g13.flags[t8] || [];
              return tf.includes(flag);
            });
            return providers.length >= 3;
          });

          // Also check ISE has at least one non-redundant unique advantage
          const iseUniqueFlags = iseAlignFlags.filter(f => !oppFlags.includes(f));
          const iseHasFFAdvantage = iseFlags.includes("friends_family") &&
            !(g13.flags[opponent] || []).includes("friends_family");

          // ISE also has London Top 4 — check if opponent has a Top 4 city
          let iseHasCityAdvantage = false;
          const iseCities = [];
          const oppCities = [];
          for (const [city, trips] of Object.entries(ESSENTIAL_CITIES)) {
            if (trips.includes("ISE")) {
              if (["London","Paris","New York","Tokyo"].includes(city)) iseCities.push(city);
            }
            if (trips.includes(opponent)) {
              if (["London","Paris","New York","Tokyo"].includes(city)) oppCities.push(city);
            }
          }
          iseHasCityAdvantage = iseCities.length > oppCities.length;

          // Hammer fires when: opponent's unique residuals are all redundant
          // AND ISE has lopsided advantages (F/F + city)
          if (allUniqueRedundant && (iseHasFFAdvantage || iseHasCityAdvantage)) {
            const oppIdx = top8.indexOf(opponent);
            const iseIdx = next5.indexOf("ISE");

            if (oppIdx !== -1 && iseIdx !== -1) {
              top8[oppIdx] = "ISE";
              next5[iseIdx] = opponent;
              mechanicallyDisplaced.push(opponent);
              log.push(`ISE: HAMMER — displaces ${opponent} on T8 (shared flags cancelled: [${sharedFlags.join(", ")}], ${opponent} unique: [${oppUniqueFlags.join(", ")}] all redundant, ISE has F/F=${iseHasFFAdvantage} cityAdvantage=${iseHasCityAdvantage})`);
              log.push(`${opponent}: DISPLACED to N5 by ISE hammer`);
            }
          }
        }
      });
    }
  }

  // ── MECHANISM 5: Language Proficiency Elevation ────────────────
  // Ensure proficient/native non-English language trips get N5
  // representation at minimum.

  const proficientLangs = (profile.languages || []).filter(l =>
    (l.level === "proficient" || l.level === "native") &&
    l.lang.toLowerCase() !== "english"
  );

  proficientLangs.forEach(({ lang }) => {
    const langLower = lang.toLowerCase();

    // Find all trips where this language has weight 5 (full trip)
    const fullTripDestinations = [];
    Object.entries(LANGUAGE_MATRIX).forEach(([tripKey, matrix]) => {
      if (matrix.some(m => m.lang.toLowerCase() === langLower && m.w === 5)) {
        fullTripDestinations.push(tripKey);
      }
    });

    // Check if any are already on T8 or N5
    const onT8orN5 = fullTripDestinations.some(t =>
      top8.includes(t) || next5.includes(t)
    );

    if (!onT8orN5 && fullTripDestinations.length > 0) {
      // Find the best eligible candidate not already excluded or placed
      let bestCandidate = null;
      let bestScore = -Infinity;

      fullTripDestinations.forEach(tripKey => {
        if (isExcluded(tripKey)) return;
        if (top8.includes(tripKey) || next5.includes(tripKey)) return;
        if (mechanicallyDisplaced.includes(tripKey)) return;

        const trip = findTrip(tripKey);
        if (!trip) return;

        let score = 0;
        const st = g4.tripStatuses[tripKey] || "";
        if (st.startsWith("UNTOUCHED")) score += 100;
        if (trip.tier === 1) score += 50;
        if (PRIMARY_YP.includes(tripKey)) score += 30;
        else if (SECONDARY_YP.includes(tripKey)) score += 15;
        if ((g13.flags[tripKey] || []).includes("friends_family")) score += 20;
        for (const [city, trips] of Object.entries(ESSENTIAL_CITIES)) {
          if (trips.includes(tripKey)) {
            if (["London","Paris","New York","Tokyo"].includes(city)) score += 12;
            else if (["San Francisco","Washington DC","Madrid","Rome","Amsterdam","Sydney"].includes(city)) score += 8;
            else score += 4;
          }
        }
        score += (g13.flagCounts[tripKey] || 0);

        if (score > bestScore) {
          bestScore = score;
          bestCandidate = tripKey;
        }
      });

      if (bestCandidate) {
        // If N5 is full (5 trips), displace the weakest
        if (next5.length >= 5) {
          let weakestIdx = 0;
          let weakestScore = Infinity;

          next5.forEach((abbr, idx) => {
            const trip = findTrip(abbr);
            if (!trip) return;

            let score = 0;
            const st = g4.tripStatuses[abbr] || "";
            if (st.startsWith("UNTOUCHED")) score += 100;
            if (trip.tier === 1) score += 50;
            if (PRIMARY_YP.includes(abbr)) score += 30;
            else if (SECONDARY_YP.includes(abbr)) score += 15;
            if ((g13.flags[abbr] || []).includes("friends_family")) score += 20;
            for (const [city, trips] of Object.entries(ESSENTIAL_CITIES)) {
              if (trips.includes(abbr)) {
                if (["London","Paris","New York","Tokyo"].includes(city)) score += 12;
                else if (["San Francisco","Washington DC","Madrid","Rome","Amsterdam","Sydney"].includes(city)) score += 8;
                else score += 4;
              }
            }
            score += (g13.flagCounts[abbr] || 0);

            if (score < weakestScore) {
              weakestScore = score;
              weakestIdx = idx;
            }
          });

          const displaced = next5[weakestIdx];
          next5[weakestIdx] = bestCandidate;
          log.push(`${bestCandidate}: PROMOTED to N5 — language proficiency elevation (${lang} proficient, no full-trip ${lang} destination on T8/N5)`);
          log.push(`${displaced}: DISPLACED from N5 by language proficiency elevation (score ${weakestScore} vs ${bestScore})`);
        } else {
          next5.push(bestCandidate);
          log.push(`${bestCandidate}: ADDED to N5 — language proficiency elevation (${lang} proficient, no full-trip ${lang} destination on T8/N5)`);
        }
      }
    }
  });

  // ── MECHANISM 6: MENA Mature Premium Elevation ────────────────
  // OLD: replaced by unified scoring engine MENA MP bonus.
  // MENA now competes on score with the +30 MP bonus (when age >= 30
  // AND (SSA touched OR India visited)). The unified engine naturally
  // places MENA at the right position based on its scored merit.
  /*
  if (
    profile.age >= 30 &&
    !isExcluded("MENA") &&
    !top8.includes("MENA")
  ) {
    const ssaTouched = g4.touchedRegions.includes("SSA");
    const indiaVisited = (profile.visitedCountries || []).some(c =>
      normalizeCountry(c) === "India"
    );

    if (ssaTouched || indiaVisited) {
      // Find the weakest touched-continent European trip on T8
      // that MENA can displace.
      const euroT8 = top8.filter(abbr => {
        const trip = findTrip(abbr);
        if (!trip || trip.region !== "Europe") return false;
        return true;
      });

      // Score MENA vs each European T8 trip.
      let weakestEuro = null;
      let weakestScore = Infinity;

      euroT8.forEach(abbr => {
        let score = 0;
        const trip = findTrip(abbr);
        if (!trip) return;

        // Essential cities
        for (const [city, trips] of Object.entries(ESSENTIAL_CITIES)) {
          if (trips.includes(abbr)) {
            if (["London","Paris","New York","Tokyo"].includes(city)) score += 40;
            else if (["San Francisco","Washington DC","Madrid","Rome","Amsterdam","Sydney"].includes(city)) score += 25;
            else score += 10;
          }
        }

        // F/F
        if ((g13.flags[abbr] || []).includes("friends_family")) score += 30;

        // Dual IC/YP
        const PRIMARY_EURO_IC = ["Italy North", "Spain North", "Switzerland West", "Greece"];
        if (SECONDARY_YP.includes(abbr) && PRIMARY_EURO_IC.includes(abbr)) score += 20;

        // Primary IC
        if (PRIMARY_EURO_IC.includes(abbr)) {
          score += (profile.age >= 30) ? 25 : 15;
        }

        // Flag count
        score += (g13.flagCounts[abbr] || 0);

        if (score < weakestScore) {
          weakestScore = score;
          weakestEuro = abbr;
        }
      });

      if (weakestEuro) {
        // Check MENA's own structural score
        let menaScore = 0;
        const menaSt = g4.tripStatuses["MENA"] || "";
        if (menaSt.startsWith("UNTOUCHED")) menaScore += 30;
        for (const [city, trips] of Object.entries(ESSENTIAL_CITIES)) {
          if (trips.includes("MENA")) {
            if (["London","Paris","New York","Tokyo"].includes(city)) menaScore += 40;
            else if (["San Francisco","Washington DC","Madrid","Rome","Amsterdam","Sydney"].includes(city)) menaScore += 25;
            else menaScore += 10;
          }
        }
        menaScore += (g13.flagCounts["MENA"] || 0);

        // MENA displaces weakest Euro if MENA's score beats it
        if (menaScore > weakestScore) {
          const euroIdx = top8.indexOf(weakestEuro);
          const menaIdx = next5.indexOf("MENA");

          if (euroIdx !== -1) {
            top8[euroIdx] = "MENA";
            if (menaIdx !== -1) {
              // MENA was in N5 — direct swap
              next5[menaIdx] = weakestEuro;
            } else {
              // MENA wasn't in N5 yet; push displaced Euro trip in.
              // (Gate 15's later N5 Second Pass will re-sort N5.)
              next5.push(weakestEuro);
            }
            mechanicallyDisplaced.push(weakestEuro);
            menaJustElevated = true;
            log.push(`MENA: MATURE PREMIUM ELEVATION — displaces ${weakestEuro} on T8 (age ${profile.age}, ${ssaTouched ? 'SSA touched' : 'India visited'}, MENA score ${menaScore} vs ${weakestEuro} score ${weakestScore})`);
            log.push(`${weakestEuro}: DISPLACED to N5 by MENA mature premium`);
          }
        }
      }
    }
  }
  */

  // ── OLD: post-mechanism re-sort, M6 N5 Second Pass, old Euro Floor,
  // cap-dropped N5 displacement, Next 5 re-sort.
  // All replaced by unified scoring engine (v2.34) below.
  /*
  // ── Post-mechanism re-sort of judgment-call zone ──────────────

  // SA Fork pre-pass: SA Fork entries (Patagonia/Galápagos) sink to the
  // bottom of the non-Big4/PB region BEFORE the main re-sort runs. This
  // ensures they land in the judgment zone regardless of where the SA
  // Fork mechanism originally inserted them. We avoid moving past MENA
  // when Mechanism 6 has just elevated it (its position should stick).
  const saForkTrips = top8.filter(abbr => {
    const t = findTrip(abbr);
    return (abbr === "Patagonia" || abbr === "Galápagos") &&
      top8.includes("Peru") && t && t.region === "South America";
  });

  saForkTrips.forEach(sfTrip => {
    const sfIdx = top8.indexOf(sfTrip);
    if (sfIdx === -1) return;

    // Find the last non-Big4/non-PB index, optionally also avoiding a
    // MENA position elevated by Mechanism 6 (it should keep its slot).
    let lastSDIdx = -1;
    for (let i = top8.length - 1; i >= 0; i--) {
      const candidate = top8[i];
      const t = findTrip(candidate);
      if (!t) continue;
      if (t.type === "Big4" || t.type === "ContinentalPB") continue;
      if (menaJustElevated && candidate === "MENA") continue;
      lastSDIdx = i;
      break;
    }

    if (lastSDIdx > sfIdx) {
      top8.splice(sfIdx, 1);
      // After splicing out at sfIdx, indices above sfIdx shift down by 1.
      // Target insertion index is lastSDIdx (not lastSDIdx + 1).
      top8.splice(lastSDIdx, 0, sfTrip);
      log.push(`${sfTrip}: SA Fork pre-pass — moved from #${sfIdx + 1} to #${lastSDIdx + 1} (sink to bottom of SD region before re-sort)`);
    }
  });

  let judgmentStart = 0;
  top8.forEach((abbr, idx) => {
    const trip = findTrip(abbr);
    if (trip && (trip.type === "Big4" || trip.type === "ContinentalPB")) {
      judgmentStart = idx + 1;
    }
  });

  // SE Asia keeps its position only if Mechanism 2 deliberately placed it.
  // For profiles where Mech 2 doesn't fire (age ≥30, or hostile profile),
  // SE Asia competes in the judgment zone normally.
  if (seaPlacedByMech2) {
    top8.forEach((abbr, idx) => {
      if (abbr === "SE Asia" && idx >= judgmentStart) {
        judgmentStart = idx + 1;
      }
    });
  }

  if (judgmentStart < top8.length) {
    const judgmentZone = top8.slice(judgmentStart);

    judgmentZone.sort((a, b) => {
      const ta = findTrip(a);
      const tb = findTrip(b);
      if (!ta || !tb) return 0;

      // SA Fork entries sort last in judgment zone
      const aIsSAFork = (a === "Patagonia" || a === "Galápagos") &&
        top8.includes("Peru") && ta.region === "South America";
      const bIsSAFork = (b === "Patagonia" || b === "Galápagos") &&
        top8.includes("Peru") && tb.region === "South America";

      if (aIsSAFork && !bIsSAFork) return 1;
      if (bIsSAFork && !aIsSAFork) return -1;

      // Untouched continent above touched continent (primary sort factor).
      // Untouched continents are inherently more valuable for the
      // "see new places" objective than YP/IC linkages on a touched
      // continent. Within the same continent-status tier, YP+IC
      // differentiates further.
      const aUntouched = (g4.tripStatuses[a] || "").startsWith("UNTOUCHED") ? 1 : 0;
      const bUntouched = (g4.tripStatuses[b] || "").startsWith("UNTOUCHED") ? 1 : 0;
      if (aUntouched !== bUntouched) return bUntouched - aUntouched;

      // YP and IC scored independently (no dual-bonus shortcut).
      // Greece (1YP/1IC), Spain North (2YP/1IC), Scandinavia (2YP only),
      // Italy South (2YP/2IC) etc. each get distinct YP+IC totals.
      // IC is age-scaled (Primary IC: +25 ≥30, +15 <30).
      const PRIMARY_EURO_IC = ["Italy North", "Spain North", "Switzerland West", "Greece"];
      const SECONDARY_EURO_IC = ["Italy South", "Italy M&L", "Switzerland East"];
      const ypScore = (abbr) => {
        if (profile.age >= 30) return 0;
        if (PRIMARY_YP.includes(abbr)) return 20;
        if (SECONDARY_YP.includes(abbr)) return 10;
        return 0;
      };
      const icScore = (abbr) => {
        if (PRIMARY_EURO_IC.includes(abbr)) return (profile.age >= 30) ? 25 : 15;
        if (SECONDARY_EURO_IC.includes(abbr)) return 5;
        return 0;
      };
      const aYPIC = ypScore(a) + icScore(a);
      const bYPIC = ypScore(b) + icScore(b);
      if (aYPIC !== bYPIC) return bYPIC - aYPIC;

      // T1 above T2
      if (ta.tier !== tb.tier) return ta.tier - tb.tier;

      // Flag count
      return (g13.flagCounts[b] || 0) - (g13.flagCounts[a] || 0);
    });

    for (let i = 0; i < judgmentZone.length; i++) {
      top8[judgmentStart + i] = judgmentZone[i];
    }

    log.push(`Post-mechanism re-sort: judgment zone [${judgmentZone.join(", ")}]`);
  }

  // ── MECHANISM 6: N5 Second Pass — Deliberate Curation ─────────
  // Rebuild N5 from scratch using profile-relevant hook scoring.

  const allEligibleForN5 = TRIPS
    .map(t => t.abbr)
    .filter(abbr => {
      if (top8.includes(abbr)) return false;
      if (isExcluded(abbr)) return false;
      if (g3.results[abbr] === "ELIMINATED") return false;
      if (g9.applies && g9.hardExcluded.includes(abbr)) return false;
      if (g17Result && g17Result.cnr === abbr) return false;
      // Exotic Islands subordinated
      const trip = findTrip(abbr);
      if (trip && trip.type === "ExoticIsland") return false;
      return true;
    });

  const n5Scores = allEligibleForN5.map(abbr => {
    const trip = findTrip(abbr);
    if (!trip) return { abbr, score: -Infinity };

    let score = 0;

    // YP status (time-sensitive, high weight in N5 context)
    if (PRIMARY_YP.includes(abbr)) score += 60;
    else if (SECONDARY_YP.includes(abbr)) score += 40;

    // F/F on spine (personal connection, high weight)
    if ((g13.flags[abbr] || []).includes("friends_family")) score += 50;

    // Language proficiency match
    const profLangs = (profile.languages || [])
      .filter(l => (l.level === "proficient" || l.level === "native") && l.lang.toLowerCase() !== "english")
      .map(l => l.lang.toLowerCase());
    const tripLangMatrix = LANGUAGE_MATRIX[abbr] || [];
    const langMatch = tripLangMatrix.find(m =>
      m.w === 5 && profLangs.includes(m.lang.toLowerCase())
    );
    if (langMatch) {
      const otherSignificantLangs = tripLangMatrix.filter(m =>
        m.lang.toLowerCase() !== langMatch.lang.toLowerCase() && m.w >= 3
      );
      if (otherSignificantLangs.length === 0) {
        score += 100;
        log.push(`  ${abbr}: language PURE immersion +100 (${langMatch.lang})`);
      } else {
        score += 70;
        log.push(`  ${abbr}: language MIXED immersion +70 (${langMatch.lang}, also ${otherSignificantLangs.map(l => l.lang).join("/")})`);
      }
    }

    // Essential city delivery (unvisited)
    const visitedCities = new Set([
      ...(profile.visitedCECities || []),
      ...(profile.visitedCACities || []),
      ...(profile.visitedCAfCities || []),
      ...(profile.visitedCCCities || []),
    ]);
    for (const [city, trips] of Object.entries(ESSENTIAL_CITIES)) {
      if (trips.includes(abbr) && !visitedCities.has(city)) {
        if (["London","Paris","New York","Tokyo"].includes(city)) score += 40;
        else if (["San Francisco","Washington DC","Madrid","Rome","Amsterdam","Sydney"].includes(city)) score += 25;
        else score += 10;
      }
    }

    // 2YP + Top 10+ essential city interaction bonus
    if (SECONDARY_YP.includes(abbr) || PRIMARY_YP.includes(abbr)) {
      let hasTop10City = false;
      for (const [city, trips] of Object.entries(ESSENTIAL_CITIES)) {
        if (trips.includes(abbr)) {
          if (["London","Paris","New York","Tokyo","San Francisco","Washington DC","Madrid","Rome","Amsterdam","Sydney"].includes(city)) {
            hasTop10City = true;
            break;
          }
        }
      }
      if (hasTop10City && profile.age < 30) {
        score += 25;
      }
    }

    // Untouched continent (still matters but weighted lower than T8)
    const st = g4.tripStatuses[abbr] || "";
    if (st.startsWith("UNTOUCHED")) score += 15;

    // Tier bonus
    if (trip.tier === 1) score += 15;

    // Australia logistical burden penalty
    if (abbr === "Australia") {
      score -= 35;
    }

    // Alignment flag count
    score += (g13.flagCounts[abbr] || 0) * 2;

    // Dual IC/YP classification bonus
    const PRIMARY_EURO_IC = ["Italy North", "Spain North", "Switzerland West", "Greece"];
    if (SECONDARY_YP.includes(abbr) && PRIMARY_EURO_IC.includes(abbr)) score += 10;

    return { abbr, score };
  });

  // Sort by score descending, take top 5
  n5Scores.sort((a, b) => b.score - a.score);
  const newN5 = n5Scores.slice(0, 5).map(x => x.abbr);

  // Log the scoring for transparency
  log.push(`N5 Second Pass — top candidates:`);
  n5Scores.slice(0, 10).forEach(({ abbr, score }) => {
    log.push(`  ${abbr}: ${score}`);
  });

  // Replace N5
  next5.length = 0;
  newN5.forEach(a => next5.push(a));

  log.push(`N5 rebuilt: [${next5.join(", ")}]`);

  // ── European Resident Euro Floor ──────────────────────────────
  // When the traveler's home region is Europe, guarantee at least
  // one European SD trip on T8. If no European SD is currently on
  // T8, find the highest-ranking eligible European SD (per Gate 11
  // hierarchy) and swap it with the weakest non-Big4/non-PB trip
  // in the judgment zone.
  const homeRegionForFloor = resolveResidenceRegion(profile);
  if (homeRegionForFloor === "Europe") {
    const euroOnT8 = top8.filter(abbr => {
      const t = findTrip(abbr);
      return t && t.region === "Europe" && !["Big4","ContinentalPB"].includes(t.type);
    });

    if (euroOnT8.length === 0) {
      // Find the best eligible European SD not excluded, not on T8
      let bestEuro = null;
      for (const entry of g11.hierarchy) {
        const abbr = entry.trip;
        if (isExcluded(abbr)) continue;
        if (top8.includes(abbr)) continue;
        const t = findTrip(abbr);
        if (!t || t.region !== "Europe") continue;
        bestEuro = abbr;
        break;
      }

      if (bestEuro) {
        // Find the weakest non-Big4/non-PB trip in the judgment zone
        let weakestIdx = -1;
        let weakestScore = Infinity;
        for (let i = top8.length - 1; i >= 0; i--) {
          const t = findTrip(top8[i]);
          if (!t) continue;
          if (["Big4","ContinentalPB"].includes(t.type)) continue;
          // Score: untouched 100, T1 50, YP 30/15, flags
          let score = 0;
          const st = g4.tripStatuses[top8[i]] || "";
          if (st.startsWith("UNTOUCHED")) score += 100;
          if (t.tier === 1) score += 50;
          if (PRIMARY_YP.includes(top8[i])) score += 30;
          else if (SECONDARY_YP.includes(top8[i])) score += 15;
          score += (g13.flagCounts[top8[i]] || 0);
          if (score < weakestScore) {
            weakestScore = score;
            weakestIdx = i;
          }
        }

        if (weakestIdx !== -1) {
          const displaced = top8[weakestIdx];
          top8[weakestIdx] = bestEuro;
          // Remove bestEuro from next5 if present
          const n5Idx = next5.indexOf(bestEuro);
          if (n5Idx !== -1) {
            next5[n5Idx] = displaced;
          } else {
            next5.push(displaced);
          }
          log.push(`EURO FLOOR: ${bestEuro} guaranteed Euro SD slot on T8 (displaced ${displaced})`);
          log.push(`${displaced}: displaced to N5 by Euro floor guarantee`);
        }
      }
    }
  }

  // ── Cap-dropped N5 displacement ─────────────────────────────
  if (next5.length > 0) {
    const maxRated = new Set();
    const p = profile;
    if (p.wildlife_interest >= 10) maxRated.add("wildlife");
    if (p.hiking >= 5 && (p.landscapes.mountains || 0) >= 10) maxRated.add("hiking_mountains");
    if (p.performing_arts >= 10) maxRated.add("performing_arts");
    if (p.art >= 5) maxRated.add("art");
    if ((p.snorkeling >= 5 || p.scuba >= 5)) maxRated.add("scuba_snorkel");
    if (p.roadTrip === "love") maxRated.add("road_trip");
    if (p.extrovert >= 10) maxRated.add("extrovert");
    if ((p.camping >= 5 || p.backpacking >= 5)) maxRated.add("camping_backpacking");
    if ((p.landscapes.deserts || 0) >= 10) maxRated.add("deserts");
    if (p.foodie === true) maxRated.add("foodie");
    if ((p.landscapes.beaches || 0) >= 10) maxRated.add("beaches");
    if ((p.landscapes.rainforests || 0) >= 10) maxRated.add("rainforests");
    if ((p.landscapes.lakes || 0) >= 10) maxRated.add("lakes");
    if (p.history_rating >= 5) maxRated.add("history");
    if (p.trainPref === "train") maxRated.add("train_preference");
    if ((p.landscapes.vineyards || 0) >= 10) maxRated.add("vineyards_wine");
    if (p.sailing >= 5) maxRated.add("sailing_boating");
    if (p.fishing >= 5) maxRated.add("fishing");
    if (p.golf >= 5) maxRated.add("golf");

    const DISC_FLAGS = ["fear_snakes","fear_heights","left_side_driving","right_side_driving"];

    const capDropped = allSDs.filter(abbr => {
      if (isExcluded(abbr) || top8.includes(abbr) || next5.includes(abbr)) return false;
      const t = findTrip(abbr);
      if (!t) return false;
      if (g17Result && g17Result.cnr === abbr) return false;
      // Big 4 SD blocking applies to cap-dropped consideration as well
      let blockedByBig4 = false;
      for (const [big4, blockedSDs] of Object.entries(BIG4_SD_BLOCKS)) {
        if (blockedSDs.includes(abbr) && top8.includes(big4)) {
          blockedByBig4 = true;
          break;
        }
      }
      if (blockedByBig4) return false;
      const st = g4.tripStatuses[abbr] || "";
      if (!st.startsWith("UNTOUCHED")) return false;
      if (!SECONDARY_YP.includes(abbr)) return false;
      const alignFlags = (g13.flags[abbr] || []).filter(f => !DISC_FLAGS.includes(f) && f !== "friends_family");
      const maxCount = alignFlags.filter(f => maxRated.has(f)).length;
      if (maxCount < 2) return false;
      const region = t.region;
      const capUsed = regionCounts[region] || 0;
      const cap = g6.caps[region] || 2;
      if (capUsed < cap) return false;
      return true;
    });

    capDropped.sort((a, b) => (g13.flagCounts[b] || 0) - (g13.flagCounts[a] || 0));

    capDropped.forEach(cdAbbr => {
      if (next5.length === 0) return;
      const cdTrip = findTrip(cdAbbr);
      const cdFlags = g13.flagCounts[cdAbbr] || 0;

      let weakestIdx = -1;
      let weakestScore = Infinity;
      next5.forEach((n5Abbr, idx) => {
        const n5Trip = findTrip(n5Abbr);
        if (!n5Trip) return;
        const n5Flags = g13.flagCounts[n5Abbr] || 0;
        const n5Touched = g4.touchedRegions.includes(n5Trip.region);
        const n5Oddball = n5Trip.type === "SD_OB";
        const n5IsYP = SECONDARY_YP.includes(n5Abbr) || PRIMARY_YP.includes(n5Abbr);
        if ((n5Touched || n5Oddball) && n5Flags < cdFlags) {
          const score = n5Flags + (n5IsYP ? 0.5 : 0);
          if (score < weakestScore) {
            weakestScore = score;
            weakestIdx = idx;
          }
        }
      });

      if (weakestIdx !== -1) {
        const displaced = next5[weakestIdx];
        const displacedRegion = findTrip(displaced)?.region;
        next5.splice(weakestIdx, 1);
        if (displacedRegion) regionCounts[displacedRegion] = Math.max(0, (regionCounts[displacedRegion] || 0) - 1);
        next5.push(cdAbbr);
        const cdRegion = cdTrip.region;
        if (cdRegion) regionCounts[cdRegion] = (regionCounts[cdRegion] || 0) + 1;
        log.push(`${cdAbbr}: CAP-DROPPED DISPLACEMENT → N5 (displaced ${displaced}, ${cdFlags} flags vs ${g13.flagCounts[displaced] || 0})`);
      }
    });
  }

  // ── Next 5 re-sort ──
  if (next5.length > 1) {
    const ypScore = (abbr) => {
      if (PRIMARY_YP.includes(abbr)) return 2;
      if (SECONDARY_YP.includes(abbr)) return 1;
      return 0;
    };

    const CITY_TIER_SORT = { "Top4": 3, "Top10": 2, "Top25": 1 };
    const sortVisitedCities = new Set([
      ...(profile.visitedCECities || []), ...(profile.visitedCACities || []),
      ...(profile.visitedCAfCities || []), ...(profile.visitedCCCities || []),
    ]);
    const getHighestCityTierForSort = (abbr) => {
      let best = 0;
      for (const [city, trips] of Object.entries(ESSENTIAL_CITIES)) {
        if (trips.includes(abbr) && !sortVisitedCities.has(city)) {
          const rank = ["London","Paris","New York","Tokyo"].includes(city) ? "Top4" :
            ["San Francisco","Washington DC","Madrid","Rome","Amsterdam","Sydney"].includes(city) ? "Top10" : "Top25";
          best = Math.max(best, CITY_TIER_SORT[rank] || 0);
        }
      }
      return best;
    };

    const hasFF = (abbr) => (g13.flags[abbr] || []).includes("friends_family");

    const SORT_DISC_FLAGS = ["fear_snakes","fear_heights","left_side_driving","right_side_driving"];
    const alignFlagCount = (abbr) => {
      const fl = g13.flags[abbr] || [];
      return fl.filter(f => !SORT_DISC_FLAGS.includes(f)).length;
    };

    const strengthSort = (a, b) => {
      const aFlags = alignFlagCount(a);
      const bFlags = alignFlagCount(b);
      if (aFlags !== bFlags) return bFlags - aFlags;
      const aYP = ypScore(a);
      const bYP = ypScore(b);
      if (aYP !== bYP) return bYP - aYP;
      return getHighestCityTierForSort(b) - getHighestCityTierForSort(a);
    };

    const untouched = next5.filter(a => !g4.touchedRegions.includes(findTrip(a)?.region));
    const touched = next5.filter(a => g4.touchedRegions.includes(findTrip(a)?.region));

    untouched.sort(strengthSort);
    touched.sort(strengthSort);

    const merged = [];
    let ui = 0, ti = 0;

    while (ui < untouched.length || ti < touched.length) {
      if (ui < untouched.length && ti < touched.length) {
        const uAbbr = untouched[ui];
        const tAbbr = touched[ti];
        const uFlags = alignFlagCount(uAbbr);
        const tFlags = alignFlagCount(tAbbr);
        const uCity = getHighestCityTierForSort(uAbbr);
        const tCity = getHighestCityTierForSort(tAbbr);
        const tHasFF = hasFF(tAbbr);
        const uHasFF = hasFF(uAbbr);

        if (tFlags >= uFlags + 3 && tCity > uCity && tHasFF && !uHasFF) {
          merged.push(tAbbr); ti++;
        } else {
          merged.push(uAbbr); ui++;
        }
      } else if (ui < untouched.length) {
        merged.push(untouched[ui]); ui++;
      } else {
        merged.push(touched[ti]); ti++;
      }
    }

    next5.length = 0;
    merged.forEach(a => next5.push(a));
  }
  */
  // ── END OLD BLOCK ──────────────────────────────────────────────

  // ── UNIFIED SCORING ENGINE (v2.34) ─────────────────────────────
  // Replaces: PB placement, post-mechanism re-sort, M6 N5
  // Second Pass, N5 re-sort, cap-dropped N5 displacement, old
  // Euro Floor. All non-Big4 trips compete on one scored playing
  // field. Mechanisms handle membership (who competes).
  // Scoring handles ordering (where they rank).

  // Reset top8 to Big4s only, clear next5
  const big4sOnT8 = top8.filter(abbr => {
    const t = findTrip(abbr);
    return t && t.type === "Big4";
  });
  top8.length = 0;
  big4sOnT8.forEach(b => top8.push(b));
  next5.length = 0;
  log.push(`Unified engine: reset to ${top8.length} Big4s [${top8.join(", ")}], cleared N5`);

  // Rebuild regionCounts from Big4s only
  Object.keys(regionCounts).forEach(k => regionCounts[k] = 0);
  asiaCount = 0;
  top8.forEach(abbr => {
    const region = getRegion(abbr);
    if (region) regionCounts[region] = (regionCounts[region] || 0) + 1;
    if (findTrip(abbr)?.region === "Asia") asiaCount++;
  });
  log.push(`Unified engine: regionCounts rebuilt from Big4s: ${JSON.stringify(regionCounts)}`);

  // Step 1: Collect eligible non-Big4 candidates
  const scoringCandidates = TRIPS
    .filter(t => {
      const abbr = t.abbr;
      if (isExcluded(abbr)) return false;
      if (top8.includes(abbr)) return false; // Big4s already placed
      if (t.type === "Big4") return false;
      if (t.type === "ExoticIsland") return false; // handled separately
      if (g9.applies && g9.hardExcluded.includes(abbr)) return false;
      if (g17Result && g17Result.cnr === abbr) return false;
      // Big 4 SD blocking
      for (const [big4, blockedSDs] of Object.entries(BIG4_SD_BLOCKS)) {
        if (blockedSDs.includes(abbr) && top8.includes(big4)) return false;
      }
      if (abbr === "Tanzania" && tanzaniaExcluded) return false;
      // Tanzania/CAf sequencing (existing rule)
      if (abbr === "Tanzania" && top8.includes("CAf")) return false;
      return true;
    })
    .map(t => t.abbr);

  // Step 2: Score every candidate
  const scoredCandidates = scoringCandidates.map(abbr => {
    const score = unifiedScore(abbr, profile, g2, g4, g6, g13, top8, saForkSelected);
    return { abbr, score };
  });

  // Step 3: Sort by score descending
  scoredCandidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Tiebreaker: 1YP > 2YP > no YP
    const ypTier = (abbr) => {
      if (PRIMARY_YP.includes(abbr)) return 3;
      if (SECONDARY_YP.includes(abbr)) return 2;
      return 1;
    };
    if (ypTier(b.abbr) !== ypTier(a.abbr)) return ypTier(b.abbr) - ypTier(a.abbr);
    // Final tiebreaker: flag count
    return (g13.flagCounts[b.abbr] || 0) - (g13.flagCounts[a.abbr] || 0);
  });

  // Diagnostic logging — scored order
  scoredCandidates.forEach(({ abbr, score }) => {
    const _ls = computeLangScore(abbr, profile.languages || []);
    log.push(`  Unified: ${abbr} score=${score}${_ls > 0 ? ' (lang=' + _ls + ')' : ''}`);
  });

  // Step 4: Fill T8 positions respecting continent caps
  const t8Remaining = 8 - top8.length; // slots available after Big4s
  let filled = 0;
  const t8Additions = [];
  const regionCountsForScoring = { ...regionCounts }; // copy current counts from Big4 placement

  scoredCandidates.forEach(({ abbr, score }) => {
    if (filled >= t8Remaining) return;
    const trip = findTrip(abbr);
    if (!trip) return;
    const region = trip.region;
    const capUsed = regionCountsForScoring[region] || 0;
    const cap = g6.caps[region] || 2;
    // Asia allocation cap
    if (trip.region === "Asia") {
      const asiaOnT8 = [...top8, ...t8Additions.map(a => a.abbr)].filter(a => {
        const t = findTrip(a);
        return t && t.region === "Asia";
      }).length;
      if (asiaOnT8 >= g5.maxAsiaOnTop8) {
        log.push(`${abbr}: SKIP — Asia allocation cap`);
        return;
      }
    }
    if (capUsed >= cap) {
      log.push(`${abbr}: SKIP — continent cap (${region} ${capUsed}/${cap})`);
      return;
    }
    // SA Fork exclusive slot: when SA Fork selected a trip,
    // only that trip can take the second SA slot
    if (saForkSelected && trip.region === "South America" && abbr !== saForkSelected) {
      const saOnT8 = [...top8, ...t8Additions.map(a => a.abbr)].filter(a => {
        const t = findTrip(a);
        return t && t.region === "South America";
      }).length;
      if (saOnT8 >= 1) {
        log.push(`${abbr}: SKIP — SA Fork selected ${saForkSelected} for second SA slot`);
        return;
      }
    }
    t8Additions.push({ abbr, score });
    regionCountsForScoring[region] = (regionCountsForScoring[region] || 0) + 1;
    if (trip.region === "Asia") asiaCount++;
    filled++;
    log.push(`${abbr} → TOP 8 [unified score ${score}]`);
  });

  // Add scored trips to top8
  t8Additions.forEach(({ abbr }) => top8.push(abbr));

  // Update regionCounts
  Object.assign(regionCounts, regionCountsForScoring);

  // Step 5: Fill N5 from next 5 in scored list
  let n5Count = 0;
  scoredCandidates.forEach(({ abbr, score }) => {
    if (n5Count >= 5) return;
    if (top8.includes(abbr)) return; // already on T8
    if (g17Result && g17Result.cnr === abbr) return;
    const trip = findTrip(abbr);
    if (!trip) return;
    if (trip.type === "ExoticIsland") return; // exotic islands handled separately
    next5.push(abbr);
    n5Count++;
    log.push(`${abbr} → NEXT 5 [unified score ${score}]`);
  });

  // SA Fork selected trip pinned to last T8 position
  // Statement: "this is on your radar because of who you are,
  // but the trips above it are higher priority right now"
  if (saForkSelected && top8.includes(saForkSelected)) {
    const sfIdx = top8.indexOf(saForkSelected);
    if (sfIdx !== -1 && sfIdx < top8.length - 1) {
      top8.splice(sfIdx, 1);
      top8.push(saForkSelected);
      log.push(`${saForkSelected}: SA Fork pin — moved to last T8 position (#${top8.length})`);
    }
  }

  // SE Asia backyard pin for Oceanian virgins
  // SE Asia belongs on T8 for Oceanian virgins (their backyard)
  // but pinned to last position as a personal statement
  const homeRegionForPin = resolveResidenceRegion(profile);
  if (g2.isVirgin && homeRegionForPin === "Oceania" && top8.includes("SE Asia")) {
    const seaIdx = top8.indexOf("SE Asia");
    if (seaIdx !== -1 && seaIdx < top8.length - 1) {
      top8.splice(seaIdx, 1);
      top8.push("SE Asia");
      log.push("SE Asia: Oceanian virgin pin — moved to last T8 position (#" + top8.length + ")");
    }
  }

  // Step 6: Euro floor post-check
  const homeRegionForFloor = resolveResidenceRegion(profile);
  if (homeRegionForFloor === "Europe") {
    const euroSDOnT8 = top8.filter(abbr => {
      const t = findTrip(abbr);
      return t && t.region === "Europe" && !["Big4","ContinentalPB"].includes(t.type);
    });
    if (euroSDOnT8.length === 0) {
      // Find highest-scoring Euro SD not on T8
      let bestEuro = null;
      for (const { abbr, score } of scoredCandidates) {
        if (top8.includes(abbr)) continue;
        const t = findTrip(abbr);
        if (!t || t.region !== "Europe") continue;
        if (["Big4","ContinentalPB"].includes(t.type)) continue;
        bestEuro = abbr;
        break; // already sorted by score, first match is highest
      }
      if (bestEuro) {
        // Find weakest non-Big4 trip on T8
        let weakestIdx = -1;
        let weakestScore = Infinity;
        for (let i = 0; i < top8.length; i++) {
          const t = findTrip(top8[i]);
          if (!t) continue;
          if (t.type === "Big4") continue;
          const s = scoredCandidates.find(c => c.abbr === top8[i]);
          const tripScore = s ? s.score : 0;
          if (tripScore < weakestScore) {
            weakestScore = tripScore;
            weakestIdx = i;
          }
        }
        if (weakestIdx !== -1) {
          const displaced = top8[weakestIdx];
          top8[weakestIdx] = bestEuro;
          // Remove bestEuro from next5 if present
          const n5Idx = next5.indexOf(bestEuro);
          if (n5Idx !== -1) next5[n5Idx] = displaced;
          else {
            // displaced goes to N5, remove last N5 entry if full
            if (next5.length >= 5) next5.pop();
            next5.push(displaced);
          }
          log.push(`EURO FLOOR: ${bestEuro} replaces ${displaced} on T8`);
        }
      }
    }
  }

  log.push("─── UNIFIED SCORING ENGINE COMPLETE ───");

  log.push("─── TOP 8 IS A PRIORITY-ORDERED MENU, NOT A SEQUENCE ───");
  return { top8, next5, regionCounts, log };
}

// ── Gate 16: Percentage Reality Check ────────────────────────────

function gate16(profile, gate3Results, gate15Result) {
  const log = [];
  const regionStats = {};
  const totalCompleted = TRIPS.filter(t =>
    gate3Results.results[t.abbr] === "ELIMINATED").length;

  Object.keys(CANONICAL_COUNTS).forEach(region => {
    const total = CANONICAL_COUNTS[region];
    const completed = TRIPS.filter(t =>
      t.region === region && gate3Results.results[t.abbr] === "ELIMINATED").length;
    const onTop8 = TRIPS.filter(t =>
      t.region === region && gate15Result.top8.includes(t.abbr)).length;
    const combined = Math.round(((completed + onTop8) / total) * 100);
    regionStats[region] = { total, completed, onTop8, combined };
  });

  Object.entries(regionStats).forEach(([region, stats]) => {
    if (stats.completed === 0 && stats.total >= 3 && totalCompleted >= 3) {
      log.push(stats.onTop8 > 0
        ? `${region}: URGENT (NOTED — on T8)`
        : `${region}: URGENT — 0% not on T8`);
    }
  });

  if (regionStats.Europe && regionStats.Europe.combined < 20 &&
      regionStats.Europe.total >= 4) {
    log.push(`Europe: LOW — ${regionStats.Europe.combined}% combined`);
  }

  Object.entries(regionStats).forEach(([rA, sA]) => {
    if (sA.combined >= 50) {
      Object.entries(regionStats).forEach(([rB, sB]) => {
        if (rA !== rB && sB.total >= 3 && sB.combined <= 15) {
          log.push(`IMBALANCE: ${rA} ${sA.combined}% vs ${rB} ${sB.combined}%`);
        }
      });
    }
  });

  if (log.length === 0) log.push("No percentage flags");
  return { regionStats, log };
}

// ── Gate 17: FP vs Seychelles ────────────────────────────────────

function gate17(profile) {
  const log = [];
  const beachNorm = Math.min(5, Math.round((profile.landscapes.beaches || 0) / 2));

  const waterChecks = [
    { name: "beaches",     val: (profile.landscapes.beaches || 0) >= 8 },
    { name: "snorkel",     val: (profile.snorkeling || 0) >= 4 },
    { name: "scuba",       val: (profile.scuba || 0) >= 4 },
    { name: "surf",        val: (profile.surfing || 0) >= 4 },
    { name: "sail",        val: (profile.sailing || 0) >= 4 },
    { name: "windkite",    val: (profile.windKite || 0) >= 4 },
    { name: "paddle",      val: (profile.paddleboard || 0) >= 4 },
    { name: "kayak",       val: (profile.kayaking || 0) >= 4 },
    { name: "marine",      val: (profile.wildlife_interest || 0) >= 8 },
    { name: "fish",        val: (profile.fishing || 0) >= 4 },
  ];

  const passing = waterChecks.filter(c => c.val);
  const waterCount = passing.length;
  const deepStacked = waterCount >= 6;

  const homeRegion = resolveResidenceRegion(profile);
  let selected, cnr;
  if (homeRegion === "Europe" || homeRegion === "SSA") {
    selected = "Seychelles"; cnr = "FP";
  } else {
    selected = "FP"; cnr = "Seychelles";
  }

  log.push(`Beach norm: ${beachNorm}/5`);
  log.push(`Water@4+: ${waterCount} [${passing.map(c => c.name).join(", ")}]`);
  log.push(`Deep stacked: ${deepStacked}`);
  log.push(`Selected: ${selected}. CNR: ${cnr}.`);
  if (selected === "Seychelles") log.push("Combo: Seychelles + Tanzania/CAf");
  else log.push("Combo: FP + NZ");

  return { beachNorm, waterCount, deepStacked, selected, cnr, log };
}


// ═══════════════════════════════════════════════════════════════════
// MASTER RUN FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

function runF1(profile) {
  // Normalize null/undefined profile array fields to []
  // so downstream gates never crash on missing inputs.
  profile = profile || {};
  if (profile.visitedCountries == null)        profile.visitedCountries = [];
  if (profile.visitedCECities == null)         profile.visitedCECities = [];
  if (profile.visitedCACities == null)         profile.visitedCACities = [];
  if (profile.visitedCAfCities == null)        profile.visitedCAfCities = [];
  if (profile.visitedCCCities == null)         profile.visitedCCCities = [];
  if (profile.languages == null)               profile.languages = [];
  if (profile.friendsFamilyCountries == null)  profile.friendsFamilyCountries = [];
  if (profile.residenceCountries == null)      profile.residenceCountries = [];

  const g1   = gate1(profile);
  const g2   = gate2(profile);
  const g3   = gate3(profile);
  const g4   = gate4(profile);
  const g5   = gate5(profile, g3);
  const g13  = gate13(profile);
  const g6   = gate6(profile, g2, g4, g3, g1);
  const g7   = gate7(profile, g2, g3, g1);
  const g8   = gate8(profile, g2, g3, g7, g13);
  const g9   = gate9(profile, g2);
  const g10  = gate10(profile, g3);
  const g10b = gate10B(profile);
  const g11  = gate11(profile, g3, g10);
  const g12  = gate12(profile);

  const allGates = {
    gate1: g1, gate2: g2, gate3: g3, gate4: g4, gate5: g5,
    gate6: g6, gate7: g7, gate8: g8, gate9: g9, gate10: g10,
    gate11: g11, gate12: g12, gate13: g13
  };

  const g17  = gate17(profile);
  const g15  = gate15(profile, allGates, g17);
  const g14  = gate14(profile, g13, g15.top8);
  const g16  = gate16(profile, g3, g15);

  return {
    gates: {
      g1, g2, g3, g4, g5, g6, g7, g8, g9, g10, g10b,
      g11, g12, g13, g14, g15, g16, g17
    },
    top8: g15.top8,
    next5: g15.next5,
  };
}


// ═══════════════════════════════════════════════════════════════════
// SECTION 3: F2 ENGINE — 4 Gates
// ═══════════════════════════════════════════════════════════════════

// ── F2 Gate 1: Wants Gate ────────────────────────────────────────
//
// Signature: f2Gate1(wants, activityTable, profile)
//
// v2.26 added several post-passes after the base scoring loop.
// Order of operations inside f2Gate1:
//
//   1. Base scoring pass: every non-variant trip key in the table
//      is scored against `wants`. Each result gets:
//        - status:    PASS | NEAR_MISS | CNR
//        - score:     sum of WC=5/NWC=3/absent=0 (raw score)
//        - wscore:    sum of WC=6/NWC=4/absent=0 (weighted score)
//        - breakdown: per-want [{want,val,ws,label}]
//        - passed, needed, wantCount
//
//   2. Variant rescue/enhancement pass: any key containing " +"
//      whose base also exists is detected as a variant. If the
//      variant's own scores pass the gate, the BASE trip is
//      promoted/enhanced with metadata { viaAdaptation,
//      adaptationScore, adaptationPassed, adaptationWscore,
//      adaptationBreakdown, rescued|enhancement, priorStatus }.
//
//   3. Adaptation Add post-pass (v2.26 Patch 3): NEAR_MISS trips
//      are scanned for ADAPT entries in queried want columns where
//      the base rating is 0 and the entry's nearest distance is
//      ≤500mi. Distance is parsed from ADAPT text via regex
//      /~(\d[\d,]*)\s*mi/g. Qualifying ADAPTs are treated as
//      WC-equivalent (rating 5) for scoring. If the new score
//      reaches threshold, the trip is promoted to PASS with
//      metadata { adaptationAdd, adaptationAddWants,
//      adaptationAddScore, adaptationAddPassed, adaptationAddWscore,
//      adaptationAddBreakdown, priorStatus }.
//
//   4. Visited-country warning pass (v2.26 Patch 6): every PASS
//      trip is checked against profile.visitedCountries. ONE
//      warning is emitted per visited spine country with the
//      DEFAULT demotion language. Advisory only. Stored on
//      result as visitedSpineWarning (array of country names).
//
//   5. Unconditional advisory flags pass (v2.26 Patch 10): every
//      trip in the UNCONDITIONAL_FLAGS table at PASS status emits
//      a hardcoded warning regardless of query content. Currently
//      Australia logistical burden only. Stored as unconditionalFlag.
//
// All passes mutate the same `results` object. The returned
// `log` array is consumed by the runner for display.

function f2Gate1(wants, activityTable, profile) {
  const log = [];
  const results = {};

  const wantCount = wants.length;
  if (wantCount === 0) {
    log.push("No wants specified — F2 not applicable");
    return { results: {}, log };
  }
  if (!activityTable) {
    log.push("No activityTable provided — F2 returns empty ranking");
    return { results: {}, log };
  }

  const thresholdMap = { 1: 1, 2: 2, 3: 2, 4: 2 };
  const needed = thresholdMap[wantCount] || 1;

  // ── 1. Base scoring pass ──────────────────────────────────
  Object.entries(activityTable).forEach(([tripKey, _row]) => {
    if (tripKey.includes(" +")) return;

    let passed = 0;
    let totalScore = 0;
    let wscore = 0;
    const breakdown = [];

    wants.forEach(w => {
      const val = getActivityRating(activityTable, tripKey, w);
      totalScore += val;
      if (val >= 3) passed++;
      // wscore: WC(5)→6, NWC(3)→4, absent(0)→0
      let ws = 0, label = "0";
      if (val === 5) { ws = 6; label = "WC 6"; }
      else if (val === 3) { ws = 4; label = "NWC 4"; }
      wscore += ws;
      breakdown.push({ want: w, val, ws, label });
    });

    let status;
    if (passed >= needed) status = "PASS";
    else if (passed >= needed - 1 && passed > 0) status = "NEAR_MISS";
    else status = "CNR";

    results[tripKey] = {
      status, score: totalScore, wscore, breakdown,
      passed, needed, wantCount
    };
  });

  // ── 2. Variant rescue/enhancement pass ────────────────────
  detectActivityVariants(activityTable).forEach(({ variant, base }) => {
    let passed = 0;
    let totalScore = 0;
    let wscore = 0;
    const breakdown = [];

    wants.forEach(w => {
      const val = getActivityRating(activityTable, variant, w);
      totalScore += val;
      if (val >= 3) passed++;
      let ws = 0, label = "0";
      if (val === 5) { ws = 6; label = "WC 6"; }
      else if (val === 3) { ws = 4; label = "NWC 4"; }
      wscore += ws;
      breakdown.push({ want: w, val, ws, label });
    });

    const variantPasses = passed >= needed;
    if (!variantPasses) return;

    const baseResult = results[base];
    if (!baseResult) {
      log.push(`${variant}: variant passes but base ${base} not in results — skipped`);
      return;
    }

    if (baseResult.status === "PASS") {
      // ENHANCEMENT pathway
      if (passed > baseResult.passed || totalScore > baseResult.score) {
        baseResult.viaAdaptation = variant;
        baseResult.adaptationScore = totalScore;
        baseResult.adaptationPassed = passed;
        baseResult.adaptationWscore = wscore;
        baseResult.adaptationBreakdown = breakdown;
        baseResult.enhancement = true;
        log.push(`${base}: ENHANCEMENT via ${variant} (${baseResult.score} → ${totalScore})`);
      }
    } else {
      // RESCUE pathway
      const priorStatus = baseResult.status;
      baseResult.status = "PASS";
      baseResult.viaAdaptation = variant;
      baseResult.adaptationScore = totalScore;
      baseResult.adaptationPassed = passed;
      baseResult.adaptationWscore = wscore;
      baseResult.adaptationBreakdown = breakdown;
      baseResult.rescued = true;
      baseResult.priorStatus = priorStatus;
      log.push(`${base}: RESCUED from ${priorStatus} via ${variant} (variant passes ${passed}/${wantCount})`);
    }
  });

  // ── 3. Adaptation Add post-pass (v2.26 Patch 3) ───────────
  Object.entries(results).forEach(([tripKey, r]) => {
    if (r.status !== "NEAR_MISS" && r.status !== "CNR") return;

    const adaptWants = [];
    wants.forEach(w => {
      const baseRating = getActivityRating(activityTable, tripKey, w);
      if (baseRating > 0) return;  // only absent wants are eligible
      const entries = getActivityEntries(activityTable, tripKey, w);
      const adapts = entries.filter(e => e.type === "ADAPT");
      for (const entry of adapts) {
        const matches = [...entry.text.matchAll(/~(\d[\d,]*)\s*mi/g)];
        if (matches.length === 0) continue;
        const distances = matches.map(m => parseInt(m[1].replace(/,/g, ""), 10));
        const minDist = Math.min(...distances);
        if (minDist <= 500) {
          adaptWants.push({ want: w, entry, distance: minDist });
          break;  // one qualifying ADAPT per want is enough
        }
      }
    });

    if (adaptWants.length === 0) return;

    let newPassed = r.passed + adaptWants.length;
    let newScore = r.score + (adaptWants.length * 5);
    if (newPassed < needed) return;

    const priorStatus = r.status;
    r.status = "PASS";
    r.adaptationAdd = true;
    r.adaptationAddWants = adaptWants;
    r.adaptationAddScore = newScore;
    r.adaptationAddPassed = newPassed;
    r.priorStatus = priorStatus;

    let addWscore = 0;
    const addBreakdown = [];
    const adaptWantSet = new Set(adaptWants.map(a => a.want));
    r.breakdown.forEach(b => {
      if (adaptWantSet.has(b.want)) {
        addWscore += 6;
        addBreakdown.push({ want: b.want, val: 5, ws: 6, label: "WC 6", adapted: true });
      } else {
        addWscore += b.ws;
        addBreakdown.push({ ...b });
      }
    });
    r.adaptationAddWscore = addWscore;
    r.adaptationAddBreakdown = addBreakdown;

    const labels = adaptWants.map(aw => `${aw.want} (${aw.entry.text})`).join("; ");
    log.push(`${tripKey}: base ${r.passed}/${wantCount}. With Adaptation Add [${labels}]: ${newPassed}/${wantCount}. PASSES gate. Promoted to PASS via Adaptation Add.`);
  });

  // ── 4. Visited-country warning pass (v2.26 Patch 6) ───────
  if (profile && profile.visitedCountries && profile.visitedCountries.length > 0) {
    Object.keys(results).forEach(tripKey => {
      const r = results[tripKey];
      if (r.status !== "PASS") return;
      const tripObj = findTrip(tripKey);
      if (!tripObj) return;
      const visitedSpine = tripObj.spineCountries.filter(sc =>
        countryInList(sc, profile.visitedCountries));
      if (visitedSpine.length === 0) return;
      r.visitedSpineWarning = visitedSpine;
      visitedSpine.forEach(country => {
        log.push(`WARNING — ${tripKey}: spine country ${country.toUpperCase()} is in visitedCountries. DEFAULT: demote to Near Misses pending AIQC clarification that spine is uncaptured.`);
      });
    });
  }

  // ── 5. Per-trip unconditional advisory flags (v2.26 Patch 10) ──
  const UNCONDITIONAL_FLAGS = {
    "Australia": "LOGISTICAL BURDEN trip (Melbourne→Cairns→Sydney internal flight chain). See CP Logistical Burden section. AIQC must address in ranking notes.",
  };
  Object.keys(UNCONDITIONAL_FLAGS).forEach(tripKey => {
    const r = results[tripKey];
    if (!r || r.status !== "PASS") return;
    r.unconditionalFlag = UNCONDITIONAL_FLAGS[tripKey];
    log.push(`WARNING — ${tripKey}: ${UNCONDITIONAL_FLAGS[tripKey]}`);
  });

  log.push(`Wants: [${wants.join(", ")}], needed: ${needed}/${wantCount}`);
  return { results, log };
}

// ── F2 Gate 2: PB Priority ──────────────────────────────────────

function f2Gate2(f2g1Results, gate3Results) {
  const log = [];
  const pbPassing = [];
  const sdPassing = [];

  Object.entries(f2g1Results).forEach(([tripKey, result]) => {
    if (result.status !== "PASS") return;
    const trip = findTrip(tripKey);
    if (!trip) return;
    if (trip.type === "Big4" || trip.type === "ContinentalPB") pbPassing.push(tripKey);
    else sdPassing.push(tripKey);
  });

  log.push(`PB passing F2: ${pbPassing.join(", ") || "none"}`);
  log.push(`SD passing F2: ${sdPassing.join(", ") || "none"}`);
  return { pbPassing, sdPassing, log };
}

// ── F2 Gate 3: Ranking ──────────────────────────────────────────
//
// v2.25 fix #2 + #3:
//   - Accepts gate1Result, gate17Result, and f1Top8 as additional
//     parameters. All are null-guarded so omitted gates do not
//     crash the ranker.
//   - Filters out trips listed in gate1Result.excluded (home-region
//     and spine-country exclusions from F1 Gate 1).
//   - Filters out the Gate 17 CNR exotic island (FP vs Seychelles
//     selection) so the F2 ranking aligns with F1 placement rules.
//   - Tanzania-specific block: when Classic Africa (CAf) is on the
//     F1 Top 8, Tanzania is excluded from the F2 ranking with
//     explanatory log message. This mirrors the F1 Gate 15
//     sequencing rule — Tanzania returns when CAf is completed.

function f2Gate3(f2g2Result, gate4Results, gate13Result, gate1Result, gate17Result, f1Top8, profile, f2g1, gate3Results) {
  const allPassing = [...f2g2Result.pbPassing, ...f2g2Result.sdPassing];
  const log = [];

  // Null-guard the optional gate inputs.
  const excludedSet = new Set((gate1Result && gate1Result.excluded) || []);
  const cnrTrip = (gate17Result && gate17Result.cnr) || null;
  const top8 = Array.isArray(f1Top8) ? f1Top8 : [];

  const cafOnTop8 = top8.includes("CAf");

  const filtered = allPassing.filter(tripKey => {
    if (excludedSet.has(tripKey)) {
      log.push(`${tripKey}: excluded by F1 Gate 1 (home-region/spine)`);
      return false;
    }
    if (cnrTrip && tripKey === cnrTrip) {
      log.push(`${tripKey}: excluded by F1 Gate 17 CNR (${gate17Result.selected} selected)`);
      return false;
    }
    if (tripKey === "Tanzania" && cafOnTop8) {
      log.push("Tanzania: blocked by Classic Africa — returns when Classic Africa is completed.");
      return false;
    }
    return true;
  });

  let ranked = filtered.sort((a, b) => {
    const ta = findTrip(a);
    const tb = findTrip(b);
    if (!ta || !tb) return 0;

    const pbA = ["Big4","ContinentalPB"].includes(ta.type) ? 0 : 1;
    const pbB = ["Big4","ContinentalPB"].includes(tb.type) ? 0 : 1;
    if (pbA !== pbB) return pbA - pbB;

    const csRank = (s) => {
      if (s.startsWith("UNTOUCHED_ODDBALL")) return 1;
      if (s.startsWith("UNTOUCHED")) return 0;
      if (s.startsWith("TOUCHED_ODDBALL")) return 2;
      return 3;
    };
    const csA = csRank(gate4Results.tripStatuses[ta.abbr] || "");
    const csB = csRank(gate4Results.tripStatuses[tb.abbr] || "");
    if (csA !== csB) return csA - csB;

    if (ta.tier !== tb.tier) return ta.tier - tb.tier;
    return (gate13Result.flagCounts[tb.abbr] || 0) - (gate13Result.flagCounts[ta.abbr] || 0);
  });

  // ─────────────────────────────────────────────────────────────
  // F2 POST-SORT REORDERING PASS (v2.30 — see CHANGELOG step 7)
  // Gate 3's preliminary sort uses the priority hierarchy mechanically.
  // This pass applies blocking power, wscore, lockout results, visited-spine
  // handling, logistical burden, and FP subordination to produce the final ranking.
  // ─────────────────────────────────────────────────────────────

  // Step 0: Declarations used across Steps 1-9
  const f2g1Results = f2g1 ? (f2g1.results || {}) : {};
  const visitedSpineClassification = {};

  // Step 1: Handle G3-ELIMINATED trips
  //   Multi-country spine with all visited → hard-block (remove).
  //   Single-country spine with visited → HEDGE as core-affected (let AIQC ask
  //   clarifying depth question rather than killing the option outright).
  const eliminatedTrips = [];
  ranked = ranked.filter(tripKey => {
    if (gate3Results && gate3Results.results && gate3Results.results[tripKey] === "ELIMINATED") {
      const trip = findTrip(tripKey);
      if (trip && trip.spineCountries.length > 1) {
        eliminatedTrips.push(tripKey);
        log.push(`${tripKey}: REMOVED from F2 ranking — G3 ELIMINATED (all ${trip.spineCountries.length} spine countries visited)`);
        return false;
      } else {
        // Single-country trip visited — presume qualification, compete as clean.
        // Clarifying question will be asked but position is not penalized.
        log.push(`${tripKey}: G3 ELIMINATED but single-country spine — PRESUME QUALIFIED, compete as clean with clarifying question`);
        return true;
      }
    }
    return true;
  });

  // Step 2: Classify remaining visited-spine trips
  // "core-affected" = visited country contains the majority of canonical destinations
  // "adaptation-corner" = visited country is a minor spine segment, core is unvisited
  ranked.forEach(tripKey => {
    // Skip trips already classified by Step 1 (single-country G3-eliminated).
    if (visitedSpineClassification[tripKey]) return;

    const result = f2g1Results[tripKey];
    if (!result || !result.visitedSpineWarning) return;

    const trip = findTrip(tripKey);
    if (!trip) return;

    const visitedSpine = result.visitedSpineWarning;
    const totalSpine = trip.spineCountries.length;
    const visitedCount = visitedSpine.length;
    const unvisitedCount = totalSpine - visitedCount;

    if (visitedCount === totalSpine) {
      // All spine visited. If single-country, Step 1 already flagged as PRESUME
      // QUALIFIED — leave unclassified so the trip competes clean on wscore.
      // If multi-country, Step 1 already removed it via G3 ELIMINATED, so this
      // branch is effectively defensive / unreachable in normal flow.
      return;
    } else if (unvisitedCount >= visitedCount) {
      // Majority of spine countries unvisited — adaptation corner
      visitedSpineClassification[tripKey] = "adaptation-corner";
      log.push(`${tripKey}: visited-spine classified as ADAPTATION-CORNER (${visitedCount} of ${totalSpine} spine countries visited, core in unvisited countries)`);
    } else {
      visitedSpineClassification[tripKey] = "core-affected";
      log.push(`${tripKey}: visited-spine classified as CORE-AFFECTED (${visitedCount} of ${totalSpine} spine countries visited)`);
    }
  });

  // Step 3: Build blocking power map from the Balancing Test data
  // Level 1 (Big 4), Level 2 (Trifecta), Level 3 (Primary YP lockout)
  const blockingPower = {};
  ranked.forEach(tripKey => {
    const trip = findTrip(tripKey);
    if (!trip) return;
    if (trip.type === "Big4") {
      blockingPower[tripKey] = 1;
    } else if (
      trip.tier === 1 &&
      !["Big4", "ContinentalPB"].includes(trip.type) &&
      gate4Results && !gate4Results.touchedRegions.includes(trip.region) &&
      PRIMARY_YP.includes(tripKey) &&
      profile && profile.age < 30
    ) {
      blockingPower[tripKey] = 2;
    } else if (PRIMARY_YP.includes(tripKey) && profile && profile.age < 30) {
      blockingPower[tripKey] = 3;
    } else {
      blockingPower[tripKey] = 99;
    }
  });

  // Step 4: Get wscore for each trip
  const getWscore = (tripKey) => {
    const result = f2g1Results[tripKey];
    if (!result) return 0;
    if (result.adaptationAdd) return result.adaptationAddWscore || 0;
    if (result.viaAdaptation) return result.adaptationWscore || 0;
    return result.wscore || 0;
  };

  // Step 5: Compute ceiling/floor/midpoint for core-affected visited-spine trips
  const hedgedPositions = {};
  const coreAffectedTrips = ranked.filter(t => visitedSpineClassification[t] === "core-affected");
  const cleanTrips = ranked.filter(t => !visitedSpineClassification[t] || visitedSpineClassification[t] === "adaptation-corner");

  // Sort cleanTrips by wscore descending so cleanTrips.indexOf(b) in Step 6
  // reflects wscore-natural position rather than preliminary Gate-3 sort order.
  cleanTrips.sort((a, b) => getWscore(b) - getWscore(a));

  coreAffectedTrips.forEach(tripKey => {
    // Ceiling: where would this trip rank if treated as clean (wscore-natural position)?
    const allTrips = [...ranked];
    allTrips.sort((a, b) => {
      const bpA = blockingPower[a] || 99;
      const bpB = blockingPower[b] || 99;
      if (bpA !== bpB) return bpA - bpB;
      return getWscore(b) - getWscore(a);
    });
    const ceiling = allTrips.indexOf(tripKey);

    // Floor: where would this trip rank if pushed below all clean trips at comparable wscore?
    const ws = getWscore(tripKey);
    const cleanAbove = cleanTrips.filter(t => getWscore(t) >= ws || (blockingPower[t] || 99) < (blockingPower[tripKey] || 99));
    let floor = Math.min(ranked.length - 1, cleanAbove.length + coreAffectedTrips.indexOf(tripKey));

    // Fix C: minimum spread — floor must be at least ceiling + 2 (or ceiling + ⌊n/3⌋,
    // whichever is larger), so the midpoint actually hedges rather than collapsing
    // to the ceiling when the natural-position floor equals the ceiling.
    const minSpread = Math.max(2, Math.floor(ranked.length / 3));
    const minFloor = Math.min(ranked.length - 1, ceiling + minSpread);
    if (floor < minFloor) {
      floor = minFloor;
    }

    // Midpoint — biased toward ceiling (one-third of the way from ceiling to floor).
    const midpoint = Math.round(ceiling + (floor - ceiling) / 3);

    hedgedPositions[tripKey] = { ceiling, floor, midpoint };
    log.push(`${tripKey}: visited-spine hedging — ceiling #${ceiling + 1}, floor #${floor + 1}, hedged #${midpoint + 1}`);
  });

  // Helper: does a challenger overcome a Primary-YP lockout via the four conditions?
  // (a) All wants delivered at WC (val === 5)
  // (b) More wants satisfied than the Primary-YP trip
  // (c) Spine country is unvisited OR continent is untouched
  // (d) Wscore gap >= 6 in challenger's favor
  function checkLockoutOverride(challenger, primaryYPTrip) {
    const challengerResult = f2g1Results[challenger];
    const pypResult = f2g1Results[primaryYPTrip];
    if (!challengerResult || !pypResult) return false;

    // (a) All wants at WC
    const bd = challengerResult.breakdown || [];
    if (bd.length === 0) return false;
    const allWC = bd.every(b => b.val === 5);
    if (!allWC) return false;

    // (b) Strictly more wants passed than the Primary YP trip
    const challengerPassed = challengerResult.passed || 0;
    const pypPassed = pypResult.passed || 0;
    if (challengerPassed <= pypPassed) return false;

    // (c) Spine country NOT in visitedCountries OR continent untouched
    const challengerTrip = findTrip(challenger);
    if (!challengerTrip) return false;
    const visited = (profile && profile.visitedCountries ? profile.visitedCountries : [])
      .map(c => normalizeCountry(c));
    const spineVisited = challengerTrip.spineCountries.some(sc =>
      visited.includes(normalizeCountry(sc))
    );
    const continentUntouched = gate4Results && !gate4Results.touchedRegions.includes(challengerTrip.region);
    if (spineVisited && !continentUntouched) return false;

    // (d) Wscore gap >= 6
    const challengerWs = getWscore(challenger);
    const pypWs = getWscore(primaryYPTrip);
    if (challengerWs - pypWs < 6) return false;

    return true;
  }

  // Tiebreaker helpers (Change 3): structural hooks, breadth, depth.
  function getStructuralScore(tripKey) {
    let s = 0;
    const trip = findTrip(tripKey);
    if (!trip) return 0;

    // Essential cities
    for (const [city, trips] of Object.entries(ESSENTIAL_CITIES)) {
      if (trips.includes(tripKey)) {
        if (["London","Paris","New York","Tokyo"].includes(city)) s += 20;
        else if (["San Francisco","Washington DC","Madrid","Rome","Amsterdam","Sydney"].includes(city)) s += 12;
        else s += 5;
      }
    }

    // YP
    if (PRIMARY_YP.includes(tripKey)) s += 15;
    else if (SECONDARY_YP.includes(tripKey)) s += 10;

    // Dual IC/YP
    const PRIMARY_EURO_IC = ["Italy North", "Spain North", "Switzerland West", "Greece"];
    if (SECONDARY_YP.includes(tripKey) && PRIMARY_EURO_IC.includes(tripKey)) s += 8;

    // Language proficiency match
    if (profile) {
      const profLangs = (profile.languages || [])
        .filter(l => (l.level === "proficient" || l.level === "native") && l.lang.toLowerCase() !== "english")
        .map(l => l.lang.toLowerCase());
      if (profLangs.length > 0) {
        const tripLangMatrix = LANGUAGE_MATRIX[tripKey] || [];
        if (tripLangMatrix.some(m => m.w >= 3 && profLangs.includes(m.lang.toLowerCase()))) {
          s += 10;
        }
      }
    }

    // F/F
    if (profile && profile.friendsFamilyCountries && profile.friendsFamilyCountries.length > 0) {
      if (trip.spineCountries.some(sc =>
        profile.friendsFamilyCountries.some(fc => normalizeCountry(fc) === normalizeCountry(sc)))) {
        s += 10;
      }
    }

    // Tier
    if (trip.tier === 1) s += 5;

    return s;
  }

  function getPassedCount(tripKey) {
    const result = f2g1Results[tripKey];
    return result ? (result.passed || 0) : 0;
  }

  function getWCCount(tripKey) {
    const result = f2g1Results[tripKey];
    if (!result || !result.breakdown) return 0;
    return result.breakdown.filter(b => b.val === 5).length;
  }

  // Tiebreaker chain used when two trips tie on wscore within the same blocking-power tier.
  function tiebreak(a, b) {
    const structA = getStructuralScore(a);
    const structB = getStructuralScore(b);
    if (structA !== structB) return structB - structA;

    const passedA = getPassedCount(a);
    const passedB = getPassedCount(b);
    if (passedA !== passedB) return passedB - passedA;

    const wcA = getWCCount(a);
    const wcB = getWCCount(b);
    return wcB - wcA;
  }

  // Step 6: Final sort incorporating blocking power, lockout override, wscore, and hedging
  ranked.sort((a, b) => {
    const bpA = blockingPower[a] || 99;
    const bpB = blockingPower[b] || 99;

    // Level 1 and Level 2 always win — no override possible
    if (bpA <= 2 || bpB <= 2) {
      if (bpA !== bpB) return bpA - bpB;
      const wsDiff = getWscore(b) - getWscore(a);
      if (wsDiff !== 0) return wsDiff;
      return tiebreak(a, b);
    }

    // Level 3 (Primary YP) vs non-blocked: check lockout override
    if (bpA === 3 && bpB === 99) {
      // B is trying to overcome A's Primary YP lockout
      if (checkLockoutOverride(b, a)) return 1;  // B ranks above A
      return -1;                                  // A (Primary YP) holds
    }
    if (bpB === 3 && bpA === 99) {
      if (checkLockoutOverride(a, b)) return -1;  // A ranks above B
      return 1;                                   // B (Primary YP) holds
    }

    // Both same blocking power — check hedged vs clean
    const aHedged = hedgedPositions[a];
    const bHedged = hedgedPositions[b];
    const aIsHedged = !!aHedged;
    const bIsHedged = !!bHedged;

    if (!aIsHedged && !bIsHedged) {
      const wsDiff = getWscore(b) - getWscore(a);
      if (wsDiff !== 0) return wsDiff;
      return tiebreak(a, b);
    }
    if (aIsHedged && !bIsHedged) {
      const bNatural = cleanTrips.indexOf(b);
      return aHedged.midpoint - (bNatural >= 0 ? bNatural : ranked.length);
    }
    if (!aIsHedged && bIsHedged) {
      const aNatural = cleanTrips.indexOf(a);
      return (aNatural >= 0 ? aNatural : ranked.length) - bHedged.midpoint;
    }
    return aHedged.midpoint - bHedged.midpoint;
  });

  // Log which lockout overrides fired (post-sort, for transparency)
  ranked.forEach((tripKey, idx) => {
    if ((blockingPower[tripKey] || 99) !== 99) return;
    ranked.forEach(other => {
      if (other === tripKey) return;
      if ((blockingPower[other] || 99) !== 3) return;
      // Only log if challenger is above the Primary YP trip in final order
      if (ranked.indexOf(tripKey) < ranked.indexOf(other) && checkLockoutOverride(tripKey, other)) {
        log.push(`${tripKey}: OVERCAME Primary YP lockout vs ${other} (all WC, more wants, spine/continent ok, wscore gap ≥6)`);
      }
    });
  });

  // Step 6b: Rescued trips (0/3 base score) sink below self-qualifying trips
  ranked.forEach((tripKey, idx) => {
    const result = f2g1Results[tripKey];
    if (result && result.rescued && result.passed === 0) {
      // Find the last position of a non-rescued trip
      let lastNonRescued = idx;
      for (let i = ranked.length - 1; i > idx; i--) {
        const r = f2g1Results[ranked[i]];
        if (!r || !r.rescued || (r.passed && r.passed > 0)) {
          lastNonRescued = i;
          break;
        }
      }
      if (lastNonRescued > idx) {
        const rescued = ranked.splice(idx, 1)[0];
        ranked.splice(lastNonRescued, 0, rescued);
        log.push(`${tripKey}: SUNK to #${lastNonRescued + 1} — rescued trip (0/3 base) ranks below self-qualifying trips`);
      }
    }
  });

  // Step 7: Apply Australia logistical burden — push below all compact-routing trips at comparable wscore.
  // Fix B: skip rescued trips when computing the demotion target — a rescued trip's
  // wscore is earned by adaptation, not on-spine delivery, so it shouldn't block Australia.
  const ausIdx = ranked.indexOf("Australia");
  if (ausIdx !== -1) {
    const ausWscore = getWscore("Australia");
    // Find the last position of a non-rescued compact-routing trip with wscore >= Australia's
    let lastCompactAbove = ausIdx;
    for (let i = ranked.length - 1; i > ausIdx; i--) {
      const candidate = ranked[i];
      if (candidate === "Australia") continue;
      const cr = f2g1Results[candidate];
      if (cr && cr.rescued) continue;  // rescued trips don't block Australia's demotion
      if (getWscore(candidate) >= ausWscore) {
        lastCompactAbove = i;
        break;
      }
    }
    if (lastCompactAbove > ausIdx) {
      ranked.splice(ausIdx, 1);
      // After splicing out, indices above ausIdx shift down by 1, so
      // the target insertion index is lastCompactAbove (not +1).
      ranked.splice(lastCompactAbove, 0, "Australia");
      log.push(`Australia: DEMOTED to #${lastCompactAbove + 1} — logistical burden below compact-routing trips`);
    }
  }

  // Step 8: Cap at 8 for main list display (runs BEFORE FP subordination — Fix A)
  // Trips beyond position 8 are near misses.
  if (ranked.length > 8) {
    const nearMisses = ranked.splice(8);
    log.push(`Near Misses (beyond main list capacity): ${nearMisses.join(", ")}`);
  }

  // Step 9: Exotic Island subordination — move selected island to last position WITHIN the capped list.
  // Gate 17 selects either FP or Seychelles; the selected island subordinates to last.
  const selectedIsland = (gate17Result && gate17Result.selected) || "FP";
  const eiIdx = ranked.indexOf(selectedIsland);
  if (eiIdx !== -1 && eiIdx < ranked.length - 1) {
    ranked.splice(eiIdx, 1);
    ranked.push(selectedIsland);
    log.push(`${selectedIsland}: SUBORDINATED to last position within cap (#${ranked.length})`);
  }

  log.push(`F2 ranked: ${ranked.join(", ") || "none"}`);
  return { ranked, log };
}

// ── F2 Gate 4: Adaptation Check ─────────────────────────────────
//
// v2.25: rescue/enhancement metadata now lives directly on the
// base trip's f2Gate1 result (viaAdaptation field). Gate 4 reads
// it from there rather than searching for "<base> +" keys.

function f2Gate4(f2g3Result, f2g1Results) {
  const log = [];
  const final = [];

  f2g3Result.ranked.forEach(tripKey => {
    const r = f2g1Results[tripKey] || {};
    const entry = {
      trip: tripKey,
      adapted: !!r.viaAdaptation,
      adaptationAvailable: r.viaAdaptation || null,
      rescued: !!r.rescued,
      enhancement: !!r.enhancement,
    };

    if (r.viaAdaptation) {
      const kind = r.rescued ? "RESCUE" : "ENHANCEMENT";
      log.push(`${tripKey}: ${kind} via ${r.viaAdaptation}`);
    }
    final.push(entry);
  });

  return { final, log };
}

function runF2(profile, wants, f1Results, activityTable) {
  const fg1 = f2Gate1(wants, activityTable, profile);
  const fg2 = f2Gate2(fg1.results, f1Results.gates.g3);
  // Pass g1, g17, and top8 into gate 3.
  const fg3 = f2Gate3(
    fg2,
    f1Results.gates.g4,
    f1Results.gates.g13,
    f1Results.gates.g1,
    f1Results.gates.g17,
    f1Results.top8,
    profile,
    fg1,
    f1Results.gates.g3
  );
  const fg4 = f2Gate4(fg3, fg1.results);

  return {
    gates: { fg1, fg2, fg3, fg4 },
    ranked: fg3.ranked,
    adaptations: fg4.final,
    activityTable: activityTable || null,
  };
}


// ═══════════════════════════════════════════════════════════════════
// PROFILE HEADER (v2.26 Patch 4)
// ═══════════════════════════════════════════════════════════════════
//
// Prints gate-critical profile fields in a structured block before
// Gate 1. Surfaces the profile data AIQC most often misreads or
// has to dig for: residence (city + state + country + region),
// home-region exclusions, age + YP band, Exotic Island selection,
// continent status (TOUCHED/UNTOUCHED/HOME).
//
// If profile.residenceCity is provided, the residence line includes
// it as the first field.

function printProfileHeader(profile, f1Result) {
  console.log();
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  PROFILE — Gate-Critical Fields");
  console.log("═══════════════════════════════════════════════════════════════");

  // Residence line.
  const res = [];
  if (profile.residenceCity) res.push(profile.residenceCity);
  if (profile.livedInCalifornia && !profile.residenceCity) res.push("lived in California");
  else if (profile.livedInCalifornia) res.push("California");
  res.push(profile.homeCountry || "(unknown)");
  if (profile.residenceRegion) res.push(profile.residenceRegion);
  if (profile.livedInEurope) res.push("lived in Europe");
  if (profile.livedInSSA) res.push("lived in SSA");
  if (profile.livedInJapanOrKorea) res.push("lived in Japan/Korea");
  console.log(`  Residence: ${res.join(", ")}`);

  // Home region exclusions from Gate 1.
  const g1 = f1Result.gates.g1;
  const exclusions = g1.excluded;
  if (exclusions.length > 0) {
    console.log(`  Home region exclusions: ${exclusions.join(", ")}`);
    g1.log.forEach(line => {
      if (line.includes("EXCLUDED")) {
        const parts = line.split("EXCLUDED");
        const trip = parts[0].replace(":", "").trim();
        const reason = parts[1].replace("—", "").trim();
        if (exclusions.includes(trip)) {
          console.log(`    - ${trip}: EXCLUDED — ${reason}`);
        }
      }
    });
  }

  // Age and YP band.
  const g10 = f1Result.gates.g10;
  console.log(`  Age: ${g10.age}`);
  console.log(`  YP band: ${g10.band} (YP active: ${g10.ypActive})`);

  // Exotic Island selection from Gate 17.
  const g17 = f1Result.gates.g17;
  console.log(`  Exotic Island selection: ${g17.selected} selected, ${g17.cnr} CNR`);

  // Continent status from Gate 4.
  const g4 = f1Result.gates.g4;
  const homeRegion = f1Result.gates.g2.homeRegion;
  console.log(`  Continent status:`);
  ["Europe", "Asia", "SSA", "South America", "Oceania", "North America", "MENA"].forEach(region => {
    let status;
    if (region === homeRegion) status = "HOME";
    else if (g4.touchedRegions.includes(region)) status = "TOUCHED";
    else status = "UNTOUCHED";
    console.log(`    ${region}: ${status}`);
  });

  console.log();
}

// ═══════════════════════════════════════════════════════════════════
// F2 CLOSE_CALL CHARTS — all-pairs anomaly detection (v2.26 Patch 1)
// ═══════════════════════════════════════════════════════════════════

function printF2CloseCallCharts(profile, f1Result, f2Result) {
  const g4  = f1Result.gates.g4;
  const g10 = f1Result.gates.g10;
  const g1r = f2Result.gates.fg1.results;

  const visitedCities = new Set([
    ...(profile.visitedCECities || []),
    ...(profile.visitedCACities || []),
    ...(profile.visitedCAfCities || []),
    ...(profile.visitedCCCities || []),
  ]);

  function getYP(abbr) {
    if (!g10.ypActive) return "YP none (age 30+)";
    if (PRIMARY_YP.includes(abbr)) return "YP Primary";
    if (SECONDARY_YP.includes(abbr)) return "YP Secondary";
    return "YP none";
  }

  function getRegionStatus(trip) {
    if (trip.type === "SD_OB" || trip.type === "ExoticIsland") {
      const st = (g4.tripStatuses[trip.abbr] || "").split("|")[0];
      return st.includes("TOUCHED") ? "touched" : "untouched";
    }
    return g4.touchedRegions.includes(trip.region) ? "touched" : "untouched";
  }

  function getEssentialCitiesStr(abbr) {
    const cities = [];
    for (const [city, trips] of Object.entries(ESSENTIAL_CITIES)) {
      if (trips.includes(abbr) && !visitedCities.has(city)) {
        const rank = ["London","Paris","New York","Tokyo"].includes(city) ? "Top4" :
          ["San Francisco","Washington DC","Madrid","Rome","Amsterdam","Sydney"].includes(city) ? "Top10" : "Top25";
        cities.push(`${city}(${rank})`);
      }
    }
    return cities.length > 0 ? cities.join(", ") : "no essential cities";
  }

  function getTierStr(trip) {
    return trip.type === "Big4" ? "B4" : `T${trip.tier}`;
  }

  function getRegionStatusStr(trip) {
    return `${getRegionStatus(trip)} ${trip.region}`;
  }

  const ranked = f2Result.ranked;
  if (ranked.length < 2) return;

  const charts = [];

  // v2.26 Patch 1: all-pairs scan instead of adjacent-only.
  for (let i = 0; i < ranked.length - 1; i++) {
    for (let j = i + 1; j < ranked.length; j++) {
      const aKey = ranked[i];
      const bKey = ranked[j];
      const aResult = g1r[aKey];
      const bResult = g1r[bKey];
      if (!aResult || !bResult) continue;

      const aTrip = findTrip(aKey);
      const bTrip = findTrip(bKey);
      if (!aTrip || !bTrip) continue;

      const aPassed = aResult.passed;
      const bPassed = bResult.passed;
      const aTouched = getRegionStatus(aTrip) === "touched";
      const bTouched = getRegionStatus(bTrip) === "touched";

      const triggerA = bPassed > aPassed;
      const triggerB = !bTouched && aTouched && bPassed >= aPassed;

      if (!triggerA && !triggerB) continue;

      charts.push({ aKey, bKey, aTrip, bTrip, aResult, bResult, i, j });
    }
  }

  if (charts.length === 0) return;

  console.log();
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  F2 CLOSE_CALL CHARTS");
  console.log("═══════════════════════════════════════════════════════════════");

  charts.forEach(({ aKey, bKey, aTrip, bTrip, aResult, bResult, i, j }) => {
    const wc = aResult.wantCount;
    console.log();
    console.log(`  ⚡ F2 CLOSE_CALL: ${aKey} (#${i+1}, ${aResult.passed}/${wc}) vs ${bKey} (#${j+1}, ${bResult.passed}/${wc})`);
    console.log(`    ${aKey}: ${getTierStr(aTrip)}, ${getRegionStatusStr(aTrip)}, ${getYP(aKey)}, ${getEssentialCitiesStr(aKey)}`);
    console.log(`    ${bKey}: ${getTierStr(bTrip)}, ${getRegionStatusStr(bTrip)}, ${getYP(bKey)}, ${getEssentialCitiesStr(bKey)}`);
    if (bResult.passed > aResult.passed) {
      console.log(`    → ${bKey} delivers more queried wants. AIQC evaluate.`);
    } else {
      console.log(`    → ${bKey} is untouched (vs touched ${aKey}) at equal score. AIQC evaluate.`);
    }
  });
}

// ═══════════════════════════════════════════════════════════════════
// BALANCING TEST (v2.26 Patches 7 + 8 + 12)
// ═══════════════════════════════════════════════════════════════════

function printBalancingTest(profile, f1Result, f2Result) {
  const g1r = f2Result.gates.fg1.results;
  const ranked = f2Result.gates.fg3.ranked;
  const touchedRegions = (f1Result.gates.g4 && f1Result.gates.g4.touchedRegions) || [];

  // Build effective wscore + breakdown for every PASS trip.
  const passTrips = Object.entries(g1r)
    .filter(([_, r]) => r.status === "PASS")
    .map(([trip, r]) => {
      let effectiveWscore = r.wscore;
      let effectiveBreakdown = r.breakdown;
      let marker = "";
      if (r.adaptationAdd) {
        effectiveWscore = r.adaptationAddWscore;
        effectiveBreakdown = r.adaptationAddBreakdown;
        marker = " [adapted]";
      } else if (r.viaAdaptation) {
        effectiveWscore = r.adaptationWscore;
        effectiveBreakdown = r.adaptationBreakdown;
        marker = r.rescued ? " [rescued]" : " [enhanced]";
      }
      return { trip, r, wscore: effectiveWscore, breakdown: effectiveBreakdown, marker };
    })
    .sort((a, b) => b.wscore - a.wscore);

  console.log();
  console.log("  ─── Weighted Score (WC=6, NWC=4, absent=0) ───");

  passTrips.forEach(({ trip, wscore, breakdown, marker }) => {
    const parts = breakdown.map(b => {
      if (b.val === 5) return `${b.want} WC 6`;
      if (b.val === 3 && b.label === "NWC 4") return `${b.want} NWC 4`;
      if (b.adapted) return `${b.want} WC 6`;
      return `${b.want} 0`;
    });
    console.log(`    ${trip}: wscore=${wscore} (${parts.join(" + ")})${marker}`);
  });

  // Balancing Test anomaly scan with exception filter.
  const wscoreByTrip = {};
  const breakdownByTrip = {};
  passTrips.forEach(({ trip, wscore, breakdown }) => {
    wscoreByTrip[trip] = wscore;
    breakdownByTrip[trip] = breakdown;
  });

  // Helper: check if all wants are WC for a trip.
  function allWantsWC(trip) {
    const bd = breakdownByTrip[trip];
    if (!bd) return false;
    return bd.every(b => b.val === 5 || b.adapted);
  }

  // Helper: get WC/NWC label for each want.
  function wantLabels(trip) {
    const bd = breakdownByTrip[trip];
    if (!bd) return [];
    return bd.map(b => {
      if (b.val === 5 || b.adapted) return `${b.want} WC`;
      if (b.val === 3) return `${b.want} NWC`;
      return `${b.want} absent`;
    });
  }

  // Helper: count passing wants (val >= 3).
  function passingWantCount(trip) {
    const bd = breakdownByTrip[trip];
    if (!bd) return 0;
    return bd.filter(b => b.val >= 3 || b.adapted).length;
  }

  // Helper: get essential city info for a trip.
  function getEssentialCityInfo(tripAbbr) {
    const visitedCities = new Set([
      ...(profile.visitedCECities || []), ...(profile.visitedCACities || []),
      ...(profile.visitedCAfCities || []), ...(profile.visitedCCCities || []),
    ]);
    const cities = [];
    for (const [city, trips] of Object.entries(ESSENTIAL_CITIES)) {
      if (trips.includes(tripAbbr) && !visitedCities.has(city)) {
        const rank = ["London","Paris","New York","Tokyo"].includes(city) ? "Top4" :
          ["San Francisco","Washington DC","Madrid","Rome","Amsterdam","Sydney"].includes(city) ? "Top10" : "Top25";
        cities.push({ city, rank });
      }
    }
    return cities;
  }

  // Helper: build override factors list for a trip relative to its opponent.
  function getOverrideFactors(trip, opponent) {
    const tripObj = findTrip(trip);
    const oppObj = findTrip(opponent);
    if (!tripObj || !oppObj) return [];
    const factors = [];

    // Untouched continent vs touched.
    const tripUntouched = !touchedRegions.includes(tripObj.region);
    const oppUntouched = !touchedRegions.includes(oppObj.region);
    if (tripUntouched && !oppUntouched) {
      factors.push(`untouched ${tripObj.region}`);
    }

    // Essential city advantage.
    const tripCities = getEssentialCityInfo(trip);
    const oppCities = getEssentialCityInfo(opponent);
    const tripBestRank = tripCities.reduce((best, c) => {
      const r = c.rank === "Top4" ? 4 : c.rank === "Top10" ? 3 : c.rank === "Top25" ? 2 : 0;
      return Math.max(best, r);
    }, 0);
    const oppBestRank = oppCities.reduce((best, c) => {
      const r = c.rank === "Top4" ? 4 : c.rank === "Top10" ? 3 : c.rank === "Top25" ? 2 : 0;
      return Math.max(best, r);
    }, 0);
    if (tripBestRank > oppBestRank) {
      const bestCity = tripCities.find(c => {
        const r = c.rank === "Top4" ? 4 : c.rank === "Top10" ? 3 : 2;
        return r === tripBestRank;
      });
      if (bestCity) factors.push(`${bestCity.city} ${bestCity.rank}`);
    }

    // YP advantage.
    const tripYP = PRIMARY_YP.includes(trip) ? "Primary" :
      SECONDARY_YP.includes(trip) ? "Secondary" : "none";
    const oppYP = PRIMARY_YP.includes(opponent) ? "Primary" :
      SECONDARY_YP.includes(opponent) ? "Secondary" : "none";
    const ypRank = { "Primary": 3, "Secondary": 2, "none": 0 };
    if (ypRank[tripYP] > ypRank[oppYP]) {
      factors.push(`${tripYP} YP`);
    }

    // Logistical burden on this trip (weakens its case but still listed as context).
    const tripResult = f2Result.gates.fg1.results[trip];
    if (tripResult && tripResult.unconditionalFlag) {
      factors.push("but logistical burden trigger active");
    }

    return factors;
  }

  // ── Blocking Power Classification table ─────────────────────
  // Emitted before any pair-wise checks so AIQC sees structural
  // blocking properties for every ranked trip in one place.
  const ageInBand = (profile.age != null && profile.age < 30);
  console.log();
  console.log("  ─── Blocking Power Classification ───");
  ranked.forEach(trip => {
    const tripObj = findTrip(trip);
    if (!tripObj) return;
    const isUntouched = !touchedRegions.includes(tripObj.region);
    const isPrimaryYP = PRIMARY_YP.includes(trip);
    const isT1SD = tripObj.tier === 1 &&
      !["Big4", "ContinentalPB"].includes(tripObj.type);

    // Suffixes for structural properties (logistical burden, exotic island).
    const suffixes = [];
    const tripResult = f2Result.gates.fg1.results[trip];
    if (tripResult && tripResult.unconditionalFlag) {
      suffixes.push("logistical burden presumption active");
    }
    if (tripObj.type === "ExoticIsland") {
      suffixes.push("Exotic Island subordinated to last");
    }
    const suffixStr = suffixes.length > 0 ? ` (${suffixes.join(", ")})` : "";

    let classification;
    if (tripObj.type === "Big4") {
      classification = "Level 1 (Big 4)";
    } else if (isT1SD && isUntouched && isPrimaryYP && ageInBand) {
      classification = `Level 2 (TRIFECTA — T1 + untouched ${tripObj.region} + Primary YP, in-band age ${profile.age})`;
    } else if (isPrimaryYP && ageInBand) {
      const touchedDesc = isUntouched ? `untouched ${tripObj.region}` : `touched ${tripObj.region}`;
      classification = `Level 3 (Primary YP, ${touchedDesc})`;
    } else {
      classification = "None";
    }

    console.log(`    ${trip}: ${classification}${suffixStr}`);
  });

  // ── Primary YP lockout validation scan ──────────────
  // For every pair where a non-Primary-YP trip is ranked ABOVE a
  // Primary YP trip, emit a four-condition lockout check showing
  // whether the non-Primary trip legitimately overcomes the lockout.
  const lockoutChecks = [];
  for (let i = 0; i < ranked.length; i++) {
    for (let j = i + 1; j < ranked.length; j++) {
      const hi = ranked[i], lo = ranked[j]; // hi = higher-ranked, lo = lower-ranked
      const hiIsPrimaryYP = PRIMARY_YP.includes(hi);
      const loIsPrimaryYP = PRIMARY_YP.includes(lo);
      // We want: hi is NOT Primary YP, lo IS Primary YP.
      if (hiIsPrimaryYP || !loIsPrimaryYP) continue;
      const hiWs = wscoreByTrip[hi];
      const loWs = wscoreByTrip[lo];
      if (hiWs == null || loWs == null) continue;

      // Exception filter: if hi is Big4, skip (Big4 always above).
      const hiTripObj = findTrip(hi);
      if (hiTripObj && hiTripObj.type === "Big4") continue;

      lockoutChecks.push({ hi, lo, hiWs, loWs });
    }
  }

  if (lockoutChecks.length > 0) {
    console.log();
    lockoutChecks.forEach(({ hi, lo, hiWs, loWs }) => {
      const hiAllWC = allWantsWC(hi);
      const hiLabels = wantLabels(hi);
      const hiPassed = passingWantCount(hi);
      const loPassed = passingWantCount(lo);
      const hiMoreWants = hiPassed > loPassed;
      const hiTripObj = findTrip(hi);
      const hiSpineVisited = hiTripObj
        ? hiTripObj.spineCountries.some(sc =>
            (profile.visitedCountries || []).some(vc => vc === sc))
        : false;
      const gap = hiWs - loWs;
      const gapMet = gap >= 6;

      console.log(`    ${hi} vs ${lo} — Primary YP lockout check:`);

      // Condition (a): all wants WC
      if (hiAllWC) {
        console.log(`      (a) all wants WC: YES (${hiLabels.join(", ")})`);
      } else {
        console.log(`      (a) all wants WC: NO (${hiLabels.join(", ")})`);
        console.log(`      → Condition (a) fails. Lockout HOLDS. ${lo} ranks above ${hi}.`);
        console.log();
        return;
      }

      // Condition (b): more wants than Primary YP trip
      if (hiMoreWants) {
        console.log(`      (b) more wants than ${lo}: YES (${hiPassed} vs ${loPassed})`);
      } else {
        console.log(`      (b) more wants than ${lo}: NO (${hiPassed} vs ${loPassed})`);
        console.log(`      → Condition (b) fails. Lockout HOLDS. ${lo} ranks above ${hi}.`);
        console.log();
        return;
      }

      // Condition (c): spine country NOT in visitedCountries
      if (!hiSpineVisited) {
        const spineStr = hiTripObj ? hiTripObj.spineCountries.join(",") : hi;
        console.log(`      (c) spine country in visitedCountries: NO (${spineStr} not in visitedCountries) → unvisited country → PASS`);
      } else {
        const spineStr = hiTripObj ? hiTripObj.spineCountries.join(",") : hi;
        console.log(`      (c) spine country in visitedCountries: YES (${spineStr} in visitedCountries) → FAIL`);
        console.log(`      → Condition (c) fails. Lockout HOLDS. ${lo} ranks above ${hi}.`);
        console.log();
        return;
      }

      // Condition (d): wscore gap ≥6
      if (gapMet) {
        console.log(`      (d) wscore gap ≥6: YES (${hiWs} - ${loWs} = ${gap})`);
      } else {
        console.log(`      (d) wscore gap ≥6: NO (${hiWs} - ${loWs} = ${gap})`);
        console.log(`      → Condition (d) fails. Lockout HOLDS. ${lo} ranks above ${hi}.`);
        console.log();
        return;
      }

      console.log(`      → All 4 conditions met. Lockout OVERCOME. ${hi} ranks above ${lo}.`);
      console.log();
    });
  }

  // ── Wscore anomaly scan (non-Primary-YP pairs) ─────
  const balancingFlags = [];
  for (let i = 0; i < ranked.length - 1; i++) {
    for (let j = i + 1; j < ranked.length; j++) {
      const hi = ranked[i], lo = ranked[j];
      const hiWs = wscoreByTrip[hi];
      const loWs = wscoreByTrip[lo];
      if (hiWs == null || loWs == null) continue;
      if (loWs <= hiWs) continue;

      // Exception filter — suppress if higher trip is protected.
      const hiTripObj = findTrip(hi);
      if (hiTripObj) {
        // Exception 1: Big 4
        if (hiTripObj.type === "Big4") continue;
        // Exception 2: T1 SD + untouched continent + Primary YP
        const isT1SD = hiTripObj.tier === 1 &&
          !["Big4", "ContinentalPB"].includes(hiTripObj.type);
        const isUntouched = !touchedRegions.includes(hiTripObj.region);
        const isPrimaryYP = PRIMARY_YP.includes(hi);
        if (isT1SD && isUntouched && isPrimaryYP) continue;
      }

      balancingFlags.push({ hi, lo, hiWs, loWs, hiIdx: i, loIdx: j });
    }
  }

  if (balancingFlags.length > 0) {
    console.log();

    balancingFlags.forEach(({ hi, lo, hiWs, loWs, hiIdx, loIdx }) => {
      // ── Non-Primary-YP pairs — wscore default ──
      // Check for override factors favoring hi (the higher-ranked, lower-wscore trip).
      const overrideFactors = getOverrideFactors(hi, lo);

      if (overrideFactors.length === 0) {
        console.log(`    NOTE: ${lo} (wscore ${loWs}) vs ${hi} (wscore ${hiWs}). No blocking power. Wscore governs. ${lo} ranks above ${hi}.`);
      } else {
        console.log(`    NOTE: ${lo} (wscore ${loWs}) vs ${hi} (wscore ${hiWs}). No blocking power. Wscore default favors ${lo}. Override factors for ${hi}: ${overrideFactors.join(", ")}. AIQC may override ONLY using these factors.`);
      }
      console.log();
    });
  }
}

// ═══════════════════════════════════════════════════════════════════
// F2 GATE 3 FOOTER (v2.26 Patch 2)
// ═══════════════════════════════════════════════════════════════════

function printF2GateFooter(profile, f1Result, f2Result) {
  const ranked = f2Result.gates.fg3.ranked;
  const count = ranked.length;

  console.log();
  console.log(`  Gate-passing trips after exclusions: ${count}. Main list capacity: 8. All gate-passing trips should appear on the main list unless AIQC has specific articulable grounds for demotion.`);

  // Exotic Island position check.
  const lastIdx = ranked.length - 1;
  ["FP", "Seychelles"].forEach(eiTrip => {
    const idx = ranked.indexOf(eiTrip);
    if (idx === -1) return;
    if (idx === lastIdx) return;
    console.log(`  ${eiTrip} is an Exotic Island — per CP, subordinate to last position on main list in F2. Current position: #${idx+1}. AIQC should move to #${lastIdx+1}.`);
  });
}

// ═══════════════════════════════════════════════════════════════════
// AUSTRALIA COMPARISON LINE (v2.26 Patch 11)
// ═══════════════════════════════════════════════════════════════════

function printAustraliaComparison(profile, f1Result, f2Result) {
  const ranked = f2Result.gates.fg3.ranked;
  if (!ranked.includes("Australia")) return;

  const g1r = f2Result.gates.fg1.results;

  // Build effective wscore map for the ranked set.
  const effectiveWscore = {};
  ranked.forEach(t => {
    const r = g1r[t];
    if (!r) return;
    if (r.adaptationAdd) effectiveWscore[t] = r.adaptationAddWscore;
    else if (r.viaAdaptation) effectiveWscore[t] = r.adaptationWscore;
    else effectiveWscore[t] = r.wscore;
  });

  const ausWs = effectiveWscore["Australia"];
  if (ausWs == null) return;

  const compactPeers = ranked
    .filter(t => t !== "Australia")
    .filter(t => effectiveWscore[t] != null && effectiveWscore[t] >= ausWs)
    .sort((a, b) => {
      const wsDiff = effectiveWscore[b] - effectiveWscore[a];
      if (wsDiff !== 0) return wsDiff;
      return ranked.indexOf(a) - ranked.indexOf(b);
    });

  if (compactPeers.length === 0) return;

  const peerStr = compactPeers.map(t => `${t} (${effectiveWscore[t]})`).join(", ");
  console.log(`      Compact-routing trips with wscore ≥ Australia (${ausWs}): ${peerStr}.`);
  console.log(`      Per CP: Australia ranks below compact-routing trips with comparable gate scores unless Balancing Test supports with multiple independent reasons not relying on continent status alone.`);
}

// ═══════════════════════════════════════════════════════════════════
// PER-TRIP CITATION REPORT (v2.26 Patch 5 — completely rewritten)
// ═══════════════════════════════════════════════════════════════════

function printAdaptExtendReport(profile, f1Result, f2Result, wants) {
  const g1r = f2Result.gates.fg1.results;
  const activityTable = f2Result.activityTable;
  const fg3Log = f2Result.gates.fg3.log || [];

  const g1Excluded = new Set((f1Result.gates.g1 && f1Result.gates.g1.excluded) || []);
  const g17Cnr = (f1Result.gates.g17 && f1Result.gates.g17.cnr) || null;

  // Parse Gate 3 log for block/exclusion reasons keyed by trip.
  const blockReasons = {};
  fg3Log.forEach(line => {
    const blockedMatch = line.match(/^([^:]+):\s*blocked by (.+?)(?:\s*—|$)/);
    if (blockedMatch) {
      blockReasons[blockedMatch[1].trim()] = `blocked by ${blockedMatch[2].trim()}`;
      return;
    }
    const excludedMatch = line.match(/^([^:]+):\s*excluded by (.+?)(?:\s*—|$)/);
    if (excludedMatch) {
      blockReasons[excludedMatch[1].trim()] = `excluded by ${excludedMatch[2].trim()}`;
    }
  });

  // Collect eligible trips: PASS or NEAR_MISS, minus filtered exclusions.
  const eligibleTrips = [];
  Object.entries(g1r).forEach(([tripKey, r]) => {
    if (tripKey.includes(" +")) return;
    if (g1Excluded.has(tripKey)) return;
    if (g17Cnr && tripKey === g17Cnr) return;
    if (r.status === "PASS" || r.status === "NEAR_MISS") {
      eligibleTrips.push({ tripKey, r });
    }
  });

  const ranked = f2Result.ranked;
  const rankIdx = (t) => {
    const i = ranked.indexOf(t);
    return i === -1 ? 9999 : i;
  };
  eligibleTrips.sort((a, b) => {
    if (a.r.status !== b.r.status) return a.r.status === "PASS" ? -1 : 1;
    return rankIdx(a.tripKey) - rankIdx(b.tripKey);
  });

  console.log();
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  PER-TRIP CITATION REPORT");
  console.log(`  Wants scanned: [${wants.join(", ")}]`);
  console.log("═══════════════════════════════════════════════════════════════");

  eligibleTrips.forEach(({ tripKey, r }) => {
    // Build trip header.
    let header;
    if (r.adaptationAdd) {
      const wantList = (r.adaptationAddWants || []).map(aw => aw.want).join("+");
      header = `[PROMOTED via Adaptation Add ${wantList} ${r.adaptationAddPassed}/${r.wantCount} (base ${r.passed}/${r.wantCount})]`;
    } else if (r.rescued) {
      const blockSuffix = blockReasons[tripKey] ? `, ${blockReasons[tripKey]}` : "";
      // Strip base trip name from variant key for display ("Tanzania +Zanzibar" → "+Zanzibar").
      const variantSuffix = r.viaAdaptation && r.viaAdaptation.startsWith(tripKey + " ")
        ? r.viaAdaptation.substring(tripKey.length + 1)
        : r.viaAdaptation;
      header = `[RESCUED via ${variantSuffix} ${r.adaptationPassed}/${r.wantCount}${blockSuffix}]`;
    } else if (r.enhancement) {
      header = `[PASS ${r.passed}/${r.wantCount}, ENHANCED via ${r.viaAdaptation}]`;
    } else {
      header = `[${r.status} ${r.passed}/${r.wantCount}]`;
    }

    console.log();
    console.log(`  Trip: ${tripKey} ${header}`);

    // Per-want lines.
    wants.forEach(w => {
      const val = getActivityRating(activityTable, tripKey, w);
      const entries = getActivityEntries(activityTable, tripKey, w);
      const onSpine = entries.filter(e => e.type === "ON-SPINE");
      const adapts  = entries.filter(e => e.type === "ADAPT");
      const extends_ = entries.filter(e => e.type === "EXTEND");

      let tierLabel;
      if (val === 5) tierLabel = "WC (5)";
      else if (val === 3) tierLabel = "NWC (3)";
      else tierLabel = "— (0)";

      const onSpineText = onSpine.length > 0
        ? onSpine.map(e => e.text).join("; ")
        : "";
      if (onSpineText) {
        console.log(`    ${w}: ${tierLabel} — ${onSpineText}`);
      } else {
        console.log(`    ${w}: ${tierLabel}`);
      }
      adapts.forEach(e => console.log(`      ADAPT: ${e.text}`));
      extends_.forEach(e => console.log(`      EXTEND: ${e.text}`));
    });
  });

  console.log();
}


// ═══════════════════════════════════════════════════════════════════
// CAP-DROPPED CANDIDATES
// ═══════════════════════════════════════════════════════════════════

function printCapDropped(profile, f1Result) {
  const g1  = f1Result.gates.g1;
  const g3  = f1Result.gates.g3;
  const g4  = f1Result.gates.g4;
  const g5  = f1Result.gates.g5;
  const g6  = f1Result.gates.g6;
  const g9  = f1Result.gates.g9;
  const g11 = f1Result.gates.g11;
  const g13 = f1Result.gates.g13;
  const g14 = f1Result.gates.g14;
  const g15 = f1Result.gates.g15;

  const isExcluded = (a) =>
    g1.excluded.includes(a) ||
    g3.results[a] === "ELIMINATED" ||
    (g9.applies && g9.hardExcluded.includes(a));

  const visitedCities = new Set([
    ...(profile.visitedCECities || []),
    ...(profile.visitedCACities || []),
    ...(profile.visitedCAfCities || []),
    ...(profile.visitedCCCities || []),
  ]);

  function getUnvisitedEssentialCities(tripAbbr) {
    const cities = [];
    for (const [city, trips] of Object.entries(ESSENTIAL_CITIES)) {
      if (trips.includes(tripAbbr) && !visitedCities.has(city)) {
        const rank = ["London","Paris","New York","Tokyo"].includes(city) ? "Top4" :
          ["San Francisco","Washington DC","Madrid","Rome","Amsterdam","Sydney"].includes(city) ? "Top10" : "Top25";
        cities.push({ city, rank });
      }
    }
    return cities;
  }

  function getDimensionValue(tripAbbr) {
    const serves = [];
    const DIMS = {
      "outdoor/adventure":["hiking_mountains","camping_backpacking","road_trip"],
      "fun/social":["extrovert"], "cultural/intellectual":["history","art"],
      "wildlife/nature":["wildlife","rainforests"], "performing_arts":["performing_arts"],
      "visual_art":["art"], "food/culinary":["foodie"],
      "beach/water":["beaches","scuba_snorkel","sailing_boating"],
      "mountain/alpine":["hiking_mountains","lakes"], "road_trip":["road_trip"],
    };
    for (const [dim, fns] of Object.entries(DIMS)) {
      if (!g14.relevant[dim]) continue;
      const tripFlags = g13.flags[tripAbbr] || [];
      if (!fns.some(fn => tripFlags.includes(fn))) continue;
      const top8Serving = g14.servingTrips[dim] || [];
      if (top8Serving.length === 0) serves.push({ dim, status: "0 T8 providers" });
      else if (top8Serving.length === 1) serves.push({ dim, status: "1 T8 provider" });
    }
    return serves;
  }

  const candidates = TRIPS.filter(t => {
    const a = t.abbr;
    if (isExcluded(a)) return false;
    if (f1Result.top8.includes(a) || f1Result.next5.includes(a)) return false;

    const region = t.region;
    const capUsed = g15.regionCounts[region] || 0;
    const cap = g6.caps[region] || 2;
    if (capUsed < cap) return false;

    const fc = g13.flagCounts[a] || 0;
    const ff = (g13.flags[a] || []).includes("friends_family");
    const essentials = getUnvisitedEssentialCities(a);
    const dimVal = getDimensionValue(a);

    return fc >= 3 || dimVal.length > 0 || ff || essentials.length > 0;
  });

  console.log();
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  CAP-DROPPED CANDIDATES");
  console.log("  (Survived all gates, dropped solely by continent cap,");
  console.log("   with 3+ flags OR scarce/absent dim OR F/F OR essential city)");
  console.log("═══════════════════════════════════════════════════════════════");

  if (candidates.length === 0) {
    console.log("\n  (none)");
    return;
  }

  const CAP_DISCLOSURE_FLAGS = ["fear_snakes","fear_heights","left_side_driving","right_side_driving"];

  const CITY_TIER_RANK = { "Top4": 3, "Top10": 2, "Top25": 1 };

  function getHighestCityTier(tripAbbr) {
    const cities = getUnvisitedEssentialCities(tripAbbr);
    let best = 0;
    cities.forEach(c => { best = Math.max(best, CITY_TIER_RANK[c.rank] || 0); });
    return best;
  }

  function getMaxRatedAlignFlags(prof) {
    const maxFlags = new Set();
    if (prof.wildlife_interest >= 10) maxFlags.add("wildlife");
    if (prof.hiking >= 5 && (prof.landscapes.mountains || 0) >= 10) maxFlags.add("hiking_mountains");
    if (prof.performing_arts >= 10) maxFlags.add("performing_arts");
    if (prof.art >= 5) maxFlags.add("art");
    if ((prof.snorkeling >= 5 || prof.scuba >= 5)) maxFlags.add("scuba_snorkel");
    if (prof.roadTrip === "love") maxFlags.add("road_trip");
    if (prof.extrovert >= 10) maxFlags.add("extrovert");
    if ((prof.camping >= 5 || prof.backpacking >= 5)) maxFlags.add("camping_backpacking");
    if ((prof.landscapes.deserts || 0) >= 10) maxFlags.add("deserts");
    if (prof.foodie === true) maxFlags.add("foodie");
    if ((prof.landscapes.beaches || 0) >= 10) maxFlags.add("beaches");
    if ((prof.landscapes.rainforests || 0) >= 10) maxFlags.add("rainforests");
    if ((prof.landscapes.lakes || 0) >= 10) maxFlags.add("lakes");
    if (prof.history_rating >= 5) maxFlags.add("history");
    if (prof.trainPref === "train") maxFlags.add("train_preference");
    if ((prof.landscapes.vineyards || 0) >= 10) maxFlags.add("vineyards_wine");
    if (prof.sailing >= 5) maxFlags.add("sailing_boating");
    if (prof.fishing >= 5) maxFlags.add("fishing");
    if (prof.golf >= 5) maxFlags.add("golf");
    return maxFlags;
  }

  const maxRatedFlags = getMaxRatedAlignFlags(profile);

  candidates.forEach(trip => {
    const a = trip.abbr;
    const fc = g13.flagCounts[a] || 0;
    const fl = g13.flags[a] || [];
    const region = trip.region;
    const capUsed = g15.regionCounts[region] || 0;
    const cap = g6.caps[region] || 2;

    const holders = [...f1Result.top8, ...f1Result.next5].filter(x => {
      const xt = findTrip(x);
      return xt && xt.region === region;
    });

    const alignFlags = fl.filter(f => !CAP_DISCLOSURE_FLAGS.includes(f));
    const discFlags = filterDrivingDisclosures(fl.filter(f => CAP_DISCLOSURE_FLAGS.includes(f)), profile);
    const ff = fl.includes("friends_family");
    const essentials = getUnvisitedEssentialCities(a);
    const dimVal = getDimensionValue(a);
    const untouchedSpine = trip.spineCountries.filter(sc =>
      !countryInList(sc, profile.visitedCountries || []));
    const st = (g4.tripStatuses[a] || "").split("|")[0];

    const un = st.startsWith("UNTOUCHED");
    const isYP = PRIMARY_YP.includes(a) || SECONDARY_YP.includes(a);
    const isIC = SECONDARY_EURO_IC.includes(a) || a === "Spain North";
    const isOB = trip.type === "SD_OB";
    const isEI = trip.type === "ExoticIsland";
    let bucketName;
    if (isEI) bucketName = "B3b-Exotic";
    else if (!isOB && un && trip.tier === 1 && (fc >= 3 || isYP || isIC)) bucketName = "Strong-B1";
    else if (!isOB && ((isYP && !un) || (un && trip.tier === 2))) bucketName = "Strong-B1b";
    else if (!isOB && un && trip.tier === 1 && fc < 3 && !isYP && !isIC) bucketName = "Weak-B1";
    else if (!isOB && !un) bucketName = "B3-Touched";
    else if (isOB && un) bucketName = `B2${trip.tier===2?"b":""}-OB`;
    else bucketName = "B3-OB";

    console.log();
    console.log(`  ┌─ ${a}  (T${trip.tier} ${bucketName})`);
    console.log(`  │  Flags: ${alignFlags.join(", ") || "(none)"}`);
    if (discFlags.length > 0)
      console.log(`  │  Disclosures: ${discFlags.join(", ")}`);
    console.log(`  │  Blocked by: ${region} cap (${capUsed}/${cap})`);
    console.log(`  │  Cap holders: ${holders.map(h => {
      const pos = f1Result.top8.includes(h) ? `T8#${f1Result.top8.indexOf(h)+1}` :
                  f1Result.next5.includes(h) ? `N5#${f1Result.next5.indexOf(h)+9}` : "?";
      return `${h}(${pos})`;
    }).join(", ")}`);

    const specials = [];
    if (ff) {
      const overlap = (profile.friendsFamilyCountries || []).filter(c =>
        trip.spineCountries.some(sc => countriesMatch(sc, c)));
      specials.push(`Friends/Family: spine overlap with ${overlap.join(", ")}`);
    }
    if (essentials.length > 0)
      specials.push(`Essential cities: ${essentials.map(c => `${c.city} (${c.rank})`).join(", ")}`);
    if (dimVal.length > 0)
      specials.push(`Dimension value: ${dimVal.map(d => `${d.dim} [${d.status}]`).join(", ")}`);
    if (untouchedSpine.length > 0 && st.startsWith("TOUCHED"))
      specials.push(`Untouched spine in touched continent: ${untouchedSpine.join(", ")}`);

    if (specials.length > 0) {
      console.log(`  │`);
      console.log(`  │  SPECIAL FACTORS:`);
      specials.forEach(s => console.log(`  │    • ${s}`));
    }

    const DIMS_CC = {
      "outdoor/adventure":["hiking_mountains","camping_backpacking","road_trip"],
      "fun/social":["extrovert"], "cultural/intellectual":["history","art"],
      "wildlife/nature":["wildlife","rainforests"], "performing_arts":["performing_arts"],
      "visual_art":["art"], "food/culinary":["foodie"],
      "beach/water":["beaches","scuba_snorkel","sailing_boating"],
      "mountain/alpine":["hiking_mountains","lakes"], "road_trip":["road_trip"],
    };

    function getDimsServed(tripAbbr) {
      const tf = g13.flags[tripAbbr] || [];
      const served = [];
      for (const [dim, fns] of Object.entries(DIMS_CC)) {
        if (fns.some(fn => tf.includes(fn))) served.push(dim);
      }
      return served;
    }

    function getAlignForTrip(tripAbbr) {
      return (g13.flags[tripAbbr] || []).filter(f => !CAP_DISCLOSURE_FLAGS.includes(f));
    }
    function getDiscForTrip(tripAbbr) {
      return filterDrivingDisclosures((g13.flags[tripAbbr] || []).filter(f => CAP_DISCLOSURE_FLAGS.includes(f)), profile);
    }
    function getYPForTrip(tripAbbr) {
      if (!f1Result.gates.g10.ypActive) return "none";
      if (PRIMARY_YP.includes(tripAbbr)) return "Primary";
      if (SECONDARY_YP.includes(tripAbbr)) return "Secondary";
      return "none";
    }
    function getEssentialCitiesForTrip(tripAbbr) {
      const cities = [];
      for (const [city, trips] of Object.entries(ESSENTIAL_CITIES)) {
        if (trips.includes(tripAbbr) && !visitedCities.has(city)) {
          const rank = ["London","Paris","New York","Tokyo"].includes(city) ? "Top4" :
            ["San Francisco","Washington DC","Madrid","Rome","Amsterdam","Sydney"].includes(city) ? "Top10" : "Top25";
          cities.push(`${city} (${rank})`);
        }
      }
      return cities;
    }
    function getFFForTrip(tripObj) {
      const pff = (profile.friendsFamilyCountries || []);
      if (pff.length === 0) return "none";
      const overlap = pff.filter(c => tripObj.spineCountries.some(sc => countriesMatch(sc, c)));
      return overlap.length > 0 ? overlap.join(", ") : "none";
    }
    function getSpineStatusForTrip(tripObj) {
      const visited = tripObj.spineCountries.filter(sc => countryInList(sc, profile.visitedCountries || []));
      if (visited.length === 0) return "unvisited";
      if (visited.length === tripObj.spineCountries.length) return "visited";
      return "mixed";
    }
    function getLangScore(tripAbbr) {
      return f1Result.gates.g12.scores[tripAbbr] || 0;
    }

    const loserDims = getDimsServed(a);
    const loserAlignCount = alignFlags.filter(f => f !== "friends_family").length + (ff ? 2 : 0);

    holders.forEach(h => {
      const winnerDims = getDimsServed(h);
      const loserOnly = loserDims.filter(d => !winnerDims.includes(d));
      const isCloseCall = (loserAlignCount >= 3 || loserOnly.length > 0);

      if (!isCloseCall) return;

      const hTrip = findTrip(h);
      const aTrip = trip;

      const holderIsPBorBig4 = ["Big4","ContinentalPB"].includes(hTrip.type);
      const challengerIsSD = !["Big4","ContinentalPB"].includes(aTrip.type);
      if (holderIsPBorBig4 && challengerIsSD) return;

      const hTouched = g4.touchedRegions.includes(hTrip.region);
      const aTouched = g4.touchedRegions.includes(aTrip.region);
      if (!hTouched && aTouched && hTrip.region === aTrip.region) return;

      const challengerFF = ff;
      const holderFF = (g13.flags[h] || []).includes("friends_family");
      const ffEdge = challengerFF && !holderFF;

      const aCat = aTrip.expCategory;
      const hCat = hTrip.expCategory;
      const sameCatForCity = (aCat === hCat) || (aCat === "mixed" && hCat === "mixed");
      let cityEdge = false;
      if (sameCatForCity) {
        const challengerCityTier = getHighestCityTier(a);
        const holderCityTier = getHighestCityTier(h);
        cityEdge = challengerCityTier > holderCityTier;
      }

      const challengerYP = getYPForTrip(a);
      const holderYP = getYPForTrip(h);
      const ypRank = { "Primary": 2, "Secondary": 1, "none": 0, "none (age 30+)": 0 };
      const ypEdge = (ypRank[challengerYP] || 0) > (ypRank[holderYP] || 0);

      const challengerAlignFlags = getAlignForTrip(a).filter(f => f !== "friends_family");
      const challengerMaxFlags = challengerAlignFlags.filter(f => maxRatedFlags.has(f));
      const rareMaxFlags = challengerMaxFlags.filter(flag => {
        const t8Count = f1Result.top8.filter(t8abbr => {
          const t8flags = getAlignForTrip(t8abbr).filter(f => f !== "friends_family");
          return t8flags.includes(flag);
        }).length;
        return t8Count <= 1;
      });
      const rareT8Edge = challengerMaxFlags.length >= 2 && rareMaxFlags.length >= 1;

      if (!ffEdge && !cityEdge && !ypEdge && !rareT8Edge) return;

      const pos = f1Result.top8.includes(h) ? `T8#${f1Result.top8.indexOf(h)+1}` :
                  f1Result.next5.includes(h) ? `N5#${f1Result.next5.indexOf(h)+9}` : "?";

      const hAlign = getAlignForTrip(h);
      const hDisc = getDiscForTrip(h);

      // Prior exp
      const vc = profile.visitedCountries || [];
      const countriesByCategory = { city: [], mixed: [], nature: [] };
      vc.forEach(country => {
        const nc = normalizeCountry(country);
        const matching = TRIPS.filter(t =>
          t.spineCountries.some(sc => normalizeCountry(sc) === nc));
        const cats = new Set(matching.map(t => t.expCategory));
        cats.forEach(cat => {
          if (!countriesByCategory[cat].includes(nc)) countriesByCategory[cat].push(nc);
        });
      });
      const dominantCat = Object.entries(countriesByCategory)
        .sort((x, y) => y[1].length - x[1].length)[0][0];
      const regionCountsForPrior = {};
      vc.forEach(c => {
        const r = getCountryRegion(c);
        if (r) regionCountsForPrior[r] = (regionCountsForPrior[r] || 0) + 1;
      });
      const dominantRegionEntry = Object.entries(regionCountsForPrior)
        .sort((x, y) => y[1] - x[1])[0];
      const dominantRegion = dominantRegionEntry?.[0] || "prior";
      const dominantRegionCount = dominantRegionEntry?.[1] || 0;

      function priorExpDesc(tripObj) {
        const tc = tripObj.expCategory;
        if (tc === dominantCat) {
          const noun = dominantRegionCount === 1 ? "country" : "countries";
          return `SIMILAR — ${dominantRegionCount} ${dominantRegion} ${noun} visited`;
        } else {
          const priorInCat = countriesByCategory[tc]?.length || 0;
          if (priorInCat === 0) {
            return `NEW — no prior ${tc} travel`;
          } else {
            return `Light — ${priorInCat} ${tc} prior`;
          }
        }
      }

      console.log(`  │`);
      console.log(`  │  ⚡ CLOSE_CALL: ${a} vs ${h} (${pos})`);
      console.log(`  │  ┌──────────────────────────────┬──────────────────────────────┐`);
      console.log(`  │  │  HOLDER: ${(h + " ").padEnd(20)}│  CHALLENGER: ${(a + " ").padEnd(16)}│`);
      console.log(`  │  ├──────────────────────────────┼──────────────────────────────┤`);

      console.log(`  │  │  Exp: ${hCat.padEnd(23)}│  Exp: ${aCat.padEnd(23)}│`);

      const hPrior = priorExpDesc(hTrip);
      const aPrior = priorExpDesc(aTrip);
      console.log(`  │  │  Prior: ${hPrior.substring(0,21).padEnd(21)}│  Prior: ${aPrior.substring(0,21).padEnd(21)}│`);
      if (hPrior.length > 21) console.log(`  │  │    ${hPrior.substring(21).padEnd(25)}│${" ".repeat(31)}│`);
      if (aPrior.length > 21) console.log(`  │  │${" ".repeat(31)}│    ${aPrior.substring(21).padEnd(25)}│`);

      // Door analysis: only when Prior status is asymmetric
      const hPriorLabel = hPrior.split("—")[0].trim();
      const aPriorLabel = aPrior.split("—")[0].trim();
      if (hPriorLabel !== aPriorLabel) {
        const newTrip = (aPriorLabel === "NEW" || aPriorLabel === "Light") ? { abbr: a, obj: aTrip } : { abbr: h, obj: hTrip };
        const famTrip = (newTrip.abbr === a) ? { abbr: h, obj: hTrip } : { abbr: a, obj: aTrip };
        const newCat = newTrip.obj.expCategory;
        const famCat = famTrip.obj.expCategory;
        const newPriorCount = countriesByCategory[newCat]?.length || 0;
        const famPriorCount = countriesByCategory[famCat]?.length || 0;
        const newAlignFlags = getAlignForTrip(newTrip.abbr).filter(f => f !== "friends_family");
        const newMaxAligned = newAlignFlags.filter(f => maxRatedFlags.has(f));
        const famAlignFlags = getAlignForTrip(famTrip.abbr).filter(f => f !== "friends_family");
        const famRedundant = famAlignFlags.filter(flag => {
          const othersServing = f1Result.top8.filter(t8 => t8 !== famTrip.abbr && getAlignForTrip(t8).includes(flag)).length;
          return othersServing >= 3;
        });
        console.log(`  │  │  Door analysis:`);
        console.log(`  │  │    ${aPriorLabel === "NEW" || aPriorLabel === "Light" ? aPriorLabel : hPriorLabel}: ${newTrip.abbr} delivers ${newCat} — traveler has ${newPriorCount} prior ${newCat} trips.`);
        console.log(`  │  │         Alignment to max-rated: ${newMaxAligned.length > 0 ? newMaxAligned.join(", ") : "(none)"}`);
        console.log(`  │  │    SIMILAR: ${famTrip.abbr} delivers ${famCat} — traveler has ${famPriorCount} prior ${famCat} trips.`);
        console.log(`  │  │         Redundant on T8: ${famRedundant.length > 0 ? famRedundant.join(", ") : "(none)"}`);

        // Discovery presumption
        if (aPriorLabel === "NEW" || hPriorLabel === "NEW") {
          if (newPriorCount === 0 && famPriorCount >= 4 && newMaxAligned.length >= 2) {
            console.log(`  │  │  Discovery presumption ACTIVE: ${newTrip.abbr} opens new ${newCat} door (0 prior) with ${newMaxAligned.length} max-rated alignment flags.`);
            console.log(`  │  │  Tier and essential cities do not overcome this presumption alone.`);
            console.log(`  │  │  ${famTrip.abbr} must justify on genuinely differentiated value.`);
          }
        }
      }

      const hAlignStr = hAlign.join(", ") || "none";
      const aAlignStr = alignFlags.join(", ") || "none";
      console.log(`  │  │  Align: ${hAlignStr.substring(0,21).padEnd(21)}│  Align: ${aAlignStr.substring(0,21).padEnd(21)}│`);
      if (hAlignStr.length > 21) console.log(`  │  │    ${hAlignStr.substring(21).padEnd(25)}│${" ".repeat(31)}│`);
      if (aAlignStr.length > 21) console.log(`  │  │${" ".repeat(31)}│    ${aAlignStr.substring(21).padEnd(25)}│`);

      const hDiscStr = hDisc.join(", ") || "none";
      const aDiscStr = discFlags.join(", ") || "none";
      console.log(`  │  │  Disc: ${hDiscStr.padEnd(22)}│  Disc: ${aDiscStr.padEnd(22)}│`);

      console.log(`  │  │  YP: ${holderYP.padEnd(24)}│  YP: ${challengerYP.padEnd(24)}│`);

      if (hCat === aCat) {
        const hEC = getEssentialCitiesForTrip(h).join(", ") || "none";
        const aEC = getEssentialCitiesForTrip(a).join(", ") || "none";
        console.log(`  │  │  Cities: ${hEC.substring(0,20).padEnd(20)}│  Cities: ${aEC.substring(0,20).padEnd(20)}│`);
      }

      console.log(`  │  │  F/F: ${getFFForTrip(hTrip).padEnd(23)}│  F/F: ${getFFForTrip(aTrip).padEnd(23)}│`);

      console.log(`  │  │  T${hTrip.tier} ${hTrip.region.padEnd(24)}│  T${aTrip.tier} ${aTrip.region.padEnd(24)}│`);

      const hSpine = `${hTrip.spineCountries.join(",")} (${getSpineStatusForTrip(hTrip)})`;
      const aSpine = `${aTrip.spineCountries.join(",")} (${getSpineStatusForTrip(aTrip)})`;
      console.log(`  │  │  Spine: ${hSpine.substring(0,21).padEnd(21)}│  Spine: ${aSpine.substring(0,21).padEnd(21)}│`);

      console.log(`  │  │  Lang: ${String(getLangScore(h)).padEnd(23)}│  Lang: ${String(getLangScore(a)).padEnd(23)}│`);

      console.log(`  │  └──────────────────────────────┴──────────────────────────────┘`);

      // Cancellation block
      const hAlignAll = getAlignForTrip(h);
      const aAlignAll = getAlignForTrip(a).filter(f => f !== "friends_family");
      const sharedFlags = hAlignAll.filter(f => aAlignAll.includes(f));
      const sharedStructural = [];
      if (challengerYP === holderYP && challengerYP !== "none") sharedStructural.push(`both ${challengerYP} YP`);
      const hSpineStatus = getSpineStatusForTrip(hTrip);
      const aSpineStatus = getSpineStatusForTrip(aTrip);
      if (hSpineStatus === aSpineStatus) sharedStructural.push(`both ${hSpineStatus} spine`);
      const hContStatus = g4.touchedRegions.includes(hTrip.region) ? "touched" : "untouched";
      const aContStatus = g4.touchedRegions.includes(aTrip.region) ? "touched" : "untouched";
      if (hContStatus === aContStatus) sharedStructural.push(`both ${hContStatus} continent`);
      const sharedAll = [...sharedFlags, ...sharedStructural];

      const hUniqueFlags = hAlignAll.filter(f => !aAlignAll.includes(f));
      const aUniqueFlags = aAlignAll.filter(f => !hAlignAll.includes(f));

      const FLAG_CONTEXT = {
        "B&A":            { wildlife: "Pantanal jaguars", foodie: "Buenos Aires steakhouses", gardens: "Buenos Aires parks" },
        "Patagonia":      { hiking_mountains: "Torres del Paine", camping_backpacking: "El Chaltén circuits", fishing: "Río Grande fly-fishing" },
        "Greece":         { foodie: "Athens tavernas", beaches: "Cycladic beaches", history: "Acropolis, Delphi" },
        "Scandinavia":    { hiking_mountains: "Norwegian fjords", art: "Stockholm museums", lakes: "Swedish lake country", train_preference: "Bergen Railway", gardens: "Keukenhof, Vigeland" },
        "ISE":            { performing_arts: "West End theatre", art: "National Gallery, Tate", lakes: "Lake District", history: "Oxford, Edinburgh Castle", train_preference: "UK rail network", gardens: "Kew, Powerscourt" },
        "CA":             { performing_arts: "Tokyo kabuki, Seoul K-culture", foodie: "Tokyo/Osaka cuisine", history: "Kyoto temples", train_preference: "JR bullet trains", gardens: "Kyoto gardens" },
        "CAf":            { wildlife: "Kruger, Okavango", hiking_mountains: "Table Mountain", beaches: "Clifton, Camps Bay", vineyards_wine: "Stellenbosch", gardens: "Kirstenbosch" },
        "NZ":             { hiking_mountains: "Milford Track", camping_backpacking: "Great Walks", lakes: "Queenstown lakes", fishing: "Taupō trout" },
        "Peru":           { hiking_mountains: "Inca Trail", foodie: "Lima ceviche", lakes: "Lake Titicaca", history: "Machu Picchu" },
        "SE Asia":        { foodie: "Bangkok street food", beaches: "Thai islands", history: "Angkor Wat" },
        "Eastern Europe": { performing_arts: "Berlin/Vienna concerts", art: "Vienna/Prague galleries", history: "Prague, Budapest", train_preference: "Central European rail", gardens: "Vienna Schönbrunn" },
        "France South":   { hiking_mountains: "Pyrenees", art: "Nice/Marseille galleries", foodie: "Provençal cuisine", vineyards_wine: "Bordeaux, Rhône" },
        "Portugal":       { beaches: "Algarve coast", vineyards_wine: "Douro Valley", gardens: "Sintra gardens" },
        "Australia":      { beaches: "Bondi, Manly", vineyards_wine: "Barossa Valley", gardens: "Sydney Botanic" },
        "India North":    { wildlife: "Ranthambore tigers", history: "Taj Mahal, Jaipur", train_preference: "Rajasthan rail" },
        "Tanzania":       { wildlife: "Serengeti migration", hiking_mountains: "Kilimanjaro", camping_backpacking: "Ngorongoro camping" },
      };

      function formatUniqueFlags(tripAbbr, flags) {
        return flags.map(flag => {
          const context = (FLAG_CONTEXT[tripAbbr] && FLAG_CONTEXT[tripAbbr][flag]) || "";
          const othersServing = f1Result.top8.filter(t8 => t8 !== tripAbbr && getAlignForTrip(t8).includes(flag)).length;
          let s = context ? `${flag}: ${context}` : flag;
          if (othersServing >= 3) s += ` (redundant on T8 — ${othersServing} providers)`;
          return s;
        }).join(", ");
      }

      console.log(`  │  Cancellation:`);
      console.log(`  │    Shared (cancel): ${sharedAll.length > 0 ? sharedAll.join(", ") : "(none)"}`);
      console.log(`  │    ${h} unique: ${hUniqueFlags.length > 0 ? formatUniqueFlags(h, hUniqueFlags) : "(none)"}`);
      console.log(`  │    ${a} unique: ${aUniqueFlags.length > 0 ? formatUniqueFlags(a, aUniqueFlags) : "(none)"}`);

      // Hammer
      {
        const g14 = f1Result.gates.g14;
        const DIMS_CC = {
          "outdoor/adventure":["hiking_mountains","camping_backpacking","road_trip"],
          "fun/social":["extrovert"], "cultural/intellectual":["history","art"],
          "wildlife/nature":["wildlife","rainforests"], "performing_arts":["performing_arts"],
          "visual_art":["art"], "food/culinary":["foodie"],
          "beach/water":["beaches","scuba_snorkel","sailing_boating"],
          "mountain/alpine":["hiking_mountains","lakes"], "road_trip":["road_trip"],
        };
        function getUnservedDims(tripAbbr) {
          const tf = getAlignForTrip(tripAbbr);
          const allFlags = (g13.flags[tripAbbr] || []);
          const dims = [];
          for (const [dim, fns] of Object.entries(DIMS_CC)) {
            if (!g14.relevant[dim]) continue;
            if (!fns.some(fn => tf.includes(fn))) continue;
            const providers = g14.servingTrips[dim] || [];
            if (providers.length === 0) dims.push({ dim, providers: 0 });
          }
          if (allFlags.includes("friends_family")) {
            const t8ffCount = f1Result.top8.filter(t8 =>
              (g13.flags[t8] || []).includes("friends_family")).length;
            if (t8ffCount === 0) dims.push({ dim: "friends_family", providers: 0 });
          }
          return dims;
        }
        const hCities = getEssentialCitiesForTrip(h);
        const aCities = getEssentialCitiesForTrip(a);
        const hBestRank = hCities.length > 0 ? Math.max(...hCities.map(c => c.includes("Top4") ? 3 : c.includes("Top10") ? 2 : 1)) : 0;
        const aBestRank = aCities.length > 0 ? Math.max(...aCities.map(c => c.includes("Top4") ? 3 : c.includes("Top10") ? 2 : 1)) : 0;
        const hUnserved = getUnservedDims(h);
        const aUnserved = getUnservedDims(a);
        const hNonRedundantUnique = hUniqueFlags.filter(f => {
          const oc = f1Result.top8.filter(t8 => t8 !== h && getAlignForTrip(t8).includes(f)).length;
          return oc < 3;
        });
        const aNonRedundantUnique = aUniqueFlags.filter(f => {
          const oc = f1Result.top8.filter(t8 => t8 !== a && getAlignForTrip(t8).includes(f)).length;
          return oc < 3;
        });
        if (aBestRank > hBestRank && aUnserved.length > 0 && hNonRedundantUnique.length === 0 && aTrip.tier > hTrip.tier) {
          const holderPos = f1Result.top8.indexOf(h) + 1;
          console.log(`  │  BINDING: ${a} replaces ${h} on T8. ${h} to Next 5. No evaluation ALLOWED.`);
          console.log(`  │  ${a} placement: T8#${holderPos}. LOCKED.`);
          console.log(`  │  Function 15: ${a} position is LOCKED. Do not evaluate ${a} in adjacent pair hierarchy checks.`);
        }
        else if (hBestRank > aBestRank && hUnserved.length > 0 && aNonRedundantUnique.length === 0 && hTrip.tier > aTrip.tier) {
          // holder already on T8, no swap needed
        }
      }

      console.log(`  │  → AIQC evaluate which trip deserves this slot.`);
    });

    console.log(`  └──────────────────────────────────────────────────────`);
  });
}

// ═══════════════════════════════════════════════════════════════════
// CLOSE_CALL CHARTS — Next 5 vs Top 8
// ═══════════════════════════════════════════════════════════════════

function printCloseCallCharts(profile, f1Result) {
  const g4  = f1Result.gates.g4;
  const g6  = f1Result.gates.g6;
  const g10 = f1Result.gates.g10;
  const g12 = f1Result.gates.g12;
  const g13 = f1Result.gates.g13;
  const g15 = f1Result.gates.g15;

  // fear_heights in disclosure list.
  const CAP_DISCLOSURE_FLAGS = ["fear_snakes","fear_heights","left_side_driving","right_side_driving"];

  const visitedCities = new Set([
    ...(profile.visitedCECities || []),
    ...(profile.visitedCACities || []),
    ...(profile.visitedCAfCities || []),
    ...(profile.visitedCCCities || []),
  ]);

  function getAlignForTrip(tripAbbr) {
    return (g13.flags[tripAbbr] || []).filter(f => !CAP_DISCLOSURE_FLAGS.includes(f));
  }
  function getDiscForTrip(tripAbbr) {
    return filterDrivingDisclosures((g13.flags[tripAbbr] || []).filter(f => CAP_DISCLOSURE_FLAGS.includes(f)), profile);
  }
  function getYPForTrip(tripAbbr) {
    if (!g10.ypActive) return "none";
    if (PRIMARY_YP.includes(tripAbbr)) return "Primary";
    if (SECONDARY_YP.includes(tripAbbr)) return "Secondary";
    return "none";
  }
  function getEssentialCitiesForTrip(tripAbbr) {
    const cities = [];
    for (const [city, trips] of Object.entries(ESSENTIAL_CITIES)) {
      if (trips.includes(tripAbbr) && !visitedCities.has(city)) {
        const rank = ["London","Paris","New York","Tokyo"].includes(city) ? "Top4" :
          ["San Francisco","Washington DC","Madrid","Rome","Amsterdam","Sydney"].includes(city) ? "Top10" : "Top25";
        cities.push(`${city} (${rank})`);
      }
    }
    return cities;
  }
  function getFFForTrip(tripObj) {
    const pff = (profile.friendsFamilyCountries || []);
    if (pff.length === 0) return "none";
    const overlap = pff.filter(c => tripObj.spineCountries.some(sc => countriesMatch(sc, c)));
    return overlap.length > 0 ? overlap.join(", ") : "none";
  }
  function getSpineStatusForTrip(tripObj) {
    const visited = tripObj.spineCountries.filter(sc => countryInList(sc, profile.visitedCountries || []));
    if (visited.length === 0) return "unvisited";
    if (visited.length === tripObj.spineCountries.length) return "visited";
    return "mixed";
  }
  function getLangScore(tripAbbr) {
    return g12.scores[tripAbbr] || 0;
  }
  function getDimsServed(tripAbbr) {
    const DIMS_CC = {
      "outdoor/adventure":["hiking_mountains","camping_backpacking","road_trip"],
      "fun/social":["extrovert"], "cultural/intellectual":["history","art"],
      "wildlife/nature":["wildlife","rainforests"], "performing_arts":["performing_arts"],
      "visual_art":["art"], "food/culinary":["foodie"],
      "beach/water":["beaches","scuba_snorkel","sailing_boating"],
      "mountain/alpine":["hiking_mountains","lakes"], "road_trip":["road_trip"],
    };
    const tf = g13.flags[tripAbbr] || [];
    const served = [];
    for (const [dim, fns] of Object.entries(DIMS_CC)) {
      if (fns.some(fn => tf.includes(fn))) served.push(dim);
    }
    return served;
  }

  const CITY_TIER_RANK = { "Top4": 3, "Top10": 2, "Top25": 1 };
  function getHighestCityTier(tripAbbr) {
    const cities = [];
    for (const [city, trips] of Object.entries(ESSENTIAL_CITIES)) {
      if (trips.includes(tripAbbr) && !visitedCities.has(city)) {
        const rank = ["London","Paris","New York","Tokyo"].includes(city) ? "Top4" :
          ["San Francisco","Washington DC","Madrid","Rome","Amsterdam","Sydney"].includes(city) ? "Top10" : "Top25";
        cities.push({ rank });
      }
    }
    let best = 0;
    cities.forEach(c => { best = Math.max(best, CITY_TIER_RANK[c.rank] || 0); });
    return best;
  }

  function getMaxRatedAlignFlags(prof) {
    const maxFlags = new Set();
    if (prof.wildlife_interest >= 10) maxFlags.add("wildlife");
    if (prof.hiking >= 5 && (prof.landscapes.mountains || 0) >= 10) maxFlags.add("hiking_mountains");
    if (prof.performing_arts >= 10) maxFlags.add("performing_arts");
    if (prof.art >= 5) maxFlags.add("art");
    if ((prof.snorkeling >= 5 || prof.scuba >= 5)) maxFlags.add("scuba_snorkel");
    if (prof.roadTrip === "love") maxFlags.add("road_trip");
    if (prof.extrovert >= 10) maxFlags.add("extrovert");
    if ((prof.camping >= 5 || prof.backpacking >= 5)) maxFlags.add("camping_backpacking");
    if ((prof.landscapes.deserts || 0) >= 10) maxFlags.add("deserts");
    if (prof.foodie === true) maxFlags.add("foodie");
    if ((prof.landscapes.beaches || 0) >= 10) maxFlags.add("beaches");
    if ((prof.landscapes.rainforests || 0) >= 10) maxFlags.add("rainforests");
    if ((prof.landscapes.lakes || 0) >= 10) maxFlags.add("lakes");
    if (prof.history_rating >= 5) maxFlags.add("history");
    if (prof.trainPref === "train") maxFlags.add("train_preference");
    if ((prof.landscapes.vineyards || 0) >= 10) maxFlags.add("vineyards_wine");
    if (prof.sailing >= 5) maxFlags.add("sailing_boating");
    if (prof.fishing >= 5) maxFlags.add("fishing");
    if (prof.golf >= 5) maxFlags.add("golf");
    return maxFlags;
  }
  const maxRatedFlags = getMaxRatedAlignFlags(profile);

  // Prior exp computation
  const vc = profile.visitedCountries || [];
  const countriesByCategory = { city: [], mixed: [], nature: [] };
  vc.forEach(country => {
    const nc = normalizeCountry(country);
    const matching = TRIPS.filter(t =>
      t.spineCountries.some(sc => normalizeCountry(sc) === nc));
    const cats = new Set(matching.map(t => t.expCategory));
    cats.forEach(cat => {
      if (!countriesByCategory[cat].includes(nc)) countriesByCategory[cat].push(nc);
    });
  });
  const dominantCat = Object.entries(countriesByCategory)
    .sort((x, y) => y[1].length - x[1].length)[0][0];
  const regionCountsForPrior = {};
  vc.forEach(c => {
    const r = getCountryRegion(c);
    if (r) regionCountsForPrior[r] = (regionCountsForPrior[r] || 0) + 1;
  });
  const dominantRegionEntry = Object.entries(regionCountsForPrior)
    .sort((x, y) => y[1] - x[1])[0];
  const dominantRegion = dominantRegionEntry?.[0] || "prior";
  const dominantRegionCount = dominantRegionEntry?.[1] || 0;

  // Prior line text.
  function priorExpDesc(tripObj) {
    const tc = tripObj.expCategory;
    if (tc === dominantCat) {
      const noun = dominantRegionCount === 1 ? "country" : "countries";
      return `SIMILAR — ${dominantRegionCount} ${dominantRegion} ${noun} visited`;
    } else {
      const priorInCat = countriesByCategory[tc]?.length || 0;
      if (priorInCat === 0) {
        return `NEW — no prior ${tc} travel`;
      } else {
        return `Light — ${priorInCat} ${tc} prior`;
      }
    }
  }

  const charts = [];

  f1Result.next5.forEach(a => {
    const aTrip = findTrip(a);
    if (!aTrip) return;
    const fl = g13.flags[a] || [];
    const alignFlags = fl.filter(f => !CAP_DISCLOSURE_FLAGS.includes(f));
    const discFlags = filterDrivingDisclosures(fl.filter(f => CAP_DISCLOSURE_FLAGS.includes(f)), profile);
    const ff = fl.includes("friends_family");
    const loserDims = getDimsServed(a);
    const loserAlignCount = alignFlags.filter(f => f !== "friends_family").length + (ff ? 2 : 0);

    const holders = f1Result.top8.filter(x => {
      const xt = findTrip(x);
      return xt && xt.region === aTrip.region;
    });

    holders.forEach(h => {
      const hTrip = findTrip(h);
      if (!hTrip) return;
      const winnerDims = getDimsServed(h);
      const loserOnly = loserDims.filter(d => !winnerDims.includes(d));
      const isCloseCall = (loserAlignCount >= 3 || loserOnly.length > 0);
      if (!isCloseCall) return;

      if (["Big4","ContinentalPB"].includes(hTrip.type) && !["Big4","ContinentalPB"].includes(aTrip.type)) return;

      const hTouched = g4.touchedRegions.includes(hTrip.region);
      const aTouched = g4.touchedRegions.includes(aTrip.region);
      if (!hTouched && aTouched && hTrip.region === aTrip.region) return;

      const aCat = aTrip.expCategory;
      const hCat = hTrip.expCategory;

      const challengerFF = ff;
      const holderFF = (g13.flags[h] || []).includes("friends_family");
      const ffEdge = challengerFF && !holderFF;

      const sameCatForCity = (aCat === hCat) || (aCat === "mixed" && hCat === "mixed");
      let cityEdge = false;
      if (sameCatForCity) {
        cityEdge = getHighestCityTier(a) > getHighestCityTier(h);
      }

      const challengerYP = getYPForTrip(a);
      const holderYP = getYPForTrip(h);
      const ypRank = { "Primary": 2, "Secondary": 1, "none": 0, "none (age 30+)": 0 };
      const ypEdge = (ypRank[challengerYP] || 0) > (ypRank[holderYP] || 0);

      const challengerAlignFlags = getAlignForTrip(a).filter(f => f !== "friends_family");
      const challengerMaxFlags = challengerAlignFlags.filter(f => maxRatedFlags.has(f));
      const rareMaxFlags = challengerMaxFlags.filter(flag => {
        const t8Count = f1Result.top8.filter(t8abbr => {
          const t8flags = getAlignForTrip(t8abbr).filter(f => f !== "friends_family");
          return t8flags.includes(flag);
        }).length;
        return t8Count <= 1;
      });
      const rareT8Edge = challengerMaxFlags.length >= 2 && rareMaxFlags.length >= 1;

      if (!ffEdge && !cityEdge && !ypEdge && !rareT8Edge) return;

      charts.push({ a, h, aTrip, hTrip, aCat, hCat, alignFlags, discFlags,
                     challengerYP, holderYP });
    });
  });

  if (charts.length === 0) return;

  // SA Pairing binding check — display layer
  // Skip entirely if Gate 15 already performed the mechanical swap (Patagonia on T8)
  let saPairingBinding = false;
  const saPairingHandledByGate15 = f1Result.top8.includes("Patagonia") && !f1Result.top8.includes("B&A");
  if (!saPairingHandledByGate15 && f1Result.top8.includes("Peru") && f1Result.top8.includes("B&A") && f1Result.next5.includes("Patagonia")) {
    const hiking = profile.hiking || 0;
    const backpacking = profile.backpacking || 0;
    const mountains = profile.landscapes?.mountains || 0;
    if (hiking >= 4 && backpacking >= 4 && mountains >= 7 && (profile.outdoors || 0) >= 8) {
      saPairingBinding = true;
    }
  }

  // If binding, emit directive and suppress the Patagonia vs B&A chart
  let filteredCharts = saPairingBinding
    ? charts.filter(c => !((c.a === "Patagonia" && c.h === "B&A") || (c.a === "B&A" && c.h === "Patagonia")))
    : [...charts];

  // Hammer — pre-compute binding for each chart pair
  const hammerBindings = [];
  {
    const g14 = f1Result.gates.g14;
    const DIMS_CC = {
      "outdoor/adventure":["hiking_mountains","camping_backpacking","road_trip"],
      "fun/social":["extrovert"], "cultural/intellectual":["history","art"],
      "wildlife/nature":["wildlife","rainforests"], "performing_arts":["performing_arts"],
      "visual_art":["art"], "food/culinary":["foodie"],
      "beach/water":["beaches","scuba_snorkel","sailing_boating"],
      "mountain/alpine":["hiking_mountains","lakes"], "road_trip":["road_trip"],
    };
    function preGetUnservedDims(tripAbbr) {
      const tf = getAlignForTrip(tripAbbr);
      const allFlags = (g13.flags[tripAbbr] || []);
      const dims = [];
      for (const [dim, fns] of Object.entries(DIMS_CC)) {
        if (!g14.relevant[dim]) continue;
        if (!fns.some(fn => tf.includes(fn))) continue;
        const providers = g14.servingTrips[dim] || [];
        if (providers.length === 0) dims.push({ dim, providers: 0 });
      }
      if (allFlags.includes("friends_family")) {
        const t8ffCount = f1Result.top8.filter(t8 =>
          (g13.flags[t8] || []).includes("friends_family")).length;
        if (t8ffCount === 0) dims.push({ dim: "friends_family", providers: 0 });
      }
      return dims;
    }

    filteredCharts.forEach(c => {
      const { a, h, aTrip, hTrip } = c;
      const hAlignAll = getAlignForTrip(h);
      const aAlignAll = getAlignForTrip(a).filter(f => f !== "friends_family");
      const hUniqueF = hAlignAll.filter(f => !aAlignAll.includes(f));
      const aUniqueF = aAlignAll.filter(f => !hAlignAll.includes(f));
      const hCities = getEssentialCitiesForTrip(h);
      const aCities = getEssentialCitiesForTrip(a);
      const hBestRank = hCities.length > 0 ? Math.max(...hCities.map(ci => ci.includes("Top4") ? 3 : ci.includes("Top10") ? 2 : 1)) : 0;
      const aBestRank = aCities.length > 0 ? Math.max(...aCities.map(ci => ci.includes("Top4") ? 3 : ci.includes("Top10") ? 2 : 1)) : 0;
      const hUnserved = preGetUnservedDims(h);
      const aUnserved = preGetUnservedDims(a);
      const hNonRedundant = hUniqueF.filter(f => {
        return f1Result.top8.filter(t8 => t8 !== h && getAlignForTrip(t8).includes(f)).length < 3;
      });
      const aNonRedundant = aUniqueF.filter(f => {
        return f1Result.top8.filter(t8 => t8 !== a && getAlignForTrip(t8).includes(f)).length < 3;
      });

      // Challenger (a) has higher city + unserved dim, holder's only non-redundant advantage is tier
      if (aBestRank > hBestRank && aUnserved.length > 0 && hNonRedundant.length === 0 && aTrip.tier > hTrip.tier) {
        const holderPos = f1Result.top8.indexOf(h) + 1;
        hammerBindings.push({ a, h, challengerPos: saPairingBinding ? holderPos - 1 : holderPos });
      }
      // Holder (h) has higher city + unserved dim, challenger's only non-redundant advantage is tier
      else if (hBestRank > aBestRank && hUnserved.length > 0 && aNonRedundant.length === 0 && hTrip.tier > aTrip.tier) {
        // holder already on T8, no swap needed — hammer doesn't bind in this direction
      }
    });
  }

  // Suppress charts where hammer binding fires
  const hammerSuppressed = new Set(hammerBindings.map(b => `${b.a}|${b.h}`));
  filteredCharts = filteredCharts.filter(c => !hammerSuppressed.has(`${c.a}|${c.h}`));

  console.log();
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  CLOSE_CALL CHARTS — Next 5 vs Top 8");
  console.log("═══════════════════════════════════════════════════════════════");

  if (saPairingBinding) {
    const hiking = profile.hiking || 0;
    const backpacking = profile.backpacking || 0;
    const mountains = profile.landscapes?.mountains || 0;
    const outdoors = profile.outdoors || 0;
    console.log();
    console.log(`  SA Pairing BINDING: Peru + Patagonia. Traveler qualifies (hiking ${hiking}/5≥4, backpacking ${backpacking}/5≥4, mountains ${mountains}/10≥7, outdoors ${outdoors}/10≥8). Patagonia replaces B&A on T8. B&A to Next 5. No close-call evaluation ALLOWED.`);
    console.log(`  SA Pairing placement: Patagonia LOCKED at last T8 position regardless of hierarchy.`);
    console.log(`  Function 15: Patagonia position is LOCKED at last T8 slot. Do not evaluate Patagonia in adjacent pair hierarchy checks.`);
  }

  hammerBindings.forEach(({ a, h, challengerPos }) => {
    console.log();
    console.log(`  BINDING: ${a} replaces ${h} on T8. ${h} to Next 5. No evaluation ALLOWED.`);
    console.log(`  ${a} placement: T8#${challengerPos}. LOCKED.`);
    console.log(`  Function 15: ${a} position is LOCKED. Do not evaluate ${a} in adjacent pair hierarchy checks.`);
  });

  filteredCharts.forEach(({ a, h, aTrip, hTrip, aCat, hCat, alignFlags, discFlags,
                     challengerYP, holderYP }) => {
    const pos = `T8#${f1Result.top8.indexOf(h)+1}`;
    const n5pos = `N5#${f1Result.next5.indexOf(a)+9}`;
    const hAlign = getAlignForTrip(h);
    const hDisc = getDiscForTrip(h);

    console.log();
    console.log(`  ⚡ CLOSE_CALL: ${a} (${n5pos}) vs ${h} (${pos})`);
    console.log(`  ┌──────────────────────────────┬──────────────────────────────┐`);
    console.log(`  │  HOLDER: ${(h + " ").padEnd(20)}│  CHALLENGER: ${(a + " ").padEnd(16)}│`);
    console.log(`  ├──────────────────────────────┼──────────────────────────────┤`);

    console.log(`  │  Exp: ${hCat.padEnd(23)}│  Exp: ${aCat.padEnd(23)}│`);

    const hPrior = priorExpDesc(hTrip);
    const aPrior = priorExpDesc(aTrip);
    console.log(`  │  Prior: ${hPrior.substring(0,21).padEnd(21)}│  Prior: ${aPrior.substring(0,21).padEnd(21)}│`);
    if (hPrior.length > 21) console.log(`  │    ${hPrior.substring(21).padEnd(25)}│${" ".repeat(31)}│`);
    if (aPrior.length > 21) console.log(`  │${" ".repeat(31)}│    ${aPrior.substring(21).padEnd(25)}│`);

    // Door analysis: only when Prior status is asymmetric
    const hPriorLabel = hPrior.split("—")[0].trim();
    const aPriorLabel = aPrior.split("—")[0].trim();
    if (hPriorLabel !== aPriorLabel) {
      const newTrip = (aPriorLabel === "NEW" || aPriorLabel === "Light") ? { abbr: a, obj: aTrip } : { abbr: h, obj: hTrip };
      const famTrip = (newTrip.abbr === a) ? { abbr: h, obj: hTrip } : { abbr: a, obj: aTrip };
      const newCat = newTrip.obj.expCategory;
      const famCat = famTrip.obj.expCategory;
      const newPriorCount = countriesByCategory[newCat]?.length || 0;
      const famPriorCount = countriesByCategory[famCat]?.length || 0;
      const newAlignFlags = getAlignForTrip(newTrip.abbr).filter(f => f !== "friends_family");
      const newMaxAligned = newAlignFlags.filter(f => maxRatedFlags.has(f));
      const famAlignFlags = getAlignForTrip(famTrip.abbr).filter(f => f !== "friends_family");
      const famRedundant = famAlignFlags.filter(flag => {
        const othersServing = f1Result.top8.filter(t8 => t8 !== famTrip.abbr && getAlignForTrip(t8).includes(flag)).length;
        return othersServing >= 3;
      });
      console.log(`  │  Door analysis:`);
      console.log(`  │    ${aPriorLabel === "NEW" || aPriorLabel === "Light" ? aPriorLabel : hPriorLabel}: ${newTrip.abbr} delivers ${newCat} — traveler has ${newPriorCount} prior ${newCat} trips.`);
      console.log(`  │         Alignment to max-rated: ${newMaxAligned.length > 0 ? newMaxAligned.join(", ") : "(none)"}`);
      console.log(`  │    SIMILAR: ${famTrip.abbr} delivers ${famCat} — traveler has ${famPriorCount} prior ${famCat} trips.`);
      console.log(`  │         Redundant on T8: ${famRedundant.length > 0 ? famRedundant.join(", ") : "(none)"}`);

      // Discovery presumption
      if (aPriorLabel === "NEW" || hPriorLabel === "NEW") {
        if (newPriorCount === 0 && famPriorCount >= 4 && newMaxAligned.length >= 2) {
          console.log(`  │  Discovery presumption ACTIVE: ${newTrip.abbr} opens new ${newCat} door (0 prior) with ${newMaxAligned.length} max-rated alignment flags.`);
          console.log(`  │  Tier and essential cities do not overcome this presumption alone.`);
          console.log(`  │  ${famTrip.abbr} must justify on genuinely differentiated value.`);
        }
      }
    }

    const hAlignStr = hAlign.join(", ") || "none";
    const aAlignStr = alignFlags.join(", ") || "none";
    console.log(`  │  Align: ${hAlignStr.substring(0,21).padEnd(21)}│  Align: ${aAlignStr.substring(0,21).padEnd(21)}│`);
    if (hAlignStr.length > 21) console.log(`  │    ${hAlignStr.substring(21).padEnd(25)}│${" ".repeat(31)}│`);
    if (aAlignStr.length > 21) console.log(`  │${" ".repeat(31)}│    ${aAlignStr.substring(21).padEnd(25)}│`);

    const hDiscStr = hDisc.join(", ") || "none";
    const aDiscStr = discFlags.join(", ") || "none";
    console.log(`  │  Disc: ${hDiscStr.padEnd(22)}│  Disc: ${aDiscStr.padEnd(22)}│`);

    console.log(`  │  YP: ${holderYP.padEnd(24)}│  YP: ${challengerYP.padEnd(24)}│`);

    if (hCat === aCat) {
      const hEC = getEssentialCitiesForTrip(h).join(", ") || "none";
      const aEC = getEssentialCitiesForTrip(a).join(", ") || "none";
      console.log(`  │  Cities: ${hEC.substring(0,20).padEnd(20)}│  Cities: ${aEC.substring(0,20).padEnd(20)}│`);
    }

    console.log(`  │  F/F: ${getFFForTrip(hTrip).padEnd(23)}│  F/F: ${getFFForTrip(aTrip).padEnd(23)}│`);

    console.log(`  │  T${hTrip.tier} ${hTrip.region.padEnd(24)}│  T${aTrip.tier} ${aTrip.region.padEnd(24)}│`);

    const hSpine = `${hTrip.spineCountries.join(",")} (${getSpineStatusForTrip(hTrip)})`;
    const aSpine = `${aTrip.spineCountries.join(",")} (${getSpineStatusForTrip(aTrip)})`;
    console.log(`  │  Spine: ${hSpine.substring(0,21).padEnd(21)}│  Spine: ${aSpine.substring(0,21).padEnd(21)}│`);

    console.log(`  │  Lang: ${String(getLangScore(h)).padEnd(23)}│  Lang: ${String(getLangScore(a)).padEnd(23)}│`);

    console.log(`  └──────────────────────────────┴──────────────────────────────┘`);

    // Cancellation block
    const hAlignAll = getAlignForTrip(h);
    const aAlignAll = getAlignForTrip(a).filter(f => f !== "friends_family");
    const sharedFlags = hAlignAll.filter(f => aAlignAll.includes(f));
    const sharedStructural = [];
    if (challengerYP === holderYP && challengerYP !== "none") sharedStructural.push(`both ${challengerYP} YP`);
    const hSpineStatus = getSpineStatusForTrip(hTrip);
    const aSpineStatus = getSpineStatusForTrip(aTrip);
    if (hSpineStatus === aSpineStatus) sharedStructural.push(`both ${hSpineStatus} spine`);
    const hContStatus = g4.touchedRegions.includes(hTrip.region) ? "touched" : "untouched";
    const aContStatus = g4.touchedRegions.includes(aTrip.region) ? "touched" : "untouched";
    if (hContStatus === aContStatus) sharedStructural.push(`both ${hContStatus} continent`);
    const sharedAll = [...sharedFlags, ...sharedStructural];

    const hUniqueFlags = hAlignAll.filter(f => !aAlignAll.includes(f));
    const aUniqueFlags = aAlignAll.filter(f => !hAlignAll.includes(f));

    const FLAG_CONTEXT = {
      "B&A":            { wildlife: "Pantanal jaguars", foodie: "Buenos Aires steakhouses", gardens: "Buenos Aires parks" },
      "Patagonia":      { hiking_mountains: "Torres del Paine", camping_backpacking: "El Chaltén circuits", fishing: "Río Grande fly-fishing" },
      "Greece":         { foodie: "Athens tavernas", beaches: "Cycladic beaches", history: "Acropolis, Delphi" },
      "Scandinavia":    { hiking_mountains: "Norwegian fjords", art: "Stockholm museums", lakes: "Swedish lake country", train_preference: "Bergen Railway", gardens: "Keukenhof, Vigeland" },
      "ISE":            { performing_arts: "West End theatre", art: "National Gallery, Tate", lakes: "Lake District", history: "Oxford, Edinburgh Castle", train_preference: "UK rail network", gardens: "Kew, Powerscourt" },
      "CA":             { performing_arts: "Tokyo kabuki, Seoul K-culture", foodie: "Tokyo/Osaka cuisine", history: "Kyoto temples", train_preference: "JR bullet trains", gardens: "Kyoto gardens" },
      "CAf":            { wildlife: "Kruger, Okavango", hiking_mountains: "Table Mountain", beaches: "Clifton, Camps Bay", vineyards_wine: "Stellenbosch", gardens: "Kirstenbosch" },
      "NZ":             { hiking_mountains: "Milford Track", camping_backpacking: "Great Walks", lakes: "Queenstown lakes", fishing: "Taupō trout" },
      "Peru":           { hiking_mountains: "Inca Trail", foodie: "Lima ceviche", lakes: "Lake Titicaca", history: "Machu Picchu" },
      "SE Asia":        { foodie: "Bangkok street food", beaches: "Thai islands", history: "Angkor Wat" },
      "Eastern Europe": { performing_arts: "Berlin/Vienna concerts", art: "Vienna/Prague galleries", history: "Prague, Budapest", train_preference: "Central European rail", gardens: "Vienna Schönbrunn" },
      "France South":   { hiking_mountains: "Pyrenees", art: "Nice/Marseille galleries", foodie: "Provençal cuisine", vineyards_wine: "Bordeaux, Rhône" },
      "Portugal":       { beaches: "Algarve coast", vineyards_wine: "Douro Valley", gardens: "Sintra gardens" },
      "Australia":      { beaches: "Bondi, Manly", vineyards_wine: "Barossa Valley", gardens: "Sydney Botanic" },
      "India North":    { wildlife: "Ranthambore tigers", history: "Taj Mahal, Jaipur", train_preference: "Rajasthan rail" },
      "Tanzania":       { wildlife: "Serengeti migration", hiking_mountains: "Kilimanjaro", camping_backpacking: "Ngorongoro camping" },
    };

    function formatUniqueFlags(tripAbbr, flags) {
      return flags.map(flag => {
        const context = (FLAG_CONTEXT[tripAbbr] && FLAG_CONTEXT[tripAbbr][flag]) || "";
        const othersServing = f1Result.top8.filter(t8 => t8 !== tripAbbr && getAlignForTrip(t8).includes(flag)).length;
        let s = context ? `${flag}: ${context}` : flag;
        if (othersServing >= 3) s += ` (redundant on T8 — ${othersServing} providers)`;
        return s;
      }).join(", ");
    }

    console.log(`  Cancellation:`);
    console.log(`    Shared (cancel): ${sharedAll.length > 0 ? sharedAll.join(", ") : "(none)"}`);
    console.log(`    ${h} unique: ${hUniqueFlags.length > 0 ? formatUniqueFlags(h, hUniqueFlags) : "(none)"}`);
    console.log(`    ${a} unique: ${aUniqueFlags.length > 0 ? formatUniqueFlags(a, aUniqueFlags) : "(none)"}`);

    // SA Pairing — non-qualifying only (skip if Gate 15 already handled)
    if (!saPairingHandledByGate15 && !saPairingBinding && ((a === "Patagonia" && h === "B&A") || (a === "B&A" && h === "Patagonia"))) {
      if (f1Result.top8.includes("Peru")) {
        const hiking = profile.hiking || 0;
        const backpacking = profile.backpacking || 0;
        const mountains = profile.landscapes?.mountains || 0;
        const outdoors = profile.outdoors || 0;
        console.log(`  SA Pairing: Peru + B&A (traveler does not qualify — hiking ${hiking}/5, backpacking ${backpacking}/5, mountains ${mountains}/10, outdoors ${outdoors}/10)`);
      }
    }

    console.log(`  → AIQC evaluate which trip deserves this slot.`);
  });
}

// ═══════════════════════════════════════════════════════════════════
// CONSOLIDATED TRIP PROFILES
// ═══════════════════════════════════════════════════════════════════

function printConsolidatedTripProfiles(profile, f1Result) {
  const g1  = f1Result.gates.g1;
  const g3  = f1Result.gates.g3;
  const g4  = f1Result.gates.g4;
  const g6  = f1Result.gates.g6;
  const g9  = f1Result.gates.g9;
  const g10 = f1Result.gates.g10;
  const g12 = f1Result.gates.g12;
  const g13 = f1Result.gates.g13;
  const g15 = f1Result.gates.g15;

  // fear_heights in disclosure list.
  const DISCLOSURE_FLAGS = ["fear_snakes","fear_heights","left_side_driving","right_side_driving"];

  const visitedCities = new Set([
    ...(profile.visitedCECities || []),
    ...(profile.visitedCACities || []),
    ...(profile.visitedCAfCities || []),
    ...(profile.visitedCCCities || []),
  ]);

  function getUnvisitedEssentialCities(tripAbbr) {
    const cities = [];
    for (const [city, trips] of Object.entries(ESSENTIAL_CITIES)) {
      if (trips.includes(tripAbbr) && !visitedCities.has(city)) {
        const rank = ["London","Paris","New York","Tokyo"].includes(city) ? "Top4" :
          ["San Francisco","Washington DC","Madrid","Rome","Amsterdam","Sydney"].includes(city) ? "Top10" : "Top25";
        cities.push(`${city} (${rank})`);
      }
    }
    return cities;
  }

  function getFriendsFamily(trip) {
    const ff = (profile.friendsFamilyCountries || []);
    if (ff.length === 0) return "none";
    const overlap = ff.filter(c => trip.spineCountries.some(sc => countriesMatch(sc, c)));
    return overlap.length > 0 ? overlap.join(", ") : "none";
  }

  function getSpineStatus(trip) {
    const visited = trip.spineCountries.filter(sc => countryInList(sc, profile.visitedCountries || []));
    if (visited.length === 0) return "unvisited";
    if (visited.length === trip.spineCountries.length) return "visited";
    return "mixed";
  }

  function getTouchedStatus(trip) {
    if (trip.type === "SD_OB" || trip.type === "ExoticIsland") {
      const st = (g4.tripStatuses[trip.abbr] || "").split("|")[0];
      return st.includes("TOUCHED") ? "touched" : "untouched";
    }
    return g4.touchedRegions.includes(trip.region) ? "touched" : "untouched";
  }

  function getStatus(trip) {
    const a = trip.abbr;
    const t8idx = f1Result.top8.indexOf(a);
    if (t8idx !== -1) return `Top 8 #${t8idx + 1}`;
    const n5idx = f1Result.next5.indexOf(a);
    if (n5idx !== -1) return `Next 5 #${n5idx + 9}`;

    if (g1.excluded.includes(a)) {
      const reason = g1.log.find(l => l.startsWith(a + ":"));
      return `excluded (${reason ? reason.split("—")[1]?.trim() || "G1" : "G1"})`;
    }
    if (g3.results[a] === "ELIMINATED") {
      return "eliminated (G3 — spine visited)";
    }
    if (g9.applies && g9.hardExcluded.includes(a)) {
      return "excluded (G9 — virgin hard exclude)";
    }

    const region = trip.region;
    const capUsed = g15.regionCounts[region] || 0;
    const cap = g6.caps[region] || 2;
    if (capUsed >= cap) {
      return `cap-dropped (${region} ${capUsed}/${cap})`;
    }

    if (a === "Tanzania" && f1Result.top8.includes("CAf") && !f1Result.top8.includes(a) && !f1Result.next5.includes(a)) {
      return "deferred (Tanzania sequencing rule)";
    }

    return "not placed";
  }

  function getYP(tripAbbr) {
    if (!g10.ypActive) return "none (age 30+)";
    if (PRIMARY_YP.includes(tripAbbr)) return "Primary";
    if (SECONDARY_YP.includes(tripAbbr)) return "Secondary";
    return "none";
  }

  function printTrip(trip) {
    const a = trip.abbr;
    const fl = g13.flags[a] || [];
    const align = fl.filter(f => !DISCLOSURE_FLAGS.includes(f));
    const disc = filterDrivingDisclosures(fl.filter(f => DISCLOSURE_FLAGS.includes(f)), profile);
    const essentials = getUnvisitedEssentialCities(a);
    const spineStatus = getSpineStatus(trip);
    const touchedStatus = getTouchedStatus(trip);

    console.log(`  ${a}:`);
    console.log(`    Alignment: ${align.join(", ") || "none"}`);
    console.log(`    Disclosures: ${disc.join(", ") || "none"}`);
    console.log(`    YP: ${getYP(a)}`);
    console.log(`    Essential Cities: ${essentials.length > 0 ? essentials.join(", ") : "none"}`);
    console.log(`    Friends/Family: ${getFriendsFamily(trip)}`);
    console.log(`    Tier: ${trip.type === "Big4" ? "B4" : trip.tier}`);
    const typeTags = [trip.expCategory];
    if (trip.wildlifeCore) typeTags.push("wildlifeCore");
    console.log(`    Type: ${trip.type} (${typeTags.join(", ")})`);
    console.log(`    Region: ${trip.region} (${touchedStatus})`);
    console.log(`    Spine Countries: ${trip.spineCountries.join(", ")} (${spineStatus})`);
    console.log(`    Status: ${getStatus(trip)}`);
    console.log(`    Language Score: ${g12.scores[a] || 0}`);
    console.log();
  }

  console.log();
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  CONSOLIDATED TRIP PROFILES");
  console.log("═══════════════════════════════════════════════════════════════");

  console.log("\n  ─── TOP 8 ───────────────────────────────────────────────");
  f1Result.top8.forEach(a => {
    const trip = findTrip(a);
    if (trip) printTrip(trip);
  });

  console.log("  ─── NEXT 5 ──────────────────────────────────────────────");
  f1Result.next5.forEach(a => {
    const trip = findTrip(a);
    if (trip) printTrip(trip);
  });

  const placed = new Set([...f1Result.top8, ...f1Result.next5]);
  const remaining = TRIPS.filter(t => !placed.has(t.abbr))
    .sort((a, b) => a.abbr.localeCompare(b.abbr));

  console.log("  ─── REMAINING ───────────────────────────────────────────");
  remaining.forEach(trip => printTrip(trip));
}

// ── Summary Table ────────────────────────────────────────────────

function printSummaryTable(profile, f1Result) {
  const g10 = f1Result.gates.g10;
  const g13 = f1Result.gates.g13;

  // fear_heights in disclosure list.
  const DISCLOSURE_FLAGS = ["fear_snakes","fear_heights","left_side_driving","right_side_driving"];

  const visitedCities = new Set([
    ...(profile.visitedCECities || []),
    ...(profile.visitedCACities || []),
    ...(profile.visitedCAfCities || []),
    ...(profile.visitedCCCities || []),
  ]);

  function getYP(tripAbbr) {
    if (!g10.ypActive) return "—";
    if (PRIMARY_YP.includes(tripAbbr)) return "Primary";
    if (SECONDARY_YP.includes(tripAbbr)) return "Secondary";
    return "—";
  }

  function getUnvisitedEssentialCities(tripAbbr) {
    const cities = [];
    for (const [city, trips] of Object.entries(ESSENTIAL_CITIES)) {
      if (trips.includes(tripAbbr) && !visitedCities.has(city)) {
        const rank = ["London","Paris","New York","Tokyo"].includes(city) ? "Top4" :
          ["San Francisco","Washington DC","Madrid","Rome","Amsterdam","Sydney"].includes(city) ? "Top10" : "Top25";
        cities.push(`${city}(${rank})`);
      }
    }
    return cities.join(", ") || "—";
  }

  function getFF(trip) {
    const pff = profile.friendsFamilyCountries || [];
    if (pff.length === 0) return "—";
    const overlap = pff.filter(c => trip.spineCountries.some(sc => countriesMatch(sc, c)));
    return overlap.length > 0 ? overlap.join(", ") : "—";
  }

  const rows = [];
  f1Result.top8.forEach((a, i) => {
    const trip = findTrip(a);
    if (!trip) return;
    const fl = g13.flags[a] || [];
    const align = fl.filter(f => !DISCLOSURE_FLAGS.includes(f)).join(", ") || "—";
    rows.push({
      pos: `T8#${i+1}`,
      name: a,
      align,
      yp: getYP(a),
      cities: getUnvisitedEssentialCities(a),
      ff: getFF(trip),
      tier: trip.type === "Big4" ? "B4" : `T${trip.tier}`,
      region: trip.region,
    });
  });
  f1Result.next5.forEach((a, i) => {
    const trip = findTrip(a);
    if (!trip) return;
    const fl = g13.flags[a] || [];
    const align = fl.filter(f => !DISCLOSURE_FLAGS.includes(f)).join(", ") || "—";
    rows.push({
      pos: `N5#${i+9}`,
      name: a,
      align,
      yp: getYP(a),
      cities: getUnvisitedEssentialCities(a),
      ff: getFF(trip),
      tier: trip.type === "Big4" ? "B4" : `T${trip.tier}`,
      region: trip.region,
    });
  });

  const ALIGN_WRAP = 45;
  function wrapText(text, maxWidth) {
    if (text.length <= maxWidth) return [text];
    const lines = [];
    let remaining = text;
    while (remaining.length > maxWidth) {
      let breakAt = remaining.lastIndexOf(", ", maxWidth);
      if (breakAt <= 0) breakAt = maxWidth;
      else breakAt += 2;
      lines.push(remaining.substring(0, breakAt));
      remaining = remaining.substring(breakAt);
    }
    if (remaining.length > 0) lines.push(remaining);
    return lines;
  }

  const cols = {
    pos:    { hdr: "Pos",     min: 5 },
    name:   { hdr: "Trip",    min: 4 },
    align:  { hdr: "Alignment Flags", min: 15 },
    yp:     { hdr: "YP",      min: 9 },
    cities: { hdr: "Essential Cities", min: 16 },
    ff:     { hdr: "F/F",     min: 3 },
    tier:   { hdr: "Tier",    min: 4 },
    region: { hdr: "Region",  min: 6 },
  };

  for (const key of Object.keys(cols)) {
    let maxW = Math.max(cols[key].hdr.length, cols[key].min);
    rows.forEach(r => {
      const val = r[key] || "";
      const w = key === "align" ? Math.min(val.length, ALIGN_WRAP) : val.length;
      if (w > maxW) maxW = w;
    });
    cols[key].w = maxW;
  }

  const colOrder = ["pos","name","align","yp","cities","ff","tier","region"];

  function fmtRow(values) {
    return "  │ " + colOrder.map(k => (values[k] || "").padEnd(cols[k].w)).join(" │ ") + " │";
  }

  const sep = "  ├─" + colOrder.map(k => "─".repeat(cols[k].w)).join("─┼─") + "─┤";
  const topBorder = "  ┌─" + colOrder.map(k => "─".repeat(cols[k].w)).join("─┬─") + "─┐";
  const botBorder = "  └─" + colOrder.map(k => "─".repeat(cols[k].w)).join("─┴─") + "─┘";
  const midSep = "  ├═" + colOrder.map(k => "═".repeat(cols[k].w)).join("═╪═") + "═┤";

  console.log();
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("  SUMMARY TABLE — Top 8 + Next 5");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log();

  const hdrVals = {};
  colOrder.forEach(k => hdrVals[k] = cols[k].hdr);
  console.log(topBorder);
  console.log(fmtRow(hdrVals));
  console.log(sep);

  let printedT8 = false;
  rows.forEach((row, idx) => {
    if (!printedT8 && row.pos.startsWith("N5")) {
      console.log(midSep);
      printedT8 = true;
    }

    const alignLines = wrapText(row.align, ALIGN_WRAP);
    const firstLine = { ...row, align: alignLines[0] };
    console.log(fmtRow(firstLine));
    for (let li = 1; li < alignLines.length; li++) {
      const contLine = {};
      colOrder.forEach(k => contLine[k] = "");
      contLine.align = alignLines[li];
      console.log(fmtRow(contLine));
    }
  });

  console.log(botBorder);
}


// ═══════════════════════════════════════════════════════════════════
// PROFILE SCHEMA (reference)
// ═══════════════════════════════════════════════════════════════════
//
// {
//   // Gate 1
//   residenceCountries: string[],
//   livedInCalifornia: boolean,
//   livedInEurope: boolean,
//   livedInSSA: boolean,
//   livedInJapanOrKorea: boolean,
//   isUSResident: boolean,
//
//   // Gate 2 & 3
//   homeCountry: string,
//   residenceRegion: string,
//   residenceCity: string,     // v2.26 Patch 13: optional, surfaces in printProfileHeader
//   visitedCountries: string[],
//   visitedCECities: string[],
//   visitedCACities: string[],
//   visitedCAfCities: string[],
//   visitedCCCities: string[],
//
//   // Gate 10, 10B
//   age: number,
//   fitness: number,  // 0-10
//
//   // Gate 11
//   completedPBCount: number,
//   completedYPCount: number,
//
//   // Gate 12
//   languages: [{ lang: string, level: "native"|"proficient"|"little bit" }],
//
//   // Gate 13
//   landscapes: {
//     beaches: number, mountains: number, lakes: number,
//     forests: number, vineyards: number, wildlife: number,
//     rainforests: number, deserts: number,
//   },
//   hiking: number,          // 0-5
//   camping: number,         // 0-5
//   backpacking: number,     // 0-5
//   snorkeling: number,      // 0-5
//   scuba: number,           // 0-5
//   sailing: number,         // 0-5
//   paddleboard: number,     // 0-5
//   windKite: number,        // 0-5
//   kayaking: number,        // 0-5
//   surfing: number,         // 0-5
//   fishing: number,         // 0-5
//   golf: number,            // 0-5
//   wildlife_interest: number, // 0-10
//   performing_arts: number,   // 0-10
//   art: number,               // 0-5
//   history_rating: number,    // 0-5
//   extrovert: number,         // 0-10
//   foodie: boolean,
//   roadTrip: "love" | "enjoy" | string,
//   trainPref: "train" | "both" | "car",
//   fearSnakes: boolean,
//   fearHeights: boolean,    // v2.25: AIQC disclosure flag
//   friendsFamilyCountries: string[],
// }


// ═══════════════════════════════════════════════════════════════════
// EXPORTS (v2.36)
// ═══════════════════════════════════════════════════════════════════

module.exports = {
  runF1,
  runF2,
  printProfileHeader,
  printF2CloseCallCharts,
  printBalancingTest,
  printF2GateFooter,
  printAustraliaComparison,
  printAdaptExtendReport,
  printCapDropped,
  printCloseCallCharts,
  printConsolidatedTripProfiles,
  printSummaryTable,
  findTrip,
  PRIMARY_YP,
  SECONDARY_YP,
};
