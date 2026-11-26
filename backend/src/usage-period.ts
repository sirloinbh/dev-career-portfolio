// How long a skill was used (#225): the whole months covered by the projects that used it, overlaps counted once.

type Span = { startDate: string; endDate: string | null };

/** The day after a YYYY-MM-DD date (UTC arithmetic, so daylight saving never matters). */
const nextDay = (date: string) =>
  new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);

/** Whole calendar months from `from` up to (not including) `until`; a partial month is dropped. */
function wholeMonths(from: string, until: string) {
  const [y1, m1, d1] = from.split('-').map(Number) as [number, number, number];
  const [y2, m2, d2] = until.split('-').map(Number) as [number, number, number];
  return Math.max(0, (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0));
}

/**
 * Projects that overlap or touch are merged, then each merged block counts its whole months and the blocks are
 * added. Both end days are worked days. A project with no end date counts up to `today`, and nothing counts
 * after `today`. This is the same rule as the career total on the front end (frontend/src/experience.ts).
 */
export function usedMonths(spans: readonly Span[], today: string) {
  const sorted = spans
    .map((span) => ({
      start: span.startDate,
      end: span.endDate === null || span.endDate > today ? today : span.endDate,
    }))
    .filter((span) => span.start <= span.end)
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  const blocks: { start: string; end: string }[] = [];
  for (const span of sorted) {
    const last = blocks.at(-1);
    if (last && span.start <= nextDay(last.end)) {
      if (span.end > last.end) last.end = span.end;
    } else {
      blocks.push({ ...span });
    }
  }
  return blocks.reduce((sum, block) => sum + wholeMonths(block.start, nextDay(block.end)), 0);
}
