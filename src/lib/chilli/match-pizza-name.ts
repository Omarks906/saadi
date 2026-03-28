/**
 * matchPizzaName
 *
 * Maps a customer-spoken pizza name (as transcribed by Vapi STT) to the
 * canonical Chilli Pizzeria menu item name.
 *
 * Strategy (in order):
 *   1. Exact match after normalisation  (O(1) map lookup)
 *   2. Phonetic alias lookup            (O(1) map lookup, handles severe STT distortions)
 *   3. Fuzzy match                      (combined Levenshtein + Dice similarity)
 *   4. null if best score < THRESHOLD
 */

// ── Canonical pizza menu ──────────────────────────────────────────────────────
// Source of truth for name casing. Update when the menu changes.

export const PIZZA_MENU_NAMES: readonly string[] = [
  // ORDINARIE
  "Funge", "Margherita", "Vesuvio", "Calzone", "Capricciosa", "Hawaii",
  "Bussola", "Al Tonno", "Opera", "Pompei", "Chicko Banana", "Gudfadern",
  "Salami", "Bolognese", "Vegetarisk", "Kycklingpizza", "Marinara",
  "Romana", "Torino", "Pizza Verde", "Barletta", "Hot Hot", "Porto",
  "Pescatore", "Tutti Frutti", "Greken", "Veggo", "Gorgonzola",
  // MELLAN
  "Chicken", "Pepperoni", "Dingeling", "Nobel", "Quattro Stagioni",
  "Quattro Formaggi", "San Torino", "Fiket", "Salerno", "Madonna",
  "Havets", "Doritos", "Figaro", "Pati Special", "Sylvia", "Korven",
  "Peking", "Bonden", "Azteka", "Mafiosa",
  // SPECIAL
  "Tropicana", "Husets Special", "Black & White", "Dolphins", "Kantarell",
  "Marco", "Ciao Ciao", "Ljura Special", "Viagra", "Amigo", "Tacopizza",
  "Mexicana", "Sleipner", "Cosa Nostra", "Arrabiata", "Bennys Special",
  "Chili Special", "Parma", "Salamino", "Gourmet",
  // KEBAB & GYROS
  "Hellas", "Gyrospizza", "Athena", "Rhodos", "Falafelpizza", "Kebabpizza",
  "Jalla Jalla", "Sultan",
] as const;

// ── Phonetic alias table ──────────────────────────────────────────────────────
// Keys: lowercased canonical name.
// Values: known bad STT transcriptions (before normalisation).
// Extend this list whenever you encounter a new distortion in Vapi logs.

