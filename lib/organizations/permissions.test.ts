import { describe, it, expect } from "vitest";
import {
  canManageTeam,
  canViewBilling,
  canDeleteCustomers,
  canViewInvoices,
  canEditBusinessSettings,
} from "./permissions";

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

describe("canDeleteCustomers", () => {
  it("allows an owner regardless of the org setting", () => {
    expect(canDeleteCustomers("owner", false)).toBe(true);
    expect(canDeleteCustomers("owner", true)).toBe(true);
  });

  it("allows a member only when the org setting is true", () => {
    expect(canDeleteCustomers("member", true)).toBe(true);
    expect(canDeleteCustomers("member", false)).toBe(false);
  });

  it("fails closed for null/undefined role", () => {
    expect(canDeleteCustomers(null, true)).toBe(false);
    expect(canDeleteCustomers(undefined, true)).toBe(false);
  });

  it("fails closed for an unrecognized role string", () => {
    // @ts-expect-error -- deliberately passing an invalid role to prove fail-closed
    expect(canDeleteCustomers("admin", true)).toBe(false);
  });
});

describe("canViewInvoices", () => {
  it("allows an owner regardless of the org setting", () => {
    expect(canViewInvoices("owner", false)).toBe(true);
    expect(canViewInvoices("owner", true)).toBe(true);
  });

  it("allows a member only when the org setting is true", () => {
    expect(canViewInvoices("member", true)).toBe(true);
    expect(canViewInvoices("member", false)).toBe(false);
  });

  it("fails closed for null/undefined role", () => {
    expect(canViewInvoices(null, true)).toBe(false);
    expect(canViewInvoices(undefined, true)).toBe(false);
  });

  it("fails closed for an unrecognized role string", () => {
    // @ts-expect-error -- deliberately passing an invalid role to prove fail-closed
    expect(canViewInvoices("admin", true)).toBe(false);
  });
});

describe("canEditBusinessSettings", () => {
  it("allows an owner regardless of the org setting", () => {
    expect(canEditBusinessSettings("owner", false)).toBe(true);
    expect(canEditBusinessSettings("owner", true)).toBe(true);
  });

  it("allows a member only when the org setting is true", () => {
    expect(canEditBusinessSettings("member", true)).toBe(true);
    expect(canEditBusinessSettings("member", false)).toBe(false);
  });

  it("fails closed for null/undefined role", () => {
    expect(canEditBusinessSettings(null, true)).toBe(false);
    expect(canEditBusinessSettings(undefined, true)).toBe(false);
  });

  it("fails closed for an unrecognized role string", () => {
    // @ts-expect-error -- deliberately passing an invalid role to prove fail-closed
    expect(canEditBusinessSettings("admin", true)).toBe(false);
  });
});
