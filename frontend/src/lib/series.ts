// Monthly totals for sparklines and charts, computed from lists the pages
// already load.

/** Totals for each of the last `months` calendar months, oldest first. */
export function monthlyTotals<T>(
  rows: T[],
  getDate: (row: T) => string | null | undefined,
  getValue: (row: T) => number,
  months = 6,
  now = new Date(),
): number[] {
  const totals = new Array<number>(months).fill(0)
  for (const row of rows) {
    const raw = getDate(row)
    if (!raw) continue
    const d = new Date(raw)
    const back = (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth())
    if (back >= 0 && back < months) totals[months - 1 - back] += getValue(row)
  }
  return totals
}
