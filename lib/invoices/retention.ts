/**
 * GoBD invoice retention period, in years.
 *
 * Documented explicitly here (per the design spec's recommendation in
 * docs/superpowers/specs/2026-07-22-gobd-datev-export-design.md, section 3.4)
 * even though nothing in this codebase currently enforces it -- no deletion
 * path exists for invoices today, so the risk is "accidental, not designed"
 * retention rather than active enforcement.
 *
 * NOT SETTLED: German law traditionally required 10 years; recent reform has
 * shortened this to 8 years for documents from a certain date onward, but the
 * exact cutover point needs Steuerberater/legal confirmation before this
 * constant (or any enforcement built on it) should be relied upon -- see the
 * spec's open question 5.3. 10 is used here as the conservative default
 * (longer retention is always safe; shorter retention risks a compliance gap).
 */
export const INVOICE_RETENTION_YEARS = 10;
