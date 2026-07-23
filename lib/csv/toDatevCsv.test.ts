import { describe, it, expect } from "vitest";
import { toDatevCsv, encodeCp1252 } from "./toDatevCsv";

describe("toDatevCsv", () => {
  it("joins header lines, column headers, and rows with semicolons and CRLF", () => {
    const result = toDatevCsv(["EXTF;700"], ["Name", "Betrag"], [["Max Mustermann", "129,99"]]);
    expect(result).toBe("EXTF;700\r\nName;Betrag\r\nMax Mustermann;129,99\r\n");
  });

  it("quotes fields containing a semicolon", () => {
    const result = toDatevCsv([], ["Name"], [["Müller; GmbH"]]);
    expect(result).toBe('Name\r\n"Müller; GmbH"\r\n');
  });

  it("doubles embedded quotes", () => {
    const result = toDatevCsv([], ["Name"], [['Der "Beste" Handwerker']]);
    expect(result).toBe('Name\r\n"Der ""Beste"" Handwerker"\r\n');
  });
});

describe("encodeCp1252", () => {
  it("encodes German umlauts to their single-byte cp1252 codes", () => {
    const buf = encodeCp1252("Müller Straße");
    // 'ü' = 0xFC, 'ß' = 0xDF in both latin1 and cp1252.
    expect(buf.includes(0xfc)).toBe(true);
    expect(buf.includes(0xdf)).toBe(true);
  });

  it("replaces characters outside the 0x00-0xFF range with '?'", () => {
    const buf = encodeCp1252("Hallo 😀");
    expect(buf.toString("latin1")).toBe("Hallo ??"); // surrogate pair -> two '?' chars
  });
});
