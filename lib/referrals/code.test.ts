import { describe, it, expect } from "vitest";
import { generateReferralCode, isValidReferralCodeFormat, normalizeReferralCode } from "./code";

describe("generateReferralCode", () => {
  it("generates an 8-character code", () => {
    expect(generateReferralCode()).toHaveLength(8);
  });

  it("only uses unambiguous alphanumeric characters", () => {
    for (let i = 0; i < 50; i += 1) {
      expect(generateReferralCode()).toMatch(/^[A-Z2-9]+$/);
      expect(generateReferralCode()).not.toMatch(/[0O1I]/);
    }
  });

  it("generates codes that pass isValidReferralCodeFormat", () => {
    for (let i = 0; i < 20; i += 1) {
      expect(isValidReferralCodeFormat(generateReferralCode())).toBe(true);
    }
  });
});

describe("isValidReferralCodeFormat", () => {
  it("rejects null/undefined/empty", () => {
    expect(isValidReferralCodeFormat(null)).toBe(false);
    expect(isValidReferralCodeFormat(undefined)).toBe(false);
    expect(isValidReferralCodeFormat("")).toBe(false);
  });

  it("rejects codes that are too short or too long", () => {
    expect(isValidReferralCodeFormat("AB")).toBe(false);
    expect(isValidReferralCodeFormat("A".repeat(33))).toBe(false);
  });

  it("rejects non-alphanumeric input (defends against injection-ish garbage)", () => {
    expect(isValidReferralCodeFormat("AB CD1234")).toBe(false);
    expect(isValidReferralCodeFormat("../../etc")).toBe(false);
    expect(isValidReferralCodeFormat("AB;DROP TABLE")).toBe(false);
    expect(isValidReferralCodeFormat("<script>1234</script>")).toBe(false);
  });

  it("accepts well-formed alphanumeric codes", () => {
    expect(isValidReferralCodeFormat("ABCD1234")).toBe(true);
    expect(isValidReferralCodeFormat("abcd1234")).toBe(true);
  });
});

describe("normalizeReferralCode", () => {
  it("uppercases and trims", () => {
    expect(normalizeReferralCode("  abcd1234  ")).toBe("ABCD1234");
  });
});
