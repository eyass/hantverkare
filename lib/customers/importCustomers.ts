import { parseCsvWithHeader } from "../csv/fromCsv";

export type ParsedCustomerRow = {
  /** 1-based row number as it appears in the uploaded file (header = row 1). */
  rowNumber: number;
  name: string;
  email: string;
  phone: string;
  address: string;
};

export type CustomerRowError = {
  rowNumber: number;
  message: string;
};

export type CustomerImportPreview = {
  /** Rows that passed validation and are ready to insert. */
  validRows: ParsedCustomerRow[];
  /** Rows that failed validation, with a human-readable (German) reason. */
  errors: CustomerRowError[];
};

// Same set of recognized header aliases in German and English so a user
// exporting from this app (issue #51) or from a spreadsheet in either
// language can re-import without renaming columns.
const HEADER_ALIASES: Record<string, keyof Omit<ParsedCustomerRow, "rowNumber">> = {
  name: "name",
  "e-mail": "email",
  email: "email",
  telefon: "phone",
  phone: "phone",
  adresse: "address",
  address: "address",
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase();
}

/**
 * Parses raw CSV text (name/email/phone/address columns, header required)
 * into validated rows ready for preview + bulk insert. Pure function -- no
 * I/O, no org resolution -- so it can be unit-tested and reused by both the
 * preview step and the commit step without re-parsing differently.
 *
 * Validation rules (mirrors the single-customer form in actions.ts):
 * - `name` is required (non-empty after trim).
 * - `email`, if present, must look like an email address.
 * - a row with the wrong number of columns is rejected with a clear error
 *   rather than silently padded/truncated.
 */
export function parseCustomerImport(csvText: string): CustomerImportPreview {
  const { headers, rows } = parseCsvWithHeader(csvText);

  if (headers.length === 0) {
    return { validRows: [], errors: [] };
  }

  const columnMap = new Map<number, keyof Omit<ParsedCustomerRow, "rowNumber">>();
  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    const field = HEADER_ALIASES[normalized];
    if (field) {
      columnMap.set(index, field);
    }
  });

  const validRows: ParsedCustomerRow[] = [];
  const errors: CustomerRowError[] = [];

  if (!Array.from(columnMap.values()).includes("name")) {
    errors.push({
      rowNumber: 1,
      message:
        'Die Kopfzeile muss eine Spalte "Name" enthalten (erkannte Spalten: Name, E-Mail, Telefon, Adresse).',
    });
    return { validRows, errors };
  }

  rows.forEach((fields, index) => {
    const rowNumber = index + 2; // +1 for header row, +1 for 1-based numbering
    if (fields.length !== headers.length) {
      errors.push({
        rowNumber,
        message: `Zeile hat ${fields.length} Spalten, erwartet wurden ${headers.length}.`,
      });
      return;
    }

    const values: Record<string, string> = { name: "", email: "", phone: "", address: "" };
    columnMap.forEach((field, columnIndex) => {
      values[field] = (fields[columnIndex] ?? "").trim();
    });

    if (values.name.length === 0) {
      errors.push({ rowNumber, message: "Name darf nicht leer sein." });
      return;
    }

    if (values.email.length > 0 && !EMAIL_PATTERN.test(values.email)) {
      errors.push({ rowNumber, message: `Ungültige E-Mail-Adresse: "${values.email}".` });
      return;
    }

    validRows.push({
      rowNumber,
      name: values.name,
      email: values.email,
      phone: values.phone,
      address: values.address,
    });
  });

  return { validRows, errors };
}
