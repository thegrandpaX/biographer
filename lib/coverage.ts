import { ALL_THEMES, type CoverageCell, type CoverageMap, type ThemeKey } from "./types";

/** Every (period x theme) combination that should exist as a coverage cell. */
function allCellKeys(map: CoverageMap): { periodId: string; theme: ThemeKey }[] {
  return map.periods.flatMap((period) =>
    ALL_THEMES.map((theme) => ({ periodId: period.id, theme }))
  );
}

function findCell(map: CoverageMap, periodId: string, theme: ThemeKey): CoverageCell | undefined {
  return map.cells.find((c) => c.periodId === periodId && c.theme === theme);
}

/**
 * Returns coverage cells ordered thinnest-first, skipping any Scott has
 * tapered off (explicitly or implicitly signaled as "not much there").
 * Cells with no fragments yet (not present in map.cells) sort first.
 */
export function getThinCells(map: CoverageMap): { periodId: string; theme: ThemeKey; fragmentCount: number }[] {
  return allCellKeys(map)
    .map(({ periodId, theme }) => {
      const cell = findCell(map, periodId, theme);
      if (cell?.taperedOff) return null;
      return { periodId, theme, fragmentCount: cell?.fragmentCount ?? 0 };
    })
    .filter((c): c is { periodId: string; theme: ThemeKey; fragmentCount: number } => c !== null)
    .sort((a, b) => a.fragmentCount - b.fragmentCount);
}

export const SNOOZE_DAYS = 7;

/** Period ids currently set aside by "New topic" (snooze hasn't expired yet). */
export function getSnoozedPeriodIds(map: CoverageMap): Set<string> {
  const now = Date.now();
  return new Set(
    map.periods
      .filter((p) => p.snoozedUntil && new Date(p.snoozedUntil).getTime() > now)
      .map((p) => p.id)
  );
}

/** Sets a period aside so the engine stops targeting it for a while. */
export function snoozePeriod(map: CoverageMap, periodId: string, days = SNOOZE_DAYS): CoverageMap {
  const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
  return {
    ...map,
    periods: map.periods.map((p) => (p.id === periodId ? { ...p, snoozedUntil: until } : p)),
  };
}

/**
 * Picks the single thinnest-covered (period, theme) pair to target next.
 * Periods set aside by "New topic" (snoozed) are skipped, so a subject Scott
 * isn't ready to talk about doesn't keep coming back as the "thinnest" cell.
 * excludePeriodId is the immediate belt-and-braces version of the same thing.
 * Falls back to ignoring both if nothing else is left (e.g. only one period
 * has any coverage cells so far, or everything is snoozed).
 */
export function pickNextTarget(
  map: CoverageMap,
  excludePeriodId?: string
): { periodId: string; theme: ThemeKey } | null {
  const thin = getThinCells(map);
  const snoozed = getSnoozedPeriodIds(map);
  const preferred = thin.filter((c) => !snoozed.has(c.periodId) && c.periodId !== excludePeriodId);
  const pick = preferred[0] ?? thin[0];
  return pick ? { periodId: pick.periodId, theme: pick.theme } : null;
}

/** Increments the cell for a newly-saved fragment, creating it if needed. */
export function recordFragment(map: CoverageMap, periodId: string, theme: ThemeKey): CoverageMap {
  const existing = findCell(map, periodId, theme);
  const now = new Date().toISOString();
  if (existing) {
    return {
      ...map,
      cells: map.cells.map((c) =>
        c === existing ? { ...c, fragmentCount: c.fragmentCount + 1, lastAskedAt: now } : c
      ),
    };
  }
  const newCell: CoverageCell = {
    periodId,
    theme,
    fragmentCount: 1,
    lastAskedAt: now,
    taperedOff: false,
  };
  return { ...map, cells: [...map.cells, newCell] };
}

/** Marks a (period, theme) cell as tapped out so the question engine backs off it. */
export function markTaperedOff(map: CoverageMap, periodId: string, theme: ThemeKey): CoverageMap {
  const existing = findCell(map, periodId, theme);
  if (existing) {
    return {
      ...map,
      cells: map.cells.map((c) => (c === existing ? { ...c, taperedOff: true } : c)),
    };
  }
  return {
    ...map,
    cells: [...map.cells, { periodId, theme, fragmentCount: 0, taperedOff: true }],
  };
}
