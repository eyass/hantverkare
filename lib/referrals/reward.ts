// Pure decision logic for the referral reward grant. Kept separate from the
// webhook/DB code (same reasoning as lib/billing/gating.ts) so the highest-
// risk part of this feature -- "can this ever fire twice, or fire for
// someone who never actually paid" -- is unit-testable without a database.
//
// IMPORTANT: this module does NOT perform the actual idempotency guarantee.
// The guarantee comes from the atomic UPDATE ... WHERE reward_granted_at IS
// NULL executed by the caller (see app/api/stripe/webhook/route.ts), which is
// the same "checked-and-set in one statement" pattern already used for
// expiry_reminder_sent_at in app/api/cron/quote-expiry-reminders/route.ts.
// This module only decides, given what the caller already knows, whether a
// grant attempt is worth making at all -- i.e. it's a pre-filter, not the
// lock.

export const REFERRAL_BONUS_DAYS = 30;

export type ReferralRewardCandidate = {
  /** null until the reward has been granted; non-null once granted. */
  rewardGrantedAt: string | null;
};

/**
 * True if a genuine, first-time paid-subscription-activation event has
 * occurred. We deliberately only treat Stripe's "active" status as genuine
 * activation -- not "trialing" (that's just the ordinary 14-day trial every
 * org gets on signup, referral or not, via ensureTrialStarted) and not
 * "past_due"/"canceled"/"incomplete"/etc. A referral must not be rewarded for
 * an org that merely started a trial and never actually subscribed.
 */
export function isGenuineSubscriptionActivation(
  subscriptionStatus: string | null | undefined,
): boolean {
  return subscriptionStatus === "active";
}

/**
 * True if the caller should attempt to claim (atomically) and grant the
 * referral reward for this referral row, given the event currently being
 * processed.
 *
 * - `referral` is null when there is no pending referral for this org at all
 *   (the overwhelmingly common case -- most orgs were never referred).
 * - `referral.rewardGrantedAt` non-null means it was already granted by an
 *   earlier delivery of this same webhook event (Stripe redelivers on
 *   timeout/non-2xx, and customer.subscription.updated + checkout.session
 *   .completed can both land for the same activation) -- this function
 *   returns false so the caller never even attempts a second claim.
 * - Only a genuine "active" status is eligible, per
 *   isGenuineSubscriptionActivation above.
 *
 * The caller MUST still perform its own atomic
 * `UPDATE ... WHERE reward_granted_at IS NULL` and treat "0 rows updated" as
 * "someone else already granted it, do nothing more" -- this function alone
 * cannot prevent a race between two concurrent webhook deliveries that both
 * read `rewardGrantedAt: null` before either has written. It exists to make
 * the "should we even try" decision unit-testable in isolation.
 */
export function shouldAttemptReferralGrant(
  referral: ReferralRewardCandidate | null,
  subscriptionStatus: string | null | undefined,
): boolean {
  if (!referral) return false;
  if (referral.rewardGrantedAt !== null) return false;
  return isGenuineSubscriptionActivation(subscriptionStatus);
}

/**
 * Computes the new trial_ends_at after applying the referral bonus. Extends
 * from the LATER of "now" and the org's current trial_ends_at (mirroring how
 * ensureTrialStarted anchors a fresh trial to "now") so that an org already
 * mid-trial gets a full 30 extra days on top of what it already had, rather
 * than the bonus window potentially landing in the past for an org whose
 * trial_ends_at happens to already be far in the future, or double-counting
 * days it hasn't reached yet if trial_ends_at is in the past.
 *
 * Note: for an org whose subscription_status is already "active" (a paying
 * customer, not "trialing"), lib/billing/gating.ts's shouldGateAccess never
 * even looks at trial_ends_at -- gating only checks it for "trialing" orgs.
 * So this bonus is only *visibly* a "free month" for an org currently on
 * trial. For an already-paying org, extending trial_ends_at alone does not
 * stop Stripe from billing them the next cycle; doing that for real would
 * require issuing a Stripe coupon/discount against a live subscription,
 * which is explicitly out of scope here (no live Stripe calls/keys touched
 * by this change, per the task). We record the bonus consistently for both
 * orgs regardless of their current status (so the data is there, and so an
 * org that lapses back to trialing still benefits), but flag the "already
 * active" case as a known limitation for a follow-up (a real Stripe
 * discount/coupon grant) rather than attempting untested live billing
 * mutations here.
 */
export function computeExtendedTrialEndsAt(
  currentTrialEndsAt: string | null,
  now: number = Date.now(),
  bonusDays: number = REFERRAL_BONUS_DAYS,
): string {
  const currentMs = currentTrialEndsAt ? Date.parse(currentTrialEndsAt) : NaN;
  const base = Number.isNaN(currentMs) ? now : Math.max(currentMs, now);
  return new Date(base + bonusDays * 24 * 60 * 60 * 1000).toISOString();
}
