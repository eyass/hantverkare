import type { SupabaseClient } from "@supabase/supabase-js";
import { computeExtendedTrialEndsAt, shouldAttemptReferralGrant } from "./reward";

/**
 * Called additively from the Stripe webhook whenever an organization's
 * subscription reaches a real status (see
 * app/api/stripe/webhook/route.ts). If, and only if:
 *   1. there is a pending referral for this org as the REFERRED side, and
 *   2. the reward has not already been granted, and
 *   3. `subscriptionStatus` is a genuine first-time paid activation ("active")
 * ...this grants a 30-day trial_ends_at bonus to BOTH the referrer's org and
 * the referred org.
 *
 * Idempotency (the load-bearing part): the actual lock is the single atomic
 * UPDATE below --
 *
 *   update referrals set reward_granted_at = now()
 *   where referred_organization_id = :orgId and reward_granted_at is null
 *   returning referrer_organization_id
 *
 * -- executed as ONE statement against Postgres. Postgres evaluates and
 * applies an UPDATE's WHERE clause and SET atomically per row under the
 * default read-committed isolation level used by the Postgres client here:
 * if two webhook deliveries (e.g. checkout.session.completed racing
 * customer.subscription.updated, or Stripe redelivering after a timeout)
 * both run this concurrently, only one can see `reward_granted_at is null`
 * still true at the moment it commits its update -- the second one's WHERE
 * clause simply matches zero rows (because the first already flipped
 * reward_granted_at to non-null), so `.select()` returns no row, and this
 * function no-ops for the second caller. This exactly mirrors the
 * `.is("expiry_reminder_sent_at", null)` guard already used in
 * app/api/cron/quote-expiry-reminders/route.ts -- same "checked-and-set in a
 * single statement" pattern, applied here to a case with real financial
 * consequences instead of an email side effect.
 *
 * `shouldAttemptReferralGrant` (a pure, unit-tested pre-filter) is checked
 * first purely to avoid an unnecessary UPDATE attempt for the overwhelmingly
 * common case (no referral at all, or status isn't "active" yet) -- it is
 * NOT what prevents the double-fire; the UPDATE's WHERE clause is.
 */
export async function grantReferralRewardIfDue(
  admin: SupabaseClient,
  organizationId: string,
  subscriptionStatus: string | null | undefined,
): Promise<void> {
  const { data: referral, error: fetchError } = await admin
    .from("referrals")
    .select("id, reward_granted_at")
    .eq("referred_organization_id", organizationId)
    .maybeSingle();

  if (fetchError) {
    console.error("Failed to look up referral for org:", organizationId, fetchError);
    return;
  }

  if (
    !shouldAttemptReferralGrant(
      referral ? { rewardGrantedAt: referral.reward_granted_at } : null,
      subscriptionStatus,
    )
  ) {
    return;
  }

  // Atomic claim: only proceeds to grant if THIS call is the one that flips
  // reward_granted_at from null -> now(). See the doc comment above.
  const { data: claimed, error: claimError } = await admin
    .from("referrals")
    .update({ reward_granted_at: new Date().toISOString() })
    .eq("referred_organization_id", organizationId)
    .is("reward_granted_at", null)
    .select("referrer_organization_id, referred_organization_id")
    .maybeSingle();

  if (claimError) {
    console.error("Failed to claim referral reward for org:", organizationId, claimError);
    return;
  }
  if (!claimed) {
    // Lost the race to a concurrent webhook delivery (or already granted) --
    // the other caller is responsible for applying the bonus. Do nothing.
    return;
  }

  await Promise.all([
    applyTrialBonus(admin, claimed.referrer_organization_id),
    applyTrialBonus(admin, claimed.referred_organization_id),
  ]);
}

async function applyTrialBonus(admin: SupabaseClient, organizationId: string): Promise<void> {
  const { data: billing, error: fetchError } = await admin
    .from("billing")
    .select("trial_ends_at")
    .eq("organization_id", organizationId)
    .maybeSingle();

  if (fetchError) {
    console.error("Failed to load billing row for referral bonus:", organizationId, fetchError);
    return;
  }
  if (!billing) {
    // No billing row yet (shouldn't happen -- ensureTrialStarted creates one
    // on first authenticated request -- but never worth crashing the
    // webhook over a missing bonus target).
    console.error("No billing row found for referral bonus target org:", organizationId);
    return;
  }

  const newTrialEndsAt = computeExtendedTrialEndsAt(billing.trial_ends_at);

  const { error: updateError } = await admin
    .from("billing")
    .update({ trial_ends_at: newTrialEndsAt, updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId);

  if (updateError) {
    console.error("Failed to apply referral trial bonus:", organizationId, updateError);
  }
}
