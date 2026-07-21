import { createAdminClient } from "@/lib/supabase/admin";

const TRIAL_LENGTH_MS = 14 * 24 * 60 * 60 * 1000;

export type BillingState = {
  subscriptionStatus: string | null;
  trialEndsAt: string | null;
};

/**
 * Ensures the signed-in user has a billing row with a subscription_status
 * set, starting their 14-day free trial on first touch.
 *
 * billing has no client-writable RLS policy (see 0009_billing.sql) -- writes
 * only happen here and from the Stripe webhook, both server-side, both using
 * the service-role client. `userId` here always comes from the caller's own
 * verified session (app/(app)/layout.tsx's supabase.auth.getUser()), never
 * from client input, so bypassing RLS is safe: a user can only ever have
 * their own trial started.
 *
 * We hook this into the authenticated (app) layout rather than a settings
 * page's own creation path because a billing row isn't otherwise guaranteed
 * to exist when a brand new user first hits e.g. /quotes. The layout runs on
 * every authenticated request, so it's the one place we can reliably
 * initialize the trial exactly once, right after signup.
 *
 * Uses an upsert with a check-then-write pattern: the write only happens
 * when no row exists yet, so it's a no-op (and safe to call on every
 * request) once a trial or subscription exists. A benign race is possible
 * if two requests hit this concurrently on a brand new user's very first
 * request -- both would attempt the insert, the second fails on the primary
 * key conflict and is treated as "trial already exists" by refetching.
 */
export async function ensureTrialStarted(userId: string): Promise<BillingState> {
  const admin = createAdminClient();

  const { data: existing, error: fetchError } = await admin
    .from("billing")
    .select("subscription_status, trial_ends_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (fetchError) {
    console.error("Failed to load billing state:", fetchError);
    return { subscriptionStatus: null, trialEndsAt: null };
  }

  if (existing) {
    return {
      subscriptionStatus: existing.subscription_status,
      trialEndsAt: existing.trial_ends_at,
    };
  }

  const trialEndsAt = new Date(Date.now() + TRIAL_LENGTH_MS).toISOString();
  const { error: insertError } = await admin.from("billing").insert({
    user_id: userId,
    subscription_status: "trialing",
    trial_ends_at: trialEndsAt,
  });

  if (insertError) {
    if (insertError.code === "23505") {
      // Lost the race to a concurrent request -- refetch what it wrote.
      const { data: winner } = await admin
        .from("billing")
        .select("subscription_status, trial_ends_at")
        .eq("user_id", userId)
        .maybeSingle();
      if (winner) {
        return { subscriptionStatus: winner.subscription_status, trialEndsAt: winner.trial_ends_at };
      }
    }
    console.error("Failed to start trial:", insertError);
    return { subscriptionStatus: null, trialEndsAt: null };
  }

  return { subscriptionStatus: "trialing", trialEndsAt };
}
