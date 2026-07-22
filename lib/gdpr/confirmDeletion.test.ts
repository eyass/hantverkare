import { describe, it, expect } from "vitest";
import { confirmationMatches } from "./confirmDeletion";

describe("confirmationMatches", () => {
  it("matches an exact copy of the org name", () => {
    expect(confirmationMatches("Mein Unternehmen", "Mein Unternehmen")).toBe(true);
  });

  it("tolerates surrounding whitespace in the typed value", () => {
    expect(confirmationMatches("Mein Unternehmen", "  Mein Unternehmen  ")).toBe(true);
  });

  it("rejects a case-mismatched value", () => {
    expect(confirmationMatches("Mein Unternehmen", "mein unternehmen")).toBe(false);
  });

  it("rejects a partial match", () => {
    expect(confirmationMatches("Mein Unternehmen", "Mein")).toBe(false);
  });

  it("rejects an empty typed value", () => {
    expect(confirmationMatches("Mein Unternehmen", "")).toBe(false);
  });

  it("rejects when the org name itself is blank", () => {
    expect(confirmationMatches("", "")).toBe(false);
  });
});
