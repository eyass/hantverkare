import { describe, it, expect } from "vitest";
import { toCsv } from "./toCsv";

describe("toCsv", () => {
  it("builds a simple CSV with headers and rows", () => {
    const result = toCsv(["Name", "Betrag"], [["Max Mustermann", "129.99"]]);
    expect(result).toBe("Name,Betrag\r\nMax Mustermann,129.99\r\n");
  });

  it("escapes fields containing a comma", () => {
    const result = toCsv(["Name"], [["Müller, GmbH"]]);
    expect(result).toBe('Name\r\n"Müller, GmbH"\r\n');
  });

  it("escapes fields containing double quotes by doubling them", () => {
    const result = toCsv(["Name"], [['Der "Beste" Handwerker']]);
    expect(result).toBe('Name\r\n"Der ""Beste"" Handwerker"\r\n');
  });

  it("escapes fields containing newlines", () => {
    const result = toCsv(["Adresse"], [["Musterstraße 1\nBerlin"]]);
    expect(result).toBe('Adresse\r\n"Musterstraße 1\nBerlin"\r\n');
  });

  it("escapes fields containing carriage returns", () => {
    const result = toCsv(["Adresse"], [["Musterstraße 1\r\nBerlin"]]);
    expect(result).toBe('Adresse\r\n"Musterstraße 1\r\nBerlin"\r\n');
  });

  it("leaves plain fields unescaped", () => {
    const result = toCsv(["A", "B"], [["hello", "world"]]);
    expect(result).toBe("A,B\r\nhello,world\r\n");
  });

  it("handles empty rows list, producing just the header line", () => {
    const result = toCsv(["A", "B"], []);
    expect(result).toBe("A,B\r\n");
  });

  it("handles fields that are the empty string", () => {
    const result = toCsv(["A", "B"], [["", "x"]]);
    expect(result).toBe("A,B\r\n,x\r\n");
  });

  it("handles multiple rows", () => {
    const result = toCsv(
      ["Name"],
      [["Anna"], ["Bert"], ["Clara, Inc."]],
    );
    expect(result).toBe('Name\r\nAnna\r\nBert\r\n"Clara, Inc."\r\n');
  });

  it("neutralizes formula injection for fields starting with =", () => {
    const result = toCsv(["Name"], [['=HYPERLINK("http://evil.com")']]);
    expect(result).toBe('Name\r\n"\'=HYPERLINK(""http://evil.com"")"\r\n');
  });

  it("prefixes fields starting with + (e.g. phone numbers) but keeps them readable as text", () => {
    const result = toCsv(["Telefon"], [["+49 30 1234567"]]);
    expect(result).toBe("Telefon\r\n'+49 30 1234567\r\n");
  });

  it("neutralizes formula injection for fields starting with -", () => {
    const result = toCsv(["Name"], [["-2+3"]]);
    expect(result).toBe("Name\r\n'-2+3\r\n");
  });

  it("neutralizes formula injection for fields starting with @", () => {
    const result = toCsv(["Name"], [["@SUM(1+1)"]]);
    expect(result).toBe("Name\r\n'@SUM(1+1)\r\n");
  });

  it("does not prefix normal fields not starting with =, +, -, or @", () => {
    const result = toCsv(["Name"], [["Max Mustermann"]]);
    expect(result).toBe("Name\r\nMax Mustermann\r\n");
  });
});
