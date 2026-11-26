// Total length of work experience (#226). Pure functions: the screen passes today's date in.

type Period = { startDate: string; endDate: string | null; employmentType: string };

export type Experience = {
  /** Whole months in jobs other than internships, overlaps counted once. */
  workMonths: number;
  /** Whole months in internships, overlaps counted once and kept apart from `workMonths`. */
  internMonths: number;
};

const parts = (date: string) => date.split('-').map(Number) as [number, number, number];

/** The day after a YYYY-MM-DD date (UTC arithmetic, so daylight saving never matters). */
function nextDay(date: string) {
  return new Date(Date.parse(`${date}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
}

/** Whole calendar months from `from` up to (not including) `until`; a partial month is dropped. */
function wholeMonths(from: string, until: string) {
  const [y1, m1, d1] = parts(from);
  const [y2, m2, d2] = parts(until);
  return Math.max(0, (y2 - y1) * 12 + (m2 - m1) - (d2 < d1 ? 1 : 0));
}

/**
 * Merges periods that overlap or touch (the next one starts on or before the day after the
 * previous one ends), then counts whole months of each merged block and adds them up. Both ends
 * are worked days. A job with no end date counts up to `today`, and nothing counts past `today`.
 */
function monthsOf(periods: readonly Pick<Period, 'startDate' | 'endDate'>[], today: string) {
  const spans = periods
    .map((p) => ({
      start: p.startDate,
      end: p.endDate === null || p.endDate > today ? today : p.endDate,
    }))
    .filter((span) => span.start <= span.end)
    .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
  const blocks: { start: string; end: string }[] = [];
  for (const span of spans) {
    const last = blocks.at(-1);
    if (last && span.start <= nextDay(last.end)) {
      if (span.end > last.end) last.end = span.end;
    } else {
      blocks.push({ ...span });
    }
  }
  return blocks.reduce((sum, block) => sum + wholeMonths(block.start, nextDay(block.end)), 0);
}

export function experienceOf(careers: readonly Period[], today: string): Experience {
  const isIntern = (career: Period) => career.employmentType === 'intern';
  return {
    workMonths: monthsOf(
      careers.filter((c) => !isIntern(c)),
      today,
    ),
    internMonths: monthsOf(careers.filter(isIntern), today),
  };
}

/** "3 years 4 months", "1 year", "5 months", or "0 months". */
export function monthsText(months: number) {
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const unit = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const text = [years > 0 ? unit(years, 'year') : '', rest > 0 ? unit(rest, 'month') : '']
    .filter(Boolean)
    .join(' ');
  return text || '0 months';
}
