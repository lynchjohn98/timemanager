// Date helpers shared by the server and the browser.
// Calendar dates are handled as "day numbers" (days since 1970-01-01, UTC)
// so plain dates like "2026-11-02" never shift between timezones.

export const DAY_MS = 86_400_000;

/** Today's (or any instant's) calendar date in a timezone, as "YYYY-MM-DD". */
export function ymdInTz(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** "2026-11-02" → day number */
export function toDayNumber(isoDate: string) {
  const [y, m, d] = isoDate.slice(0, 10).split("-").map(Number);
  return Date.UTC(y, m - 1, d) / DAY_MS;
}

/** day number → Date at UTC midnight */
export function dayToDate(day: number) {
  return new Date(day * DAY_MS);
}

/** Format a day number, e.g. formatDay(n, { month: "short", day: "numeric" }) → "Nov 2" */
export function formatDay(day: number, options: Intl.DateTimeFormatOptions) {
  return dayToDate(day).toLocaleDateString("en-US", { timeZone: "UTC", ...options });
}

/** Format an exact time in a timezone, e.g. "Nov 2, 9:00 AM CST" */
export function formatTimeInTz(iso: string, timeZone: string) {
  return new Date(iso).toLocaleString("en-US", {
    timeZone,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

/** Add days to a "YYYY-MM-DD" date */
export function addDays(isoDate: string, days: number) {
  return dayToDate(toDayNumber(isoDate) + days).toISOString().slice(0, 10);
}

/** The Monday of the week containing a "YYYY-MM-DD" date */
export function mondayOf(isoDate: string) {
  const weekday = dayToDate(toDayNumber(isoDate)).getUTCDay(); // 0 = Sunday
  return addDays(isoDate, -((weekday + 6) % 7));
}

/** Days between two "YYYY-MM-DD" dates (b - a) */
export function daysBetween(a: string, b: string) {
  return toDayNumber(b) - toDayNumber(a);
}

/** "Nov 2" or "Nov 2, 2026" */
export function shortDate(isoDate: string, withYear = false) {
  return formatDay(toDayNumber(isoDate), withYear ? { month: "short", day: "numeric", year: "numeric" } : { month: "short", day: "numeric" });
}
