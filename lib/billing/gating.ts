// Pure decision logic for whether a user should be gated (redirected to
// /billing) based on their subscription state. Kept separate from the
// layout/DB code so it's trivially unit-testable.

export type SubscriptionState = {
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
};

const ACTIVE_STATUSES = new Set(["trialing", "active"]);

/**
 * Returns true if the user should be redirected to /billing instead of
 * seeing the app. A user has access if their subscription_status is
 * "trialing" or "active" AND (for "trialing") the trial hasn't expired yet.
 *
 * Note: Stripe webhooks flip subscription_status away from "trialing" once
 * a trial converts or lapses, but we also defensively check trial_ends_at
 * here in case a webhook hasn't landed yet (e.g. right at trial expiry).
 */
export function shouldGateAccess(state: SubscriptionState): boolean {
  const { subscriptionStatus, trialEndsAt } = state;

  if (!subscriptionStatus || !ACTIVE_STATUSES.has(subscriptionStatus)) {
    return true;
  }

  if (subscriptionStatus === "trialing") {
    if (!trialEndsAt) {
      return true;
    }
    const trialEndsAtMs = Date.parse(trialEndsAt);
    if (Number.isNaN(trialEndsAtMs) || trialEndsAtMs <= Date.now()) {
      return true;
    }
  }

  return false;
}
