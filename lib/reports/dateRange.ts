/**
 * Pure date-range computation for the Reports page (issue #151).
 *
 * All ranges are computed against the caller's local calendar (using the
 * provided `now`, defaulting to `new Date()`) and returned as UTC ISO
 * timestamps suitable for Postgres `timestamptz` comparisons
 * (`created_at >= start && created_at < end`, i.e. start inclusive / end
 * exclusive).
 */

export type ReportsRangePreset = "this_month" | "last_month" | "this_quarter" | "this_year" | "custom";

export const REPORTS_RANGE_PRESETS: ReportsRangePreset[] = [
  "this_month",
  "last_month",
  "this_quarter",
  "this_year",
  "custom",
];

export function isReportsRangePreset(value: unknown): value is ReportsRangePreset {
  return typeof value === "string" && (REPORTS_RANGE_PRESETS as string[]).includes(value);
}

export type ReportsDateRange = {
  preset: ReportsRangePreset;
  /** Inclusive start of the range, as an ISO timestamp (UTC). */
  startISO: string;
  /** Exclusive end of the range, as an ISO timestamp (UTC). */
  endISO: string;
  /** The custom range's start/end as plain yyyy-mm-dd strings, for the date inputs. */
  customFrom: string | null;
  customTo: string | null;
};

function startOfDay(year: number, monthIndex: number, day: number): Date {
  return new Date(year, monthIndex, day, 0, 0, 0, 0);
}

/**
 * Parses a "yyyy-mm-dd" string as a local-time calendar date. Invalid input
 * returns null rather than throwing or falling back to `now`, so callers can
 * decide how to handle a malformed custom range.
 */
function parseDateOnly(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [, y, m, d] = match;
  const year = Number(y);
  const monthIndex = Number(m) - 1;
  const day = Number(d);
  const date = startOfDay(year, monthIndex, day);
  // Guard against e.g. 2026-02-31 silently rolling over into March.
  if (date.getFullYear() !== year || date.getMonth() !== monthIndex || date.getDate() !== day) {
    return null;
  }
  return date;
}

/**
 * Computes the [start, end) date range for a given preset (or a custom
 * from/to pair). Falls back to "this_month" when the preset is "custom" but
 * the from/to values are missing or unparseable.
 */
export function computeReportsDateRange(
  preset: ReportsRangePreset,
  customFrom: string | null,
  customTo: string | null,
  now: Date = new Date(),
): ReportsDateRange {
  const year = now.getFullYear();
  const monthIndex = now.getMonth();

  if (preset === "custom") {
    const fromDate = customFrom ? parseDateOnly(customFrom) : null;
    const toDate = customTo ? parseDateOnly(customTo) : null;
    if (fromDate && toDate && fromDate.getTime() <= toDate.getTime()) {
      const start = fromDate;
      // End is exclusive: the day after `to`, at midnight.
      const end = new Date(toDate.getTime());
      end.setDate(end.getDate() + 1);
      return {
        preset: "custom",
        startISO: start.toISOString(),
        endISO: end.toISOString(),
        customFrom,
        customTo,
      };
    }
    // Invalid/incomplete custom range: fall back to "this_month".
    return computeReportsDateRange("this_month", null, null, now);
  }

  if (preset === "last_month") {
    const start = startOfDay(year, monthIndex - 1, 1);
    const end = startOfDay(year, monthIndex, 1);
    return { preset, startISO: start.toISOString(), endISO: end.toISOString(), customFrom: null, customTo: null };
  }

  if (preset === "this_quarter") {
    const quarterStartMonth = Math.floor(monthIndex / 3) * 3;
    const start = startOfDay(year, quarterStartMonth, 1);
    const end = startOfDay(year, quarterStartMonth + 3, 1);
    return { preset, startISO: start.toISOString(), endISO: end.toISOString(), customFrom: null, customTo: null };
  }

  if (preset === "this_year") {
    const start = startOfDay(year, 0, 1);
    const end = startOfDay(year + 1, 0, 1);
    return { preset, startISO: start.toISOString(), endISO: end.toISOString(), customFrom: null, customTo: null };
  }

  // "this_month" (default)
  const start = startOfDay(year, monthIndex, 1);
  const end = startOfDay(year, monthIndex + 1, 1);
  return { preset: "this_month", startISO: start.toISOString(), endISO: end.toISOString(), customFrom: null, customTo: null };
}
