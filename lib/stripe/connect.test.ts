import { describe, it, expect } from "vitest";
import type Stripe from "stripe";
import { isAccountReadyForPayments, PLATFORM_APPLICATION_FEE_BPS } from "./connect";

function account(overrides: Partial<Stripe.Account>): Stripe.Account {
  return {
    charges_enabled: false,
    payouts_enabled: false,
    ...overrides,
  } as Stripe.Account;
}

describe("isAccountReadyForPayments", () => {
  it("is false when neither capability is enabled", () => {
    expect(isAccountReadyForPayments(account({}))).toBe(false);
  });

  it("is false when only charges are enabled", () => {
    expect(isAccountReadyForPayments(account({ charges_enabled: true }))).toBe(false);
  });

  it("is false when only payouts are enabled", () => {
    expect(isAccountReadyForPayments(account({ payouts_enabled: true }))).toBe(false);
  });

  it("is true only once both charges_enabled and payouts_enabled are true", () => {
    expect(
      isAccountReadyForPayments(account({ charges_enabled: true, payouts_enabled: true })),
    ).toBe(true);
  });
});

describe("PLATFORM_APPLICATION_FEE_BPS", () => {
  it("defaults to 0% for v1 (documented reasoning in lib/stripe/connect.ts)", () => {
    expect(PLATFORM_APPLICATION_FEE_BPS).toBe(0);
  });
});
