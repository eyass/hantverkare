/**
 * Shared formatting helpers used across the app.
 *
 * These consolidate what used to be ~15 near-identical local `formatEuros`
 * helpers and ~17 near-identical local date-formatting helpers scattered
 * across `app/` and `lib/`. See issue #216.
 */

/** Format a price given in cents as a German-locale EUR currency string, e.g. "1.234,56 €". */
export function formatEuros(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

/** Format a date using the German locale's default short numeric format, e.g. "22.7.2026". */
export function formatDateShort(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString("de-DE");
}

/** Format a date as a long German-locale date, e.g. "22. Juli 2026". */
export function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleDateString("de-DE", { year: "numeric", month: "long", day: "numeric" });
}

/**
 * Format a date+time using the German locale with a short month and
 * 24h hour:minute, e.g. "22. Jul. 2026, 14:05".
 */
export function formatDateTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return date.toLocaleString("de-DE", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
