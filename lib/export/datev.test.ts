import { describe, it, expect } from "vitest";
import { buildDatevInvoiceExport, type DatevInvoiceRow } from "./datev";

const baseRow: DatevInvoiceRow = {
  invoiceNumber: "RE-2026-0001",
  issuedAt: "2026-03-15T00:00:00.000Z",
  customerName: "Max Mustermann",
  description: "Badrenovierung",
  subtotalCents: 100000,
  vatCents: 19000,
  totalCents: 119000,
  voided: false,
  creditNoteFor: null,
};

describe("buildDatevInvoiceExport", () => {
  it("starts with an EXTF metadata line", () => {
    const csv = buildDatevInvoiceExport([baseRow], new Date("2026-07-22T10:00:00.000Z"));
    const lines = csv.split("\r\n");
    expect(lines[0].startsWith("EXTF;")).toBe(true);
  });

  it("includes the column header row after the metadata line", () => {
    const csv = buildDatevInvoiceExport([baseRow], new Date("2026-07-22T10:00:00.000Z"));
    const lines = csv.split("\r\n");
    expect(lines[1]).toContain("Belegfeld 1 (Rechnungsnummer)");
  });

  it("formats amounts with comma decimal separator", () => {
    const csv = buildDatevInvoiceExport([baseRow], new Date("2026-07-22T10:00:00.000Z"));
    expect(csv).toContain("1000,00");
    expect(csv).toContain("190,00");
    expect(csv).toContain("1190,00");
  });

  it("formats Belegdatum as DDMMYYYY", () => {
    const csv = buildDatevInvoiceExport([baseRow], new Date("2026-07-22T10:00:00.000Z"));
    expect(csv).toContain("15032026");
  });

  it("marks voided invoices and credit-note linkage", () => {
    const voided: DatevInvoiceRow = { ...baseRow, voided: true };
    const creditNote: DatevInvoiceRow = {
      ...baseRow,
      invoiceNumber: "RE-2026-0002",
      creditNoteFor: "RE-2026-0001",
    };
    const csv = buildDatevInvoiceExport([voided, creditNote], new Date("2026-07-22T10:00:00.000Z"));
    const lines = csv.split("\r\n");
    expect(lines[2].split(";")).toContain("1");
    expect(lines[3]).toContain("RE-2026-0001");
  });

  it("uses CRLF line endings and ends with a trailing CRLF", () => {
    const csv = buildDatevInvoiceExport([baseRow], new Date("2026-07-22T10:00:00.000Z"));
    expect(csv.endsWith("\r\n")).toBe(true);
    expect(csv).toContain("\r\n");
  });
});
