import { describe, it, expect } from "vitest";
import { fromCsv, parseCsvWithHeader } from "./fromCsv";

describe("fromCsv", () => {
  it("parses a simple CSV with headers and rows", () => {
    const result = fromCsv("Name,Betrag\r\nMax Mustermann,129.99\r\n");
    expect(result).toEqual([
      ["Name", "Betrag"],
      ["Max Mustermann", "129.99"],
    ]);
  });

  it("parses quoted fields containing a comma", () => {
    const result = fromCsv('Name\r\n"Müller, GmbH"\r\n');
    expect(result).toEqual([["Name"], ["Müller, GmbH"]]);
  });

  it("parses fields with doubled (escaped) quotes", () => {
    const result = fromCsv('Name\r\n"Der ""Beste"" Handwerker"\r\n');
    expect(result).toEqual([["Name"], ['Der "Beste" Handwerker']]);
  });

  it("parses quoted fields containing embedded newlines", () => {
    const result = fromCsv('Adresse\r\n"Musterstraße 1\nBerlin"\r\n');
    expect(result).toEqual([["Adresse"], ["Musterstraße 1\nBerlin"]]);
  });

  it("parses quoted fields containing embedded carriage returns", () => {
    const result = fromCsv('Adresse\r\n"Musterstraße 1\r\nBerlin"\r\n');
    expect(result).toEqual([["Adresse"], ["Musterstraße 1\r\nBerlin"]]);
  });

  it("parses plain unescaped fields", () => {
    const result = fromCsv("A,B\r\nhello,world\r\n");
    expect(result).toEqual([
      ["A", "B"],
      ["hello", "world"],
    ]);
  });

  it("handles empty input, producing no rows", () => {
    expect(fromCsv("")).toEqual([]);
  });

  it("handles fields that are the empty string", () => {
    const result = fromCsv("A,B\r\n,x\r\n");
    expect(result).toEqual([
      ["A", "B"],
      ["", "x"],
    ]);
  });

  it("handles multiple rows", () => {
    const result = fromCsv('Name\r\nAnna\r\nBert\r\n"Clara, Inc."\r\n');
    expect(result).toEqual([["Name"], ["Anna"], ["Bert"], ["Clara, Inc."]]);
  });

  it("handles a trailing row with no final line break", () => {
    const result = fromCsv("A,B\r\nhello,world");
    expect(result).toEqual([
      ["A", "B"],
      ["hello", "world"],
    ]);
  });

  it("handles bare LF line endings (not just CRLF)", () => {
    const result = fromCsv("A,B\nhello,world\n");
    expect(result).toEqual([
      ["A", "B"],
      ["hello", "world"],
    ]);
  });

  it("handles bare CR line endings", () => {
    const result = fromCsv("A,B\rhello,world\r");
    expect(result).toEqual([
      ["A", "B"],
      ["hello", "world"],
    ]);
  });

  it("preserves a leading formula-injection-neutralizing quote as literal text", () => {
    // toCsv prefixes =+-@ fields with a leading ' and wraps+doubles quotes
    // when the field itself contains a ". On import that prefix should
    // round-trip as plain text, not be stripped back out.
    const result = fromCsv('Name\r\n"\'=HYPERLINK(""http://evil.com"")"\r\n');
    expect(result).toEqual([["Name"], ['\'=HYPERLINK("http://evil.com")']]);
  });

  it("round-trips a field with a trailing empty column", () => {
    const result = fromCsv("A,B,C\r\na,b,\r\n");
    expect(result).toEqual([
      ["A", "B", "C"],
      ["a", "b", ""],
    ]);
  });
});

describe("parseCsvWithHeader", () => {
  it("splits header from data rows and trims header whitespace", () => {
    const result = parseCsvWithHeader("Name, E-Mail \r\nMax,max@example.com\r\n");
    expect(result.headers).toEqual(["Name", "E-Mail"]);
    expect(result.rows).toEqual([["Max", "max@example.com"]]);
  });

  it("returns empty headers and rows for empty input", () => {
    const result = parseCsvWithHeader("");
    expect(result).toEqual({ headers: [], rows: [] });
  });

  it("returns an empty rows list when only a header line is present", () => {
    const result = parseCsvWithHeader("Name,E-Mail\r\n");
    expect(result.headers).toEqual(["Name", "E-Mail"]);
    expect(result.rows).toEqual([]);
  });
});
