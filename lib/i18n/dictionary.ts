/**
 * Shared i18n primitives for the authenticated app (issue #116).
 *
 * Generalizes the marketing site's DE/EN pattern
 * (components/marketing/site/dictionary.ts) so every app/(app)/** section
 * can declare its own colocated dictionary with full type inference, e.g.:
 *
 *   export const DICTIONARY: Dictionary<{ title: string }> = {
 *     de: { title: "Angebote" },
 *     en: { title: "Quotes" },
 *   };
 *
 * German remains the default everywhere (DEFAULT_APP_LANGUAGE), matching
 * existing app-wide behavior; English is purely an opt-in per-user
 * preference stored in `profiles.language`.
 */

export type AppLanguage = "de" | "en";

export type Dictionary<T> = Record<AppLanguage, T>;

export const DEFAULT_APP_LANGUAGE: AppLanguage = "de";

export function isAppLanguage(value: unknown): value is AppLanguage {
  return value === "de" || value === "en";
}
