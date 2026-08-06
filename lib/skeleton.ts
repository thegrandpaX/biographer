import { randomUUID } from "crypto";
import type { LifeSkeleton } from "./types";

/** Facts Claude may extract from a single intake answer - all optional, all additive. */
export interface SkeletonFacts {
  birthDate?: string;
  birthPlace?: string;
  locations?: { place: string; approxStart?: string; approxEnd?: string }[];
  relationships?: { name: string; type: string; approxStart?: string; approxEnd?: string; notes?: string }[];
  transitions?: { description: string; approxDate?: string }[];
}

/**
 * Merges newly-extracted facts into the skeleton. Birth info overwrites
 * (an answer restating/correcting it should win); locations, relationships,
 * and transitions are appended as new entries rather than deduped, since
 * that's left to the normal review view rather than guessed here.
 */
export function mergeSkeletonFacts(skeleton: LifeSkeleton, facts: SkeletonFacts): LifeSkeleton {
  return {
    ...skeleton,
    birthDate: facts.birthDate ?? skeleton.birthDate,
    birthPlace: facts.birthPlace ?? skeleton.birthPlace,
    locations: [
      ...skeleton.locations,
      ...(facts.locations ?? []).map((l) => ({ id: randomUUID(), ...l })),
    ],
    relationships: [
      ...skeleton.relationships,
      ...(facts.relationships ?? []).map((r) => ({ id: randomUUID(), ...r })),
    ],
    transitions: [
      ...skeleton.transitions,
      ...(facts.transitions ?? []).map((t) => ({ id: randomUUID(), ...t })),
    ],
  };
}

/** Compact text summary of the skeleton, used as standing context in prompts. */
export function summarizeSkeleton(skeleton: LifeSkeleton): string {
  const parts: string[] = [];

  if (skeleton.birthDate || skeleton.birthPlace) {
    parts.push(`Born ${skeleton.birthDate ?? "date unknown"} in ${skeleton.birthPlace ?? "place unknown"}.`);
  }
  if (skeleton.locations.length > 0) {
    parts.push(
      "Lived in: " +
        skeleton.locations
          .map((l) => `${l.place} (${l.approxStart ?? "?"}-${l.approxEnd ?? "?"})`)
          .join("; ")
    );
  }
  if (skeleton.relationships.length > 0) {
    parts.push(
      "Key relationships: " +
        skeleton.relationships
          .map((r) => `${r.name} (${r.type}, ${r.approxStart ?? "?"}-${r.approxEnd ?? "?"})`)
          .join("; ")
    );
  }
  if (skeleton.transitions.length > 0) {
    parts.push(
      "Major transitions: " +
        skeleton.transitions.map((t) => `${t.description} (${t.approxDate ?? "?"})`).join("; ")
    );
  }

  return parts.length > 0 ? parts.join("\n") : "No life skeleton captured yet.";
}
