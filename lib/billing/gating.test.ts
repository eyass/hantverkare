import { describe, it, expect } from "vitest";
import { shouldGateAccess } from "./gating";

const future = () => new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString();
const past = () => new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString();

describe("shouldGateAccess", () => {
  it("gates a user with no subscription_status at all", () => {
    expect(shouldGateAccess({ subscriptionStatus: null, trialEndsAt: null })).toBe(true);
  });

  it("allows an active subscription", () => {
    expect(
      shouldGateAccess({ subscriptionStatus: "active", trialEndsAt: null }),
    ).toBe(false);
  });

  it("allows a trialing user whose trial has not ended", () => {
    expect(
      shouldGateAccess({ subscriptionStatus: "trialing", trialEndsAt: future() }),
    ).toBe(false);
  });

  it("gates a trialing user whose trial has ended", () => {
    expect(
      shouldGateAccess({ subscriptionStatus: "trialing", trialEndsAt: past() }),
    ).toBe(true);
  });

  it("gates a trialing user with a null trial_ends_at", () => {
    expect(
      shouldGateAccess({ subscriptionStatus: "trialing", trialEndsAt: null }),
    ).toBe(true);
  });

  it("gates canceled/past_due/incomplete subscriptions", () => {
    expect(
      shouldGateAccess({ subscriptionStatus: "canceled", trialEndsAt: future() }),
    ).toBe(true);
    expect(
      shouldGateAccess({ subscriptionStatus: "past_due", trialEndsAt: future() }),
    ).toBe(true);
  });
});
