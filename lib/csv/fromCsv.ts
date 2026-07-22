// Pure, hand-rolled RFC 4180-ish CSV parser -- the inverse of toCsv.ts. Handles
// quoted fields (with embedded commas, newlines, and escaped "" quotes),
// CRLF/LF/CR line endings, and a trailing-newline-or-not final row.
//
// Note: this does NOT reverse the formula-injection prefix that toCsv adds
// (leading single-quote before =+-@). That prefix is intentionally kept as
// literal text on import too -- stripping it here would let a re-imported
// export re-introduce a formula-injection payload.

/**
 * Parses RFC 4180 CSV text into rows of string fields. Every row (including
 * the header, if any) has the same handling; callers decide how to treat the
 * first row. Returns an empty array for empty/whitespace-only input.
 */
export function fromCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }

    if (char === ",") {
      endField();
      i += 1;
      continue;
    }

    if (char === "\r") {
      endRow();
      // Swallow a following \n so CRLF counts as one line break.
      if (text[i + 1] === "\n") {
        i += 2;
      } else {
        i += 1;
      }
      continue;
    }

    if (char === "\n") {
      endRow();
      i += 1;
      continue;
    }

    field += char;
    i += 1;
  }

  // Flush a trailing field/row if the text didn't end with a line break.
  if (field.length > 0 || row.length > 0) {
    endRow();
  }

  return rows;
}

/**
 * Convenience wrapper: parses CSV text with a header row and returns each
 * data row as an object keyed by (trimmed) header name. Rows shorter than the
 * header are padded with "", rows longer are truncated to the header length --
 * callers that need to detect malformed row lengths should use `fromCsv`
 * directly instead.
 */
export function parseCsvWithHeader(text: string): { headers: string[]; rows: string[][] } {
  const allRows = fromCsv(text);
  if (allRows.length === 0) {
    return { headers: [], rows: [] };
  }
  const [headers, ...rows] = allRows;
  return { headers: headers.map((h) => h.trim()), rows };
}
