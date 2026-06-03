// lib/profileTransformer.js
// Converts Typeform webhook JSON → AL engine profile object

/**
 * Transform a Typeform webhook response into an AL profile.
 * @param {object} webhookJson - The full webhook JSON (or just form_response)
 * @returns {object} Profile object matching AL engine schema
 */
function transformToProfile(webhookJson) {
  const formResponse = webhookJson.form_response || webhookJson;
  const answers = formResponse.answers || [];

  // Build answer lookup by field ID
  const answerMap = {};
  answers.forEach((a) => {
    answerMap[a.field.id] = a;
  });

  // Helpers
  const getNumber = (fieldId) => {
    const a = answerMap[fieldId];
    if (!a) return 0;
    if (a.type === "number") return a.number || 0;
    if (a.type === "text") return parseFloat(a.text) || 0;
    return 0;
  };

  const getText = (fieldId) => {
    const a = answerMap[fieldId];
    if (!a) return "";
    if (a.type === "text") return a.text || "";
    if (a.type === "number") return String(a.number || "");
    if (a.type === "choice") return a.choice?.label || "";
    return "";
  };

  const getChoiceLabel = (fieldId) => {
    const a = answerMap[fieldId];
    if (!a || a.type !== "choice") return "";
    return a.choice?.label || "";
  };

  const getMatrixText = (fieldId) => {
    const a = answerMap[fieldId];
    if (!a) return "";
    if (a.type === "text") return a.text || "";
    return "";
  };

  // ── Parse matrix into { itemName: rating } map ──
  function parseMatrix(fieldId, knownItems) {
    const text = getMatrixText(fieldId);
    if (!text) return {};

    const result = {};

    // Use known item names as anchors (longest first to avoid partial matches)
    const sorted = [...knownItems].sort((a, b) => b.length - a.length);
    let remaining = text;

    sorted.forEach((item) => {
      const idx = remaining.toLowerCase().indexOf(item.toLowerCase());
      if (idx !== -1) {
        const afterItem = remaining.substring(idx + item.length);
        const numMatch = afterItem.match(/^\s*(\d+)/);
        if (numMatch) {
          result[item] = parseInt(numMatch[1], 10);
        }
      }
    });

    return result;
  }

  // ── Parse landscape matrix (0-10 scale) ──
  const landscapeItems = [
    "Beaches, coastlines, oceans",
    "Mountains",
    "Lakes, rivers, waterfalls",
    "Forests",
    "Vineyards, wine regions",
    "Wildlife habitat",
    "Rainforests",
    "Deserts",
  ];
  const landscapes = parseMatrix("XmikHcnAic72", landscapeItems);

  // ── Parse exercise matrix ──
  const exerciseItems = [
    "Walking, Hiking",
    "Running",
    "Cycling (2E)",
    "Swimming",
    "Gym/Weight Training",
    "Rowing",
    "Yoga",
    "Martial Arts",
  ];
  const exercise = parseMatrix("4Y82MbNwQOv3", exerciseItems);

  // ── Parse outdoor activities 1 ──
  const outdoor1Items = [
    "Cycling (2E)",
    "Picnics",
    "Horseback Riding",
    "Birding",
    "Sailing",
    "Motorboating",
    "Paddleboarding",
    "Windsurfing, Kitesurfing",
    "Scuba Diving",
    "Snorkeling",
    "Ice Skating",
    "Kite Flying",
  ];
  const outdoor1 = parseMatrix("RGqk0WRelI7e", outdoor1Items);

  // ── Parse outdoor activities 2 ──
  const outdoor2Items = [
    "Trail Running",
    "Mountain Biking",
    "Camping",
    "Hiking/Trekking",
    "Backpacking (Trekking with Camping)",
    "Fishing/Fly Fishing",
    "Kayaking, Canoeing",
    "Rafting",
    "Skiing, Snowboarding",
    "XC Skiing",
    "Nature Photography",
    "Landscape Painting/Drawing",
  ];
  const outdoor2 = parseMatrix("d7NrWkACycGW", outdoor2Items);

  // ── Parse performing arts ──
  const perfArtsItems = ["Theater", "Ballet", "Opera", "Symphony"];
  const perfArts = parseMatrix("TLNebk3UxIjN", perfArtsItems);

  // ── Parse watching sports ──
  const watchSportsItems = [
    "Soccer",
    "Basketball",
    "Tennis",
    "Golf",
    "Motorsports: F1, NASCAR",
    "Football",
    "Baseball",
    "Ice Hockey",
    "Boxing",
    "Summer Olympics",
    "Winter Olympics",
    "Cricket",
    "Rugby",
  ];
  const watchSports = parseMatrix("qtv5pdVj4g2j", watchSportsItems);

  // ── Parse passions matrix ──
  const passionItems = [
    "Historic Trains",
    "Historic Airplanes",
    "Classic Cars",
    "Theme Parks, e.g., Disneyland",
    "Photography",
    "Art",
    "Cooking",
    "Gardens",
    "Painting",
    "Reading",
    "Listening to Music",
  ];
  const passions = parseMatrix("r38BMM1QIoVW", passionItems);

  // ── Parse learning matrix ──
  const learningItems = [
    "History",
    "Archaeology",
    "Architecture",
    "Geography",
    "Political Science, International Relations",
    "Economics and Business",
    "Literature",
    "Foreign Languages",
    "Mathematics",
    "Science",
    "Engineering",
    "Technology",
  ];
  const learning = parseMatrix("wEpXrngXNA2V", learningItems);

  // ── Parse languages ──
  const LANG_LEVEL_MAP = {
    "native": "native",
    "fluent": "proficient",  // engine only knows native/proficient/little bit
    "proficient": "proficient",
    "little bit": "little bit",
  };

  function parseLanguages(fieldId) {
    const text = getMatrixText(fieldId);
    if (!text) return [];

    const langs = [];
    const langNames = [
      "English", "Spanish", "French", "Mandarin", "Japanese",
      "Korean", "German", "Italian", "Portuguese", "Vietnamese",
    ];
    const levels = ["Native", "Fluent", "Proficient", "Little Bit"];

    // Try to parse "Language Level" pairs
    langNames.forEach((lang) => {
      levels.forEach((level) => {
        const pattern = `${lang} ${level}`;
        if (text.toLowerCase().includes(pattern.toLowerCase())) {
          langs.push({
            lang,
            level: LANG_LEVEL_MAP[level.toLowerCase()] || level.toLowerCase(),
          });
        }
      });
    });

    return langs;
  }

  // Also parse overflow languages (s4xOmObgOe6A)
  function parseOverflowLanguages(fieldId) {
    const text = getText(fieldId);
    if (!text || text.toLowerCase() === "na") return [];

    const langs = [];
    // Format: "Tamil, little bit" or "Arabic, fluent"
    const lines = text.split(/\n|;/).map((l) => l.trim()).filter((l) => l.length > 0);

    lines.forEach((line) => {
      const parts = line.split(",").map((p) => p.trim());
      if (parts.length >= 2) {
        const lang = parts[0];
        const levelRaw = parts.slice(1).join(",").trim().toLowerCase();
        const level = LANG_LEVEL_MAP[levelRaw] || levelRaw;
        if (lang && level) {
          langs.push({ lang, level });
        }
      }
    });

    return langs;
  }

  const mainLanguages = parseLanguages("kjjYJnA6LPji");
  const overflowLanguages = parseOverflowLanguages("s4xOmObgOe6A");
  const allLanguages = [...mainLanguages, ...overflowLanguages];


  // ── Parse visited countries ──
  function parseCountryList(fieldId) {
    const label = getChoiceLabel(fieldId);
    if (!label) return [];

    // Known country names from the form definition choices
    const KNOWN_COUNTRIES = {
      "acJ9V5yo65xF": [ // Europe
        "Italy", "United Kingdom", "France", "Switzerland", "Austria",
        "Germany", "Spain", "Netherlands", "Ireland", "Greece",
        "Portugal", "Belgium", "Croatia", "Sweden", "Denmark", "Norway",
      ],
      "08Ma6ZcRdeZH": [ // Asia
        "Japan", "Vietnam", "Thailand", "Turkey", "India", "China",
        "South Korea", "Singapore", "Indonesia", "Israel", "Jordan",
        "Cambodia", "Taiwan",
      ],
      "RhjlLeCbiQk8": [ // Africa
        "Tanzania", "Kenya", "South Africa", "Egypt", "Morocco",
        "Botswana", "Rwanda", "Zimbabwe", "Seychelles", "Madagascar",
      ],
      "offbI97Ont1O": [ // North America
        "United States", "Canada", "Mexico", "Costa Rica", "Puerto Rico",
      ],
      "PQrPzH66lwmT": [ // South America
        "Peru", "Chile", "Argentina", "Brazil", "Galápagos Islands",
      ],
      "S8t2fgFcSU2M": [ // Oceania
        "Australia", "New Zealand", "French Polynesia", "Cook Islands", "Fiji",
      ],
    };

    const knownForField = KNOWN_COUNTRIES[fieldId] || [];
    const matched = [];

    // Match longest names first
    const sorted = [...knownForField].sort((a, b) => b.length - a.length);
    let remaining = label;

    sorted.forEach((country) => {
      if (remaining.toLowerCase().includes(country.toLowerCase())) {
        matched.push(country);
        remaining = remaining
          .toLowerCase()
          .replace(country.toLowerCase(), "")
          .trim();
      }
    });

    return matched;
  }

  const europeCountries = parseCountryList("acJ9V5yo65xF");
  const asiaCountries = parseCountryList("08Ma6ZcRdeZH");
  const africaCountries = parseCountryList("RhjlLeCbiQk8");
  const naCountries = parseCountryList("offbI97Ont1O");
  const saCountries = parseCountryList("PQrPzH66lwmT");
  const oceaniaCountries = parseCountryList("S8t2fgFcSU2M");

  const visitedCountries = [
    ...europeCountries,
    ...asiaCountries,
    ...africaCountries,
    ...naCountries,
    ...saCountries,
    ...oceaniaCountries,
  ];

  // ── Parse Italy places visited ──
  function parseItalyPlaces(fieldId) {
    const label = getChoiceLabel(fieldId);
    if (!label) return [];

    const PLACES = [
      "Rome", "Venice", "Florence", "Tuscany",
      "Cinque Terre/Italian Riviera", "Amalfi Coast", "Milan",
      "Lake region (Lake Como, Maggiore, etc.)", "Dolomites",
      "Sicily", "Puglia", "Sardinia",
    ];

    // "All of these" means everything
    if (label.toLowerCase().includes("all of these")) {
      return PLACES;
    }

    const matched = [];
    const sorted = [...PLACES].sort((a, b) => b.length - a.length);
    let remaining = label;

    sorted.forEach((place) => {
      if (remaining.toLowerCase().includes(place.toLowerCase())) {
        matched.push(place);
        remaining = remaining.toLowerCase().replace(place.toLowerCase(), "");
      }
    });

    return matched;
  }

  const italyPlaces = parseItalyPlaces("Y0ulFDtBAbRP");

  // ── Parse US cities ──
  function parseUSCities(fieldId) {
    const label = getChoiceLabel(fieldId);
    if (!label) return [];

    const CITIES = [
      "Grand Canyon", "Yosemite", "Yellowstone",
      "New York City", "Washington DC",
      "San Francisco", "Los Angeles",
    ];

    if (label.toLowerCase().includes("all of these")) {
      return CITIES;
    }

    const matched = [];
    const sorted = [...CITIES].sort((a, b) => b.length - a.length);
    let remaining = label;

    sorted.forEach((city) => {
      if (remaining.toLowerCase().includes(city.toLowerCase())) {
        matched.push(city);
        remaining = remaining.toLowerCase().replace(city.toLowerCase(), "");
      }
    });

    return matched;
  }

  const usCities = parseUSCities("oNpneoenwYnO");

  // ── Derive CE cities from visited countries + Italy places ──
  const visitedCECities = [];
  if (
    europeCountries.some(
      (c) => c === "France" || c.toLowerCase() === "france"
    )
  ) {
    visitedCECities.push("Paris"); // assume France visit = Paris
  }
  if (
    europeCountries.some(
      (c) =>
        c === "United Kingdom" || c.toLowerCase() === "united kingdom"
    )
  ) {
    visitedCECities.push("London"); // assume UK visit = London
  }
  if (italyPlaces.includes("Rome")) {
    visitedCECities.push("Rome");
  }

  // ── Derive CC cities from US cities list ──
  const visitedCCCities = [];
  const CC_RELEVANT = [
    "San Francisco",
    "Los Angeles",
    "Yosemite",
  ];
  CC_RELEVANT.forEach((c) => {
    if (usCities.includes(c)) visitedCCCities.push(c);
  });

  // ── Parse residence info ──
  const livesNow = getText("MKfvKAOwxr3E");
  const grewUp = getText("sNZgZtvBL0rv");
  const elseWhereLived = getText("QsQOnTicExlO");
  const homeCountryRaw = getText("CsLKPNw2PFWA");

  // Normalize home country
  const HOME_COUNTRY_MAP = {
    "usa": "US",
    "united states": "US",
    "united states of america": "US",
    "u.s.": "US",
    "u.s.a.": "US",
    "uk": "UK",
    "united kingdom": "UK",
  };
  const homeCountry =
    HOME_COUNTRY_MAP[homeCountryRaw.toLowerCase().trim()] || homeCountryRaw;

  // Derive boolean residence flags
  const allResidenceText = `${livesNow} ${grewUp} ${elseWhereLived}`.toLowerCase();

  const livedInCalifornia =
    allResidenceText.includes("california") ||
    allResidenceText.includes("los angeles") ||
    allResidenceText.includes("san francisco") ||
    allResidenceText.includes("mountain view") ||
    allResidenceText.includes("novato") ||
    allResidenceText.includes("berkeley") ||
    allResidenceText.includes("oakland") ||
    allResidenceText.includes("san diego") ||
    allResidenceText.includes("sacramento") ||
    allResidenceText.includes(", ca");

  const livedInEurope =
    allResidenceText.includes("london") ||
    allResidenceText.includes("paris") ||
    allResidenceText.includes("berlin") ||
    allResidenceText.includes("europe");
  // Note: "Coleraine UK" is ambiguous — conservative: false unless clearly continental

  const livedInSSA = false; // would need explicit SSA city detection

  const livedInJapanOrKorea =
    allResidenceText.includes("tokyo") ||
    allResidenceText.includes("japan") ||
    allResidenceText.includes("seoul") ||
    allResidenceText.includes("korea");

  const isUSResident =
    homeCountry === "US" ||
    homeCountryRaw.toLowerCase().includes("united states") ||
    homeCountryRaw.toLowerCase().includes("usa");

  // Derive residenceCountries from "where else lived"
  const residenceCountries = [homeCountry];
  // Simple heuristic: check for known country/city patterns
  const RESIDENCE_CITY_TO_COUNTRY = {
    "london": "UK",
    "coleraine": "UK",
    "perth": "Australia",
    "sydney": "Australia",
    "melbourne": "Australia",
    "tokyo": "Japan",
    "seoul": "South Korea",
    "paris": "France",
    "berlin": "Germany",
    "buenos aires": "Argentina",
  };

  Object.entries(RESIDENCE_CITY_TO_COUNTRY).forEach(([city, country]) => {
    if (
      allResidenceText.includes(city) &&
      !residenceCountries.includes(country)
    ) {
      residenceCountries.push(country);
    }
  });

  // ── Parse friends/family abroad ──
  function parseFriendsFamily(fieldId) {
    const text = getText(fieldId);
    if (!text || text.toLowerCase() === "na") return [];

    // Split on commas and clean
    return text
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && s.toLowerCase() !== "na");
  }

  const friendsFamilyRaw = parseFriendsFamily("EREFtxY4MIId");
  // Filter out domestic locations (Hawaii, Chicago, etc. for US residents)
  const DOMESTIC_US = [
    "hawaii",
    "chicago",
    "new york",
    "miami",
    "austin",
    "denver",
    "seattle",
    "portland",
    "boston",
    "atlanta",
  ];
  const friendsFamilyCountries = isUSResident
    ? friendsFamilyRaw.filter(
        (f) => !DOMESTIC_US.includes(f.toLowerCase())
      )
    : friendsFamilyRaw;

  // ── Parse fears ──
  const fearsLabel = getChoiceLabel("haby0w4obGjr").toLowerCase();
  const fearSnakes = fearsLabel.includes("fear of snakes");
  const fearHeights = fearsLabel.includes("fear of heights");

  // ── Foodie ──
  const foodieLabel = getChoiceLabel("JWJuH90XmSYq").toLowerCase();
  const foodie = foodieLabel.includes("huge foodie");

  // ── Road trip ──
  const roadTripLabel = getChoiceLabel("FOXl1vIEYtOK").toLowerCase();
  let roadTrip = "enjoy";
  if (roadTripLabel.includes("i love road trips")) roadTrip = "love";
  else if (roadTripLabel.includes("don't enjoy")) roadTrip = "no";

  // ── Train preference ──
  const trainLabel = getChoiceLabel("4uRWPbCRTre5").toLowerCase();
  let trainPref = "both";
  if (trainLabel.includes("prefer traveling by train")) trainPref = "train";
  else if (trainLabel.includes("prefer traveling by car")) trainPref = "car";
  else if (trainLabel.includes("don't like either")) trainPref = "neither";

  // ── History rating ──
  // From culture question (maps to experiential history interest)
  const historyLabel = getChoiceLabel("0x8c5F8VyE4m").toLowerCase();
  let history_rating = 3; // default "somewhat"
  if (historyLabel.includes("really interested")) history_rating = 5;
  else if (historyLabel.includes("not that interested")) history_rating = 1;

  // ── Age ──
  const age = getNumber("hQm2oxFAh3mv");

  // ── Build the profile ──
  const profile = {
    // Gate 1
    homeCountry,
    residenceCity: livesNow || "",
    residenceRegion: null, // let engine derive from homeCountry
    residenceCountries,
    livedInCalifornia,
    livedInEurope,
    livedInSSA,
    livedInJapanOrKorea,
    isUSResident,

    // Gate 2 & 3
    visitedCountries,
    visitedCECities,
    visitedCACities: [], // no city-level data for Asia in survey
    visitedCAfCities: [], // no city-level data for Africa
    visitedCCCities,

    // Gate 10 / 10B
    age,
    fitness: getNumber("PS04AKhb1UzV"), // 0-10

    // Gate 11 (derived — engine can compute from visited countries)
    completedPBCount: 0,
    completedYPCount: 0,

    // Gate 12
    languages: allLanguages,

    // Gate 13: Landscapes (0-10)
    landscapes: {
      beaches: landscapes["Beaches, coastlines, oceans"] || 0,
      mountains: landscapes["Mountains"] || 0,
      lakes: landscapes["Lakes, rivers, waterfalls"] || 0,
      forests: landscapes["Forests"] || 0,
      vineyards: landscapes["Vineyards, wine regions"] || 0,
      wildlife: landscapes["Wildlife habitat"] || 0,
      rainforests: landscapes["Rainforests"] || 0,
      deserts: landscapes["Deserts"] || 0,
    },

    // Gate 13: Activities (0-5)
    hiking: outdoor2["Hiking/Trekking"] || 0,
    camping: outdoor2["Camping"] || 0,
    backpacking: outdoor2["Backpacking (Trekking with Camping)"] || 0,
    snorkeling: outdoor1["Snorkeling"] || 0,
    scuba: outdoor1["Scuba Diving"] || 0,
    sailing: outdoor1["Sailing"] || 0,
    paddleboard: outdoor1["Paddleboarding"] || 0,
    windKite: outdoor1["Windsurfing, Kitesurfing"] || 0,
    kayaking: outdoor2["Kayaking, Canoeing"] || 0,
    surfing: 0, // not asked in survey
    fishing: outdoor2["Fishing/Fly Fishing"] || 0,
    golf: 0, // would need playing sports matrix (GTCFa2QKfiYX)

    // Gate 13: Interest scales
    wildlife_interest: getNumber("6Jp4tlFSHJdV"), // 0-10
    performing_arts: getNumber("tlh7xL8lgugA"), // 0-10
    art: passions["Art"] || 0, // 0-5
    history_rating, // 0-5 from culture question
    extrovert: 0, // 🔴 NOT IN SURVEY — must be manually set or left at 0
    foodie,
    roadTrip,
    trainPref,
    fearSnakes,
    fearHeights,

    // Gate 13: Friends/Family
    friendsFamilyCountries,

    // v2.29 additions
    outdoors: getNumber("Nw34RFmC1T2t"), // 0-10
    major: getText("G4W8BkalCLE6") || "",
    fieldOfWork: getText("sO3gxchC47CO") || "",
  };

  return profile;
}

module.exports = { transformToProfile };