const PHONETIC_ALIASES: Record<string, string[]> = {
  "capricciosa": [
    "kabbalisch ås", "caprichosa", "kapricciosa", "capricosa",
    "capriosa", "kapriciosa", "capriccosa",
  ],
  "pepperoni": [
    "peperoni", "svepperoni", "piperoni", "peppäroni",
    "pepparoni", "peperroni",
  ],
  "kycklingpizza": [
    "kyckling pizza", "kyckling", "kyklingpizza",
    "chickling pizza", "tjiklingpizza", "chiklingpizza",
  ],
  "quattro stagioni": [
    "kvattro stajoni", "quattro stajone", "quatro stagioni",
    "kwattro stagioni", "kvattro stagioni",
  ],
  "quattro formaggi": [
    "kvattro formaggi", "quatro formaggi", "kwattro formaggi",
    "quattro formaği", "kvattro formagge",
  ],
  "gyrospizza": [
    "gyros pizza", "jirospizza", "yirospizza", "gyrosspizza",
  ],
  "kebabpizza": [
    "kebab pizza", "cabab pizza", "kabab pizza", "kebap pizza",
  ],
  "falafelpizza": [
    "falafel pizza", "falaflpizza", "falafelspizza",
  ],
  "calzone": [
    "kalzone", "caltzone", "kaltsone", "kaltzone", "kaltszone",
  ],
  "margherita": [
    "margarita", "margerita", "margrita", "marguerita",
  ],
  "arrabiata": [
    "arrabbiata", "arabiata", "arrabbiatta", "arabbiata",
  ],
  "tacopizza": [
    "taco pizza", "tacko pizza", "taccopizza", "taco-pizza",
  ],
  "gorgonzola": [
    "gorgonsola", "gorgensola", "gorgeonzola", "gorgonssola",
  ],
  "jalla jalla": [
    "jala jala", "yalla yalla", "yala yala", "jala jalla",
  ],
  "husets special": [
    "husetes special", "husets speciel", "husets specal",
  ],
  "chili special": [
    "chilli special", "tjilli special", "chilli speciel", "tjili special",
  ],
  "black & white": [
    "black and white", "blak and white", "black white", "blackwhite",
  ],
  "bennys special": [
    "benny special", "bennies special", "bennys speciel",
  ],
  "ljura special": [
    "ljuras special", "jura special", "liura special", "ljura speciel",
  ],
  "pati special": [
    "patty special", "patti special", "paty special", "pati speciel",
  ],
  "cosa nostra": [
    "kosa nostra", "cosa nostre", "kossa nostra", "kosa nostre",
  ],
  "tutti frutti": [
    "tutti frukti", "tuti fruti", "tuti frutti", "tutte frutte",
  ],
  "ciao ciao": [
    "chao chao", "tsjao tsjao", "ciao tjao", "tjao tjao",
  ],
  "hawaii": [
    "havaj", "havaii", "havai", "hawai",
  ],
  "al tonno": [
    "al tono", "al tuno", "altonno", "al tunno",
  ],
  "chicko banana": [
    "chico banana", "chicko banan", "chiko banana", "tjicko banana",
  ],
  "pizza verde": [
    "pizza verd", "pitza verde", "pizza verdé",
    // Swedish STT hears "verde" as "värld" (world) — multiple suffix forms
    "vidda värld", "vidda värld i", "pizza värld", "pizza värld i",
    "vidda verd", "vidda verde",
  ],
  "hot hot": [
    "hothot", "hot-hot",
  ],
  "san torino": [
    "san torino", "santorino", "san torinno",
  ],
  "sleipner": [
    "slajpner", "slejpner", "sleipnir",
  ],
};

// ── Normalisation ─────────────────────────────────────────────────────────────

/**
 * Lowercase, collapse runs of non-alphabetic characters (except Swedish
 * letters and &) to a single space, then trim.
 *
 * "Quattro Stagioni" → "quattro stagioni"
 * "kabbalisch ås"   → "kabbalisch ås"
 * "black & white"   → "black & white"
 */
function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-zåäö& ]+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ── Build lookup maps (run once at module load) ───────────────────────────────

/** normalised canonical name → original-cased menu item */
const _exactMap = new Map<string, string>();
/** normalised alias → original-cased menu item */
const _aliasMap = new Map<string, string>();

for (const item of PIZZA_MENU_NAMES) {
  _exactMap.set(normalise(item), item);
}

for (const [canonicalLower, aliases] of Object.entries(PHONETIC_ALIASES)) {
  // Resolve to the correctly-cased menu item (guard against typos in the table)
  const menuItem = _exactMap.get(normalise(canonicalLower));
  if (!menuItem) continue;

  for (const alias of aliases) {
    _aliasMap.set(normalise(alias), menuItem);
  }
}

// ── String similarity ─────────────────────────────────────────────────────────

/** Two-row dynamic-programming Levenshtein (O(n) space). */
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  const curr = new Array<number>(n + 1);

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      curr[j] =
        a[i - 1] === b[j - 1]
          ? prev[j - 1]
          : 1 + Math.min(prev[j], curr[j - 1], prev[j - 1]);
    }
    prev = curr.slice();
  }
  return prev[n];
}

/** Levenshtein similarity normalised to [0, 1]. */
function levSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(a, b) / maxLen;
}

