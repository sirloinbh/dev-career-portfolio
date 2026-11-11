// Dates in the service time zone (shared by the certification list #46 and the application list #48).

/** Today as YYYY-MM-DD in the service time zone (Asia/Seoul), like the API's serviceDate. */
export function serviceToday(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/**
 * Whole days from `today` to `date`, both YYYY-MM-DD: 0 on the day itself, negative once it has
 * passed. Both are read as UTC midnights, so daylight saving never shifts the count.
 */
export function daysUntil(date: string, today: string) {
  return Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
  );
}

/** A YYYY-MM-DD date as "October 22, 2026". */
export function formatDate(date: string) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(`${date}T00:00:00Z`));
}
