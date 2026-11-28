// Day arithmetic for the certification and application lists (#46, #48). Today and date text come from lib/format.

/**
 * Whole days from `today` to `date`, both YYYY-MM-DD: 0 on the day itself, negative once it has
 * passed. Both are read as UTC midnights, so daylight saving never shifts the count.
 */
export function daysUntil(date: string, today: string) {
  return Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
  );
}
