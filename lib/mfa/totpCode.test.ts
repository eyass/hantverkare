import { describe, expect, it } from "vitest";
import { normalizeTotpCode } from "./totpCode";

describe("normalizeTotpCode", () => {
  it("accepts a plain 6-digit code", () => {
    expect(normalizeTotpCode("123456")).toBe("123456");
  });

  it("strips grouping whitespace", () => {
    expect(normalizeTotpCode("123 456")).toBe("123456");
    expect(normalizeTotpCode(" 123456 ")).toBe("123456");
  });

  it("rejects codes that are too short or too long", () => {
    expect(normalizeTotpCode("12345")).toBeNull();
    expect(normalizeTotpCode("1234567")).toBeNull();
  });

  it("rejects non-numeric input", () => {
    expect(normalizeTotpCode("12345a")).toBeNull();
    expect(normalizeTotpCode("")).toBeNull();
  });
});
