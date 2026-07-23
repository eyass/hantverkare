// Shared validation for time_entries.hours -- mirrors the DB check constraint
// in supabase/migrations/0040_time_entries.sql (`hours > 0 and hours <= 24`)
// so the Server Action can reject bad input with a friendly German message
// instead of surfacing a raw Postgres constraint-violation error.

export const MIN_HOURS = 0;
export const MAX_HOURS = 24;

export type HoursValidationResult = { error: string | null };

/**
 * Validates a raw hours value the way the DB constraint does (`> 0 and <= 24`),
 * plus rejects non-finite input the DB numeric(5,2) column would otherwise
 * reject with a less friendly error.
 */
export function validateHours(hours: number): HoursValidationResult {
  if (!Number.isFinite(hours)) {
    return { error: "Bitte eine gültige Stundenzahl angeben." };
  }
  if (hours <= MIN_HOURS) {
    return { error: "Die Stundenzahl muss größer als 0 sein." };
  }
  if (hours > MAX_HOURS) {
    return { error: "Die Stundenzahl darf 24 nicht überschreiten." };
  }
  return { error: null };
}

export function validateWorkedOn(workedOn: string): HoursValidationResult {
  const date = new Date(workedOn);
  if (Number.isNaN(date.getTime())) {
    return { error: "Bitte ein gültiges Datum angeben." };
  }
  return { error: null };
}
