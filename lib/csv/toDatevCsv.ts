// Semicolon-delimited CSV builder for the DATEV export, mirroring toCsv.ts's
// escaping logic but with the delimiter/quoting conventions DATEV expects
// (semicolon-separated, CRLF line endings). Kept separate from toCsv.ts
// rather than parameterizing the delimiter there, since DATEV's quoting is
// simpler (DATEV fields are almost never comma/semicolon-ambiguous the way
// generic CSV consumers are) and mixing the two would make toCsv.ts harder
// to read for its existing (comma) callers.

function escapeDatevField(value: string): string {
  if (value.includes(";") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

/**
 * Builds a semicolon-delimited CSV string. `headerLines` are written
 * verbatim (already delimiter-joined) before `columnHeaders` -- this is
 * where the DATEV EXTF metadata row goes, which has a fixed positional
 * format rather than free-form escaped fields.
 */
export function toDatevCsv(headerLines: string[], columnHeaders: string[], rows: string[][]): string {
  const dataLines = [columnHeaders, ...rows].map((fields) => fields.map(escapeDatevField).join(";"));
  return [...headerLines, ...dataLines].join("\r\n") + "\r\n";
}

/**
 * Encodes a string to Windows-1252 (cp1252) bytes, which is what DATEV's
 * EXTF import expects rather than UTF-8. Node has no built-in cp1252
 * encoder, so this uses Buffer's "latin1" encoding as an approximation:
 * cp1252 and latin1 (ISO-8859-1) are identical for all code points except
 * 0x80-0x9F (curly quotes, em-dash, euro sign, etc.), which German business
 * text (customer names/addresses, invoice reasons) essentially never uses.
 * Any character outside the 0x00-0xFF range (e.g. emoji) is replaced with
 * "?" rather than silently corrupting the byte stream.
 */
export function encodeCp1252(text: string): Buffer {
  const sanitized = Array.from(text)
    .map((ch) => (ch.codePointAt(0)! <= 0xff ? ch : "?"))
    .join("");
  return Buffer.from(sanitized, "latin1");
}
