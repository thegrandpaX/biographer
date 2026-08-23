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
  /**
   * True when Scott started this fragment on his own topic rather than
   * answering an engine-picked question (or continued that thread by
   * answering a follow-up). The question engine uses this to keep
   * following the thread on the next question instead of snapping back
   * to gap-filling.
   */
  selfDirected?: boolean;
}

/**
 * A question set aside to answer later instead of now - e.g. it's clearly
 * relevant but too deep or long for the current session. Surfaced only
 * when Scott chooses to pull one up, not force-injected into the normal
 * question rotation.
 */
export interface SavedQuestion {
  id: string;
  question: string;
  targetPeriodId: string;
  targetTheme: ThemeKey;
  followUp: boolean;
  savedAt: string; // ISO 8601
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

// Life skeleton: a rough scaffold gathered during a dedicated intake step
// before deep-probing questions begin, so the question engine (and tagging)
// has standing context to place new fragments against instead of guessing
// blind. Fuzzy/approximate dates are expected and fine here - precision
// comes later via the normal review process.

export interface SkeletonLocation {
  id: string;
  place: string;
  approxStart?: string;
  approxEnd?: string;
}

export interface SkeletonRelationship {
  id: string;
  name: string;
  /** Free text, e.g. "spouse", "long-term partner" - not a fixed enum. */
  type: string;
  approxStart?: string;
  approxEnd?: string;
  notes?: string;
}

export interface SkeletonTransition {
  id: string;
  description: string;
  approxDate?: string;
}

export interface LifeSkeleton {
  birthDate?: string;
  birthPlace?: string;
  locations: SkeletonLocation[];
  relationships: SkeletonRelationship[];
  transitions: SkeletonTransition[];
  /** Set once the intake step is considered done; gates entry to normal daily questions. */
  completedAt?: string;
}

export function emptySkeleton(): LifeSkeleton {
  return { locations: [], relationships: [], transitions: [] };
}

export type IntakeCategory = "birth" | "locations" | "relationships" | "transitions";

export const INTAKE_CATEGORY_ORDER: IntakeCategory[] = [
  "birth",
  "locations",
  "relationships",
  "transitions",
];

export const INTAKE_CATEGORY_LABELS: Record<IntakeCategory, string> = {
  birth: "Birth date and birthplace",
  locations: "Key locations lived",
  relationships: "Key relationships",
  transitions: "Major life transitions",
};
