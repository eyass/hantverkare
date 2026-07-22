import { describe, it, expect } from "vitest";
import { parsePriceListImport } from "./importPriceList";

describe("parsePriceListImport", () => {
  it("parses valid rows with all columns present", () => {
    const csv =
      "Bezeichnung,Einheit,Preis (EUR),Kategorie\r\nFliesen verlegen,m²,45.50,Boden\r\n";
    const result = parsePriceListImport(csv);
    expect(result.errors).toEqual([]);
    expect(result.validRows).toEqual([
      {
        rowNumber: 2,
        label: "Fliesen verlegen",
        unit: "m²",
        unitPriceCents: 4550,
        category: "Boden",
      },
    ]);
  });

  it("accepts English header aliases", () => {
    const csv = "Label,Unit,Price,Category\r\nPaint wall,m2,12.00,Paint\r\n";
    const result = parsePriceListImport(csv);
    expect(result.errors).toEqual([]);
    expect(result.validRows).toHaveLength(1);
  });

  it("accepts a German decimal-comma price when the field is quoted", () => {
    // An unquoted comma-decimal would break the column count, so this repo's
    // convention (see toCsv.ts) is to format exported prices with a dot; a
    // comma decimal is only supported when it appears inside a quoted field.
    const csv = 'Bezeichnung,Einheit,Preis,Kategorie\r\nFliesen,m²,"45,50",Boden\r\n';
    const result = parsePriceListImport(csv);
    expect(result.errors).toEqual([]);
    expect(result.validRows[0].unitPriceCents).toBe(4550);
  });

  it("rejects a row with an empty label", () => {
    const csv = "Bezeichnung,Einheit,Preis,Kategorie\r\n,m²,10,Boden\r\n";
    const result = parsePriceListImport(csv);
    expect(result.validRows).toEqual([]);
    expect(result.errors).toEqual([{ rowNumber: 2, message: "Bezeichnung darf nicht leer sein." }]);
  });

  it("rejects a row with an empty unit", () => {
    const csv = "Bezeichnung,Einheit,Preis,Kategorie\r\nFliesen,,10,Boden\r\n";
    const result = parsePriceListImport(csv);
    expect(result.errors).toEqual([{ rowNumber: 2, message: "Einheit darf nicht leer sein." }]);
  });

  it("rejects a row with an empty category", () => {
    const csv = "Bezeichnung,Einheit,Preis,Kategorie\r\nFliesen,m²,10,\r\n";
    const result = parsePriceListImport(csv);
    expect(result.errors).toEqual([{ rowNumber: 2, message: "Kategorie darf nicht leer sein." }]);
  });

  it("rejects a row with a non-numeric price", () => {
    const csv = "Bezeichnung,Einheit,Preis,Kategorie\r\nFliesen,m²,abc,Boden\r\n";
    const result = parsePriceListImport(csv);
    expect(result.errors).toEqual([{ rowNumber: 2, message: 'Ungültiger Preis: "abc".' }]);
  });

  it("rejects a row with a zero or negative price", () => {
    const csv = "Bezeichnung,Einheit,Preis,Kategorie\r\nFliesen,m²,0,Boden\r\n";
    const result = parsePriceListImport(csv);
    expect(result.errors).toEqual([{ rowNumber: 2, message: 'Ungültiger Preis: "0".' }]);
  });

  it("reports errors for some rows while keeping other valid rows importable", () => {
    const csv =
      "Bezeichnung,Einheit,Preis,Kategorie\r\nFliesen,m²,10,Boden\r\n,m²,10,Boden\r\nWand,m²,x,Wand\r\n";
    const result = parsePriceListImport(csv);
    expect(result.validRows).toEqual([
      { rowNumber: 2, label: "Fliesen", unit: "m²", unitPriceCents: 1000, category: "Boden" },
    ]);
    expect(result.errors).toEqual([
      { rowNumber: 3, message: "Bezeichnung darf nicht leer sein." },
      { rowNumber: 4, message: 'Ungültiger Preis: "x".' },
    ]);
  });

  it("rejects a row with the wrong number of columns", () => {
    const csv = "Bezeichnung,Einheit,Preis,Kategorie\r\nFliesen,m²,10\r\n";
    const result = parsePriceListImport(csv);
    expect(result.validRows).toEqual([]);
    expect(result.errors).toEqual([
      { rowNumber: 2, message: "Zeile hat 3 Spalten, erwartet wurden 4." },
    ]);
  });

  it("requires all required columns in the header", () => {
    const csv = "Bezeichnung,Einheit\r\nFliesen,m²\r\n";
    const result = parsePriceListImport(csv);
    expect(result.validRows).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toMatch(/Preis/);
    expect(result.errors[0].message).toMatch(/Kategorie/);
  });

  it("returns no rows and no errors for an empty file", () => {
    const result = parsePriceListImport("");
    expect(result.validRows).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("trims whitespace from field values", () => {
    const csv = "Bezeichnung,Einheit,Preis,Kategorie\r\n  Fliesen  ,  m²  ,  10  ,  Boden  \r\n";
    const result = parsePriceListImport(csv);
    expect(result.validRows[0].label).toBe("Fliesen");
    expect(result.validRows[0].unit).toBe("m²");
    expect(result.validRows[0].category).toBe("Boden");
  });
});
