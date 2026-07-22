// Pure, hand-rolled RFC 4180-ish CSV serializer. No external dependency needed
// for the simple "headers + rows of strings" shape our export routes produce.

function escapeCsvField(value: string): string {
  // Neutralize CSV/formula injection: if a field starts with a character
  // that spreadsheet software (Excel, Google Sheets, LibreOffice) would
  // interpret as the start of a formula, prefix it with a single quote so
  // it is rendered as literal text instead of being executed.
  if (/^[=+\-@]/.test(value)) {
    value = `'${value}`;
  }
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Builds a CSV string from headers and rows. Each row must have the same
 * number of fields as `headers`. Uses CRLF line endings per RFC 4180.
 */
export function toCsv(headers: string[], rows: string[][]): string {
  const lines = [headers, ...rows].map((fields) => fields.map(escapeCsvField).join(","));
  return lines.join("\r\n") + "\r\n";
}
