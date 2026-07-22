import { parseCsvWithHeader } from "../csv/fromCsv";

export type ParsedPriceListRow = {
  /** 1-based row number as it appears in the uploaded file (header = row 1). */
  rowNumber: number;
  label: string;
  unit: string;
  unitPriceCents: number;
  category: string;
};

export type PriceListRowError = {
  rowNumber: number;
  message: string;
};

export type PriceListImportPreview = {
  /** Rows that passed validation and are ready to upsert. */
  validRows: ParsedPriceListRow[];
  /** Rows that failed validation, with a human-readable (German) reason. */
  errors: PriceListRowError[];
};

// Same German/English header alias approach as lib/customers/importCustomers.ts,
// including the header this app's own CSV export would use (see toCsv usage
// convention) so a re-exported/edited price list round-trips without renaming
// columns.
const HEADER_ALIASES: Record<string, keyof Omit<ParsedPriceListRow, "rowNumber">> = {
  bezeichnung: "label",
  label: "label",
  name: "label",
  einheit: "unit",
  unit: "unit",
  "preis (eur)": "unitPriceCents",
  preis: "unitPriceCents",
  price: "unitPriceCents",
  kategorie: "category",
  category: "category",
};

function normalizeHeader(header: string): string {
  return header.trim().toLowerCase();
}

/**
 * Parses a decimal EUR string (e.g. "12,50" or "12.50") into integer cents.
 * Returns null if the value doesn't look like a positive number.
 */
function parsePriceToCents(raw: string): number | null {
  const normalized = raw.trim().replace(",", ".");
  if (normalized.length === 0) {
    return null;
  }
  const value = Number(normalized);
  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }
  return Math.round(value * 100);
}

/**
 * Parses raw CSV text (label/unit/unitPrice/category columns, header
 * required) into validated rows ready for preview + bulk upsert. Pure
 * function -- no I/O, no org resolution -- mirrors
 * lib/customers/importCustomers.ts's parseCustomerImport so both the preview
 * step and the commit step re-parse identically rather than trusting
 * client-supplied row objects.
 *
 * Validation rules (mirrors the single-item form in
 * app/(app)/price-list/actions.ts's validateInput):
 * - `label` and `unit` are required (non-empty after trim).
 * - `unitPrice` is required and must parse to a positive number.
 * - `category` is required (the column is NOT NULL in the schema).
 * - a row with the wrong number of columns is rejected with a clear error
 *   rather than silently padded/truncated.
 */
export function parsePriceListImport(csvText: string): PriceListImportPreview {
  const { headers, rows } = parseCsvWithHeader(csvText);

  if (headers.length === 0) {
    return { validRows: [], errors: [] };
  }

  const columnMap = new Map<number, keyof Omit<ParsedPriceListRow, "rowNumber">>();
  headers.forEach((header, index) => {
    const normalized = normalizeHeader(header);
    const field = HEADER_ALIASES[normalized];
    if (field) {
      columnMap.set(index, field);
    }
  });

  const validRows: ParsedPriceListRow[] = [];
  const errors: PriceListRowError[] = [];

  const mappedFields = new Set(columnMap.values());
  const requiredFields: Array<{ field: keyof Omit<ParsedPriceListRow, "rowNumber">; label: string }> = [
    { field: "label", label: "Bezeichnung" },
    { field: "unit", label: "Einheit" },
    { field: "unitPriceCents", label: "Preis" },
    { field: "category", label: "Kategorie" },
  ];
  const missingFields = requiredFields.filter((f) => !mappedFields.has(f.field));
  if (missingFields.length > 0) {
    errors.push({
      rowNumber: 1,
      message: `Die Kopfzeile muss die Spalten ${requiredFields
        .map((f) => f.label)
        .join(", ")} enthalten (fehlend: ${missingFields.map((f) => f.label).join(", ")}).`,
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

    const values: Record<string, string> = { label: "", unit: "", unitPriceCents: "", category: "" };
    columnMap.forEach((field, columnIndex) => {
      values[field] = (fields[columnIndex] ?? "").trim();
    });

    if (values.label.length === 0) {
      errors.push({ rowNumber, message: "Bezeichnung darf nicht leer sein." });
      return;
    }
    if (values.unit.length === 0) {
      errors.push({ rowNumber, message: "Einheit darf nicht leer sein." });
      return;
    }
    if (values.category.length === 0) {
      errors.push({ rowNumber, message: "Kategorie darf nicht leer sein." });
      return;
    }

    const unitPriceCents = parsePriceToCents(values.unitPriceCents);
    if (unitPriceCents === null) {
      errors.push({ rowNumber, message: `Ungültiger Preis: "${values.unitPriceCents}".` });
      return;
    }

    validRows.push({
      rowNumber,
      label: values.label,
      unit: values.unit,
      unitPriceCents,
      category: values.category,
    });
  });

  return { validRows, errors };
}
