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

/**
 * Picks the single thinnest-covered (period, theme) pair to target next.
 * When excludePeriodId is given (the "new topic" override), the thinnest
 * cell from a DIFFERENT life period is preferred, so the engine genuinely
 * branches rather than picking something that happens to be adjacent.
 * Falls back to including the excluded period if nothing else is left
 * (e.g. only one period has any coverage cells so far).
 */
export function pickNextTarget(
  map: CoverageMap,
  excludePeriodId?: string
): { periodId: string; theme: ThemeKey } | null {
  const thin = getThinCells(map);
  if (excludePeriodId) {
    const otherPeriods = thin.filter((c) => c.periodId !== excludePeriodId);
    if (otherPeriods.length > 0) return { periodId: otherPeriods[0].periodId, theme: otherPeriods[0].theme };
  }
  return thin.length > 0 ? { periodId: thin[0].periodId, theme: thin[0].theme } : null;
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
