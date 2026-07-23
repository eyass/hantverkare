"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrg } from "@/lib/organizations/getCurrentOrg";
import { canViewBilling } from "@/lib/organizations/permissions";
import { createConnectAccount, createConnectOnboardingLink } from "@/lib/stripe/connect";

/**
 * Starts (or resumes) Stripe Connect Standard onboarding for the current
 * organization (issue #131). Owner-only, same gate as the SaaS-subscription
 * billing actions (app/(app)/billing/actions.ts) -- reused here since
 * "who can manage money-related settings for the org" is the same role rule,
 * even though this is a completely separate Stripe integration (connected
 * accounts collecting customer payments, not the platform account's own
 * subscription revenue).
 *
 * Creates a Connect account once (persisted on organizations.
 * stripe_connect_account_id) and reuses it on every subsequent click --
 * Account Links themselves are always freshly created and single-use/
 * short-lived per Stripe's requirements, so we never persist the link URL.
 */
export async function startConnectOnboarding(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const org = await getCurrentOrg(supabase);
  if (!org || !canViewBilling(org.role)) {
    throw new Error("Nur der Inhaber kann Zahlungen einrichten.");
  }

  const admin = createAdminClient();
  const { data: orgRow } = await admin
    .from("organizations")
    .select("stripe_connect_account_id")
    .eq("id", org.organizationId)
    .maybeSingle();

  let accountId = orgRow?.stripe_connect_account_id ?? null;
  if (!accountId) {
    accountId = await createConnectAccount(user.email);
    const { error: updateError } = await admin
      .from("organizations")
      .update({ stripe_connect_account_id: accountId })
      .eq("id", org.organizationId);
    if (updateError) {
      console.error("Failed to persist stripe_connect_account_id:", updateError);
      throw new Error("Stripe-Konto konnte nicht gespeichert werden.");
    }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const onboardingUrl = await createConnectOnboardingLink(
    accountId,
    `${siteUrl}/settings/payments?connect=refresh`,
    `${siteUrl}/settings/payments?connect=return`,
  );

  redirect(onboardingUrl);
}
