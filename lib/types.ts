// Core data model for Biographer.
// Persisted as JSON files in a "Biographer Data" folder in the user's Google Drive
// (see lib/drive.ts) rather than in a database.

export type ThemeKey =
  | "relationships"
  | "daily-life"
  | "turning-points"
  | "beliefs"
  | "regrets"
  | "sensory-place";

export const THEME_LABELS: Record<ThemeKey, string> = {
  relationships: "Relationships and people",
  "daily-life": "Daily life and routines",
  "turning-points": "Formative or turning-point moments",
  beliefs: "Beliefs/feelings at the time vs. now",
  regrets: "Regrets or things he'd do differently",
  "sensory-place": "Sensory or place-based detail",
};

export const ALL_THEMES: ThemeKey[] = Object.keys(THEME_LABELS) as ThemeKey[];

// Seed life periods from the concept spec. These are a starting point, not a
// fixed enum — new periods can be appended as real clustering emerges from
// fragments, so callers should treat this as a mutable list loaded from
// coverage-map.json, not a hardcoded type union.
export interface LifePeriod {
  id: string;
  label: string;
  /** Rough ordering hint only; dates are expected to be blurry, especially early on. */
  approxStart?: string;
  approxEnd?: string;
}

export const SEED_LIFE_PERIODS: LifePeriod[] = [
  { id: "childhood-twenties", label: "Childhood through twenties" },
  { id: "pullman", label: "Living in Pullman (approx. ages 18-21)" },
  { id: "marriage-divorce", label: "Marriage at 21 through the divorce (~15 years)" },
  { id: "post-divorce", label: "Post-divorce rebuilding period" },
  { id: "last-decade", label: "Roughly the last 10 years" },
];

export interface Fragment {
  id: string;
  timestamp: string; // ISO 8601
  periodId: string; // references LifePeriod.id (provisional, may be corrected later)
  theme: ThemeKey;
  sourceQuestion: string;
  rawText: string;
  cleanedText: string;
  /** IDs of chapters (in chapters/) that currently reference this fragment. */
  chapterRefs: string[];
}

export interface CoverageCell {
  periodId: string;
  theme: ThemeKey;
  fragmentCount: number;
  lastAskedAt?: string; // ISO 8601
  /** Set once Scott signals (explicitly or implicitly) this cell is tapped out. */
  taperedOff: boolean;
}

export interface CoverageMap {
  periods: LifePeriod[];
  cells: CoverageCell[];
  updatedAt: string; // ISO 8601
}

export interface SessionAnswer {
  question: string;
  fragment: Fragment;
}