/** Sørensen–Dice coefficient on character bigrams. */
function diceSimilarity(a: string, b: string): number {
  if (a.length < 2 && b.length < 2) return a === b ? 1 : 0;
  if (a.length < 2 || b.length < 2) return 0;

  const countBigrams = (s: string): Map<string, number> => {
    const map = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s[i] + s[i + 1];
      map.set(bg, (map.get(bg) ?? 0) + 1);
    }
    return map;
  };

  const bg1 = countBigrams(a);
  const bg2 = countBigrams(b);
  let intersection = 0;
  for (const [bg, count] of bg1) {
    intersection += Math.min(count, bg2.get(bg) ?? 0);
  }

  return (2 * intersection) / (a.length - 1 + b.length - 1);
}

/**
 * Combined score: 40% Levenshtein + 60% Dice.
 * Dice is weighted higher because it is more robust to insertions/deletions
 * of whole subwords (common in STT errors).
 */
function combinedScore(a: string, b: string): number {
  return 0.4 * levSimilarity(a, b) + 0.6 * diceSimilarity(a, b);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type MatchMethod =
  | "exact"
  | "alias"
  | "fuzzy"
  | "below-threshold"
  | "invalid-input"
  | "empty";

export interface MatchResult {
  /** Canonical menu item name, or null if no confident match. */
  match: string | null;
  /** Confidence in [0, 1]. */
  confidence: number;
  /** How the match was found. */
  method: MatchMethod;
  /** Top-5 fuzzy candidates (populated on fuzzy path, empty otherwise). */
  topCandidates: Array<{ name: string; score: number }>;
}

// ── Core implementation ───────────────────────────────────────────────────────

const FUZZY_THRESHOLD = 0.55;

function _match(spokenName: string): MatchResult {
  if (!spokenName || typeof spokenName !== "string") {
    return { match: null, confidence: 0, method: "invalid-input", topCandidates: [] };
  }

  const norm = normalise(spokenName);

  if (!norm) {
    return { match: null, confidence: 0, method: "empty", topCandidates: [] };
  }

  // 1. Exact match (case-insensitive, after normalisation)
  const exactHit = _exactMap.get(norm);
  if (exactHit) {
    return { match: exactHit, confidence: 1, method: "exact", topCandidates: [] };
  }

  // 2. Phonetic alias lookup
  const aliasHit = _aliasMap.get(norm);
  if (aliasHit) {
    return { match: aliasHit, confidence: 0.95, method: "alias", topCandidates: [] };
  }

  // 3. Fuzzy match against all normalised menu names
  const candidates = PIZZA_MENU_NAMES.map((item) => ({
    name: item,
    score: combinedScore(norm, normalise(item)),
  })).sort((a, b) => b.score - a.score);

  const best = candidates[0];

  if (best.score >= FUZZY_THRESHOLD) {
    return {
      match: best.name,
      confidence: best.score,
      method: "fuzzy",
      topCandidates: candidates.slice(0, 5),
    };
  }

  return {
    match: null,
    confidence: best.score,
    method: "below-threshold",
    topCandidates: candidates.slice(0, 5),
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Maps a customer-spoken pizza name (Vapi STT output) to the canonical
 * Chilli Pizzeria menu item name.
 *
 * @returns Canonical item name, or `null` if no confident match found.
 *
 * @example
 * matchPizzaName("kabbalisch ås")  // → "Capricciosa"
 * matchPizzaName("kantarell")      // → "Kantarell"
 * matchPizzaName("peperoni")       // → "Pepperoni"
 * matchPizzaName("svepperoni")     // → "Pepperoni"
 * matchPizzaName("ostkyckling")    // → null
 */
export function matchPizzaName(spokenName: string): string | null {
  return _match(spokenName).match;
}

/**
 * Same as `matchPizzaName` but returns full debug info including the
 * confidence score and top fuzzy candidates.
 */
export function matchPizzaNameDebug(spokenName: string): MatchResult {
  return _match(spokenName);
}
