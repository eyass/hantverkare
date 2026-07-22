import { describe, it, expect } from "vitest";
import { parseCustomerImport } from "./importCustomers";

describe("parseCustomerImport", () => {
  it("parses valid rows with all columns present", () => {
    const csv =
      "Name,E-Mail,Telefon,Adresse\r\nMax Mustermann,max@example.com,+49 30 1234567,Musterstraße 1\r\n";
    const result = parseCustomerImport(csv);
    expect(result.errors).toEqual([]);
    expect(result.validRows).toEqual([
      {
        rowNumber: 2,
        name: "Max Mustermann",
        email: "max@example.com",
        phone: "+49 30 1234567",
        address: "Musterstraße 1",
      },
    ]);
  });

  it("accepts English header aliases", () => {
    const csv = "Name,Email,Phone,Address\r\nAnna,anna@example.com,123,Berlin\r\n";
    const result = parseCustomerImport(csv);
    expect(result.errors).toEqual([]);
    expect(result.validRows).toHaveLength(1);
  });

  it("allows optional columns to be missing entirely", () => {
    const csv = "Name\r\nAnna\r\n";
    const result = parseCustomerImport(csv);
    expect(result.errors).toEqual([]);
    expect(result.validRows).toEqual([
      { rowNumber: 2, name: "Anna", email: "", phone: "", address: "" },
    ]);
  });

  it("rejects a row with an empty name", () => {
    const csv = "Name,E-Mail\r\n,max@example.com\r\n";
    const result = parseCustomerImport(csv);
    expect(result.validRows).toEqual([]);
    expect(result.errors).toEqual([{ rowNumber: 2, message: "Name darf nicht leer sein." }]);
  });

  it("rejects a row with a malformed email", () => {
    const csv = "Name,E-Mail\r\nAnna,not-an-email\r\n";
    const result = parseCustomerImport(csv);
    expect(result.validRows).toEqual([]);
    expect(result.errors).toEqual([
      { rowNumber: 2, message: 'Ungültige E-Mail-Adresse: "not-an-email".' },
    ]);
  });

  it("reports errors for some rows while keeping other valid rows importable", () => {
    const csv = "Name,E-Mail\r\nAnna,anna@example.com\r\n,bad@example.com\r\nBert,not-an-email\r\n";
    const result = parseCustomerImport(csv);
    expect(result.validRows).toEqual([
      { rowNumber: 2, name: "Anna", email: "anna@example.com", phone: "", address: "" },
    ]);
    expect(result.errors).toEqual([
      { rowNumber: 3, message: "Name darf nicht leer sein." },
      { rowNumber: 4, message: 'Ungültige E-Mail-Adresse: "not-an-email".' },
    ]);
  });

  it("handles quoted fields with embedded commas (customer name with a comma)", () => {
    const csv = 'Name,E-Mail\r\n"Müller, GmbH",info@mueller.de\r\n';
    const result = parseCustomerImport(csv);
    expect(result.errors).toEqual([]);
    expect(result.validRows[0].name).toBe("Müller, GmbH");
  });

  it("handles quoted fields with embedded newlines (multi-line address)", () => {
    const csv = 'Name,Adresse\r\nAnna,"Musterstraße 1\nBerlin"\r\n';
    const result = parseCustomerImport(csv);
    expect(result.errors).toEqual([]);
    expect(result.validRows[0].address).toBe("Musterstraße 1\nBerlin");
  });

  it("rejects a row with the wrong number of columns", () => {
    const csv = "Name,E-Mail,Telefon\r\nAnna,anna@example.com\r\n";
    const result = parseCustomerImport(csv);
    expect(result.validRows).toEqual([]);
    expect(result.errors).toEqual([
      { rowNumber: 2, message: "Zeile hat 2 Spalten, erwartet wurden 3." },
    ]);
  });

  it("requires a Name column in the header", () => {
    const csv = "E-Mail,Telefon\r\nmax@example.com,123\r\n";
    const result = parseCustomerImport(csv);
    expect(result.validRows).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0].message).toMatch(/Name/);
  });

  it("returns no rows and no errors for an empty file", () => {
    const result = parseCustomerImport("");
    expect(result.validRows).toEqual([]);
    expect(result.errors).toEqual([]);
  });

  it("trims whitespace from field values", () => {
    const csv = "Name,E-Mail\r\n  Anna  ,  anna@example.com  \r\n";
    const result = parseCustomerImport(csv);
    expect(result.validRows[0].name).toBe("Anna");
    expect(result.validRows[0].email).toBe("anna@example.com");
  });
});
