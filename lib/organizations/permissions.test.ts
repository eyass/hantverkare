import { describe, it, expect } from "vitest";
import { canManageTeam, canViewBilling } from "./permissions";

describe("canManageTeam", () => {
  it("allows an owner", () => {
    expect(canManageTeam("owner")).toBe(true);
  });

  it("denies a member", () => {
    expect(canManageTeam("member")).toBe(false);
  });

  it("fails closed for null/undefined role", () => {
    expect(canManageTeam(null)).toBe(false);
    expect(canManageTeam(undefined)).toBe(false);
  });

  it("fails closed for an unrecognized role string", () => {
    // @ts-expect-error -- deliberately passing an invalid role to prove fail-closed
    expect(canManageTeam("admin")).toBe(false);
  });
});

describe("canViewBilling", () => {
  it("allows an owner", () => {
    expect(canViewBilling("owner")).toBe(true);
  });

  it("denies a member", () => {
    expect(canViewBilling("member")).toBe(false);
  });

  it("fails closed for null/undefined role", () => {
    expect(canViewBilling(null)).toBe(false);
    expect(canViewBilling(undefined)).toBe(false);
  });
});
