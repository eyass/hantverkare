import { describe, it, expect } from "vitest";
import { validateHours, validateWorkedOn } from "./validation";

describe("validateHours", () => {
  it("accepts a normal positive value", () => {
    expect(validateHours(3.5)).toEqual({ error: null });
  });

  it("accepts the upper boundary of 24", () => {
    expect(validateHours(24)).toEqual({ error: null });
  });

  it("rejects 0", () => {
    expect(validateHours(0).error).not.toBeNull();
  });

  it("rejects negative values", () => {
    expect(validateHours(-1).error).not.toBeNull();
  });

  it("rejects values above 24", () => {
    expect(validateHours(24.01).error).not.toBeNull();
  });

  it("rejects NaN", () => {
    expect(validateHours(NaN).error).not.toBeNull();
  });

  it("rejects Infinity", () => {
    expect(validateHours(Infinity).error).not.toBeNull();
  });
});

describe("validateWorkedOn", () => {
  it("accepts a valid ISO date string", () => {
    expect(validateWorkedOn("2026-07-23")).toEqual({ error: null });
  });

  it("rejects an invalid date string", () => {
    expect(validateWorkedOn("not-a-date").error).not.toBeNull();
  });
});
