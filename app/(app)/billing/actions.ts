"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getStripeClient } from "@/lib/stripe/client";
import { getCurrentOrg } from "@/lib/organizations/getCurrentOrg";
import { canViewBilling } from "@/lib/organizations/permissions";

/**
 * Creates a Stripe Checkout session for the €29/month subscription and
 * redirects the user there. Uses Stripe's hosted Checkout page -- no card
 * data ever touches our server, and this repo never creates a real Price or
 * uses a live secret key (see docs/MANUAL-STEPS-PENDING.md).
 */
export async function createCheckoutSession(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  // Billing is per-organization and owner-only. Enforced server-side: a member
  // must never be able to start/manage the org's subscription.
  const org = await getCurrentOrg(supabase);
  if (!org || !canViewBilling(org.role)) {
    throw new Error("Nur der Inhaber kann das Abonnement verwalten.");
  }

  const priceId = process.env.STRIPE_PRICE_ID;
  if (!priceId) {
    throw new Error("STRIPE_PRICE_ID is not set.");
  }

  const { data: settings } = await supabase
    .from("billing")
    .select("stripe_customer_id")
    .eq("organization_id", org.organizationId)
    .maybeSingle();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const stripe = getStripeClient();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    line_items: [{ price: priceId, quantity: 1 }],
    customer: settings?.stripe_customer_id ?? undefined,
    client_reference_id: org.organizationId,
    customer_email: settings?.stripe_customer_id ? undefined : (user.email ?? undefined),
    success_url: `${siteUrl}/billing?checkout=success`,
    cancel_url: `${siteUrl}/billing?checkout=cancelled`,
    metadata: { organization_id: org.organizationId },
    subscription_data: { metadata: { organization_id: org.organizationId } },
  });

  if (!session.url) {
    throw new Error("Stripe did not return a Checkout URL.");
  }

  redirect(session.url);
}

/**
 * Sends the user to Stripe's hosted Billing Portal so they can manage their
 * subscription (update card, cancel, view invoices) without us building any
 * of that UI ourselves.
 */
export async function createBillingPortalSession(): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login");
  }

  const org = await getCurrentOrg(supabase);
  if (!org || !canViewBilling(org.role)) {
    throw new Error("Nur der Inhaber kann das Abonnement verwalten.");
  }

  const { data: settings } = await supabase
    .from("billing")
    .select("stripe_customer_id")
    .eq("organization_id", org.organizationId)
    .maybeSingle();

  if (!settings?.stripe_customer_id) {
    throw new Error("No Stripe customer on file yet.");
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const stripe = getStripeClient();

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: settings.stripe_customer_id,
    return_url: `${siteUrl}/billing`,
  });

  redirect(portalSession.url);
}
