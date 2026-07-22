import type { SupabaseClient } from "@supabase/supabase-js";
import { isValidReferralCodeFormat, normalizeReferralCode } from "./code";

/**
 * Records a referral for a BRAND NEW organization, if `rawCode` resolves to
 * a real referrer org. Called exactly once, from ensureOrganization(), right
 * after a fresh org is created for a first-time signup -- never for an
 * existing org (an existing user re-visiting `?ref=THEIR_OWN_CODE` never
 * reaches this: ensureOrganization's existing-membership check returns
 * early and this function is never called for them, so self-referral via a
 * stale cookie is structurally impossible, not just guarded).
 *
 * This only RECORDS the referral (reward_granted_at left null) -- it does
 * NOT grant anything. The reward is granted later, only on genuine
 * subscription activation, in the Stripe webhook (see
 * app/api/stripe/webhook/route.ts and lib/referrals/reward.ts).
 *
 * Best-effort: any failure here (bad code, referrer not found, DB error) is
 * logged and swallowed -- a broken/expired/garbage referral code must never
 * block or fail a signup.
 */
export async function recordReferralIfPresent(
  admin: SupabaseClient,
  newOrganizationId: string,
  rawCode: string | null | undefined,
): Promise<void> {
  if (!isValidReferralCodeFormat(rawCode)) {
    return;
  }
  const code = normalizeReferralCode(rawCode);

  const { data: referrer, error: referrerError } = await admin
    .from("organizations")
    .select("id")
    .eq("referral_code", code)
    .maybeSingle();

  if (referrerError) {
    console.error("Failed to look up referrer organization for referral code:", referrerError);
    return;
  }
  if (!referrer) {
    // Unknown/garbage code -- not an error, just no referral to record.
    return;
  }
  if (referrer.id === newOrganizationId) {
    // Cannot happen in practice (see the doc comment above), but guarded
    // explicitly in code too, not just via the DB check constraint.
    console.error("Refusing to record a self-referral for organization:", newOrganizationId);
    return;
  }

  const { error: insertError } = await admin.from("referrals").insert({
    referrer_organization_id: referrer.id,
    referred_organization_id: newOrganizationId,
    code_used: code,
  });

  if (insertError) {
    // 23505 = unique violation on referred_organization_id (already recorded
    // -- shouldn't happen since this only runs once per brand-new org, but
    // is safe to ignore if it does) or on the self-referral check (23514).
    if (insertError.code !== "23505" && insertError.code !== "23514") {
      console.error("Failed to record referral:", insertError);
    }
  }
}
