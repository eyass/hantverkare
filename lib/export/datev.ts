import { toDatevCsv } from "../csv/toDatevCsv";

// DATEV EXTF "Rechnungsdaten" export -- v1 from the design spec
// (docs/superpowers/specs/2026-07-22-gobd-datev-export-design.md, section
// 3.5): a DATEV-adjacent structured export that a Steuerberater's office can
// import or re-key WITHOUT requiring a chart-of-accounts mapping
// (SKR03/SKR04, Berater-/Mandantennummer, revenue/VAT account numbers) --
// none of which this app currently models. A full EXTF "Buchungsstapel"
// (booking-batch) export is deliberately NOT attempted here; the spec flags
// the format-variant choice as an open question needing human/Steuerberater
// confirmation (open question 5.2), and the account-mapping config doesn't
// exist yet.
//
// Row 1 still uses the real DATEV EXTF metadata line format (positional,
// fixed field count) so the file is recognizable as a DATEV EXTF export by
// import tooling, even though the body columns describe invoice-level data
// rather than double-entry postings.

export type DatevInvoiceRow = {
  invoiceNumber: string;
  issuedAt: string; // ISO date
  customerName: string;
  description: string;
  subtotalCents: number;
  vatCents: number;
  totalCents: number;
  voided: boolean;
  creditNoteFor: string | null; // original invoice number, if this row is a credit note
};

function centsToDatevAmount(cents: number): string {
  // DATEV amount fields use a comma decimal separator, no thousands
  // separator, always 2 decimal places.
  return (cents / 100).toFixed(2).replace(".", ",");
}

function formatDatevDate(iso: string): string {
  // DDMMYYYY, the standard DATEV Belegdatum format.
  const d = new Date(iso);
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = d.getUTCFullYear();
  return `${dd}${mm}${yyyy}`;
}

function formatGenerationTimestamp(date: Date): string {
  // YYYYMMDDHHmmssfff, per DATEV EXTF header conventions.
  const pad = (n: number, len = 2) => String(n).padStart(len, "0");
  return (
    `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}` +
    `${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}${pad(date.getUTCMilliseconds(), 3)}`
  );
}

/**
 * Builds the full DATEV EXTF-adjacent CSV body (metadata row + column header
 * row + data rows) as a string. Callers are responsible for encoding the
 * result to cp1252 bytes before writing the HTTP response (see
 * lib/csv/toDatevCsv.ts's encodeCp1252) -- kept as a separate step so this
 * function stays trivially testable with plain JS strings.
 */
export function buildDatevInvoiceExport(rows: DatevInvoiceRow[], generatedAt: Date = new Date()): string {
  const fiscalYear = generatedAt.getUTCFullYear();

  // Row 1: DATEV EXTF metadata line. Field order/count follows the public
  // EXTF specification for a generic data export; several positional fields
  // (Beraternummer, Mandantennummer, SKR, Branchen-Lösung-ID) are left at 0
  // /empty here because this app has no chart-of-accounts / DATEV client
  // config yet (see module doc comment above) -- a v2 full Buchungsstapel
  // export would need those filled in from organization-level settings.
  const metadataLine = [
    "EXTF",
    "700", // format version
    "21", // format category: generic "Rechnungsdaten" export category
    "Rechnungsdaten hantverkare",
    "12",
    formatGenerationTimestamp(generatedAt),
    "",
    "RE",
    "hantverkare",
    "0", // Beraternummer (not modeled yet)
    "0", // Mandantennummer (not modeled yet)
    `${fiscalYear}0101`, // fiscal year start (assumes calendar-year fiscal year)
    "0",
    `${fiscalYear}0101`,
    `${fiscalYear}1231`,
    "Rechnungen",
    "",
    "1",
    "",
    "",
    "0",
    "0",
  ].join(";");

  const columnHeaders = [
    "Belegfeld 1 (Rechnungsnummer)",
    "Belegdatum",
    "Kunde",
    "Beschreibung",
    "Nettobetrag",
    "USt-Betrag",
    "Bruttobetrag",
    "Storniert",
    "Gutschrift zu Rechnung",
  ];

  const dataRows = rows.map((r) => [
    r.invoiceNumber,
    formatDatevDate(r.issuedAt),
    r.customerName,
    r.description,
    centsToDatevAmount(r.subtotalCents),
    centsToDatevAmount(r.vatCents),
    centsToDatevAmount(r.totalCents),
    r.voided ? "1" : "0",
    r.creditNoteFor ?? "",
  ]);

  return toDatevCsv([metadataLine], columnHeaders, dataRows);
}
