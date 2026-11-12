/** "1 entry" or "3 entries": the count shown above a list and in each group. */
export function entryCount(count: number) {
  return `${String(count)} ${count === 1 ? 'entry' : 'entries'}`;
}
