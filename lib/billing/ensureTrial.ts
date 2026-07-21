import type { SupabaseClient } from "@supabase/supabase-js";

const TRIAL_LENGTH_MS = 14 * 24 * 60 * 60 * 1000;

export type BillingState = {
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
};

/**
 * Ensures the signed-in user has a business_settings row with a
 * subscription_status set, starting their 14-day free trial on first touch.
 *
 * We hook this into the authenticated (app) layout rather than the settings
 * page's own creation path because business_settings rows aren't otherwise
 * guaranteed to exist yet when a brand new user first hits e.g. /quotes --
 * the settings page only creates a row when the user explicitly saves the
 * form. The layout runs on every authenticated request, so it's the one
 * place we can reliably initialize the trial exactly once, right after
 * signup, regardless of which page the user lands on first.
 *
 * Uses an upsert with a WHERE-less insert-if-missing pattern: the update
 * only touches subscription_status/trial_ends_at when they're both still
 * null, so it's a no-op (and safe to call on every request) once a trial or
 * subscription exists.
 */
export async function ensureTrialStarted(
  supabase: SupabaseClient,
  userId: string,
): Promise<BillingState> {
  const { data: existing, error: fetchError } = await supabase
    .from("business_settings")
    .select("subscription_status, trial_ends_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError) {
    console.error("Failed to load billing state:", fetchError);
    return { subscriptionStatus: null, trialEndsAt: null };
  }

  if (existing && (existing.subscription_status !== null || existing.trial_ends_at !== null)) {
    return {
      subscriptionStatus: existing.subscription_status,
      trialEndsAt: existing.trial_ends_at,
    };
  }

  const trialEndsAt = new Date(Date.now() + TRIAL_LENGTH_MS).toISOString();
  const { error: upsertError } = await supabase.from("business_settings").upsert(
    {
      user_id: userId,
      subscription_status: "trialing",
      trial_ends_at: trialEndsAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (upsertError) {
    console.error("Failed to start trial:", upsertError);
    return { subscriptionStatus: null, trialEndsAt: null };
  }

  return { subscriptionStatus: "trialing", trialEndsAt };
}
