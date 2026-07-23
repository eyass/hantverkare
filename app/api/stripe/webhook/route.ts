import type Stripe from "stripe";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripeClient } from "@/lib/stripe/client";
import { grantReferralRewardIfDue } from "@/lib/referrals/grantReferralReward";

// Billing is per-organization (see 0010). New Checkout sessions/subscriptions
// carry metadata.organization_id. Subscriptions created before the multi-user
// migration may still carry only metadata.user_id -- resolve those to an org
// via that user's membership so existing subscriptions keep working.
async function resolveOrganizationId(
  supabase: SupabaseClient,
  metadata: Stripe.Metadata | null | undefined,
  fallbackUserId?: string | null,
): Promise<string | null> {
  const orgId = metadata?.organization_id;
  if (orgId) {
    return orgId;
  }

  const userId = metadata?.user_id ?? fallbackUserId ?? null;
  if (!userId) {
    return null;
  }

  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error("Failed to resolve organization for legacy user_id metadata:", error);
    return null;
  }
  return data?.organization_id ?? null;
}

// Stripe requires the raw request body for signature verification, so this
// route must not run any body-parsing middleware -- Route Handlers give us
// the raw text directly via request.text(), which is what we use below.

async function updateBillingForSubscription(
  subscription: Stripe.Subscription,
) {
  const supabase = createAdminClient();
  const organizationId = await resolveOrganizationId(supabase, subscription.metadata);
  if (!organizationId) {
    console.error(
      "Stripe subscription has no resolvable organization_id/user_id:",
      subscription.id,
    );
    return;
  }

  const { error } = await supabase
    .from("billing")
    .update({
      stripe_subscription_id: subscription.id,
      subscription_status: subscription.status,
      updated_at: new Date().toISOString(),
    })
    .eq("organization_id", organizationId);

  if (error) {
    console.error("Failed to update billing from webhook:", error);
    return;
  }

  // Additive only: grants the referral reward (issue #79) if -- and only if
  // -- this org has a pending referral and this is a genuine first-time
  // "active" status. No-op (same behavior as before this feature existed)
  // for every org with no referral, and a guarded no-op if the reward was
  // already granted. See lib/referrals/grantReferralReward.ts for the
  // idempotency guarantee.
  await grantReferralRewardIfDue(supabase, organizationId, subscription.status);
}

export async function POST(request: Request): Promise<Response> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_WEBHOOK_SECRET is not set; rejecting webhook.");
    return new Response("Webhook not configured.", { status: 500 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature header.", { status: 400 });
  }

  const rawBody = await request.text();
  const stripe = getStripeClient();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err);
    return new Response("Invalid signature.", { status: 400 });
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;

      // Deposit (Anzahlung) checkout sessions, issue #162 -- created by
      // lib/payments/createDepositCheckoutSession.ts on the org's connected
      // Stripe Connect account (issue #131), always tagged with
      // metadata.kind so they're never confused with the SaaS subscription
      // checkout sessions handled below. Matches on
      // deposit_stripe_checkout_session_id (not just quote_id) so a stale,
      // already-superseded session (the customer re-requested a payment
      // link) can never retroactively mark the quote paid.
      if (session.metadata?.kind === "deposit_checkout") {
        const quoteId = session.metadata.quote_id;
        if (!quoteId) {
          console.error("Deposit checkout session completed with no quote_id metadata:", session.id);
          break;
        }
        const supabase = createAdminClient();
        const { error, data } = await supabase
          .from("quotes")
          .update({ deposit_paid_at: new Date().toISOString() })
          .eq("id", quoteId)
          .eq("deposit_stripe_checkout_session_id", session.id)
          .is("deposit_paid_at", null)
          .select("id");
        if (error) {
          console.error("Failed to mark deposit as paid from webhook:", error);
        } else if (!data || data.length === 0) {
          console.log(
            "Deposit checkout session completed but no matching unpaid quote found (already paid, or session was superseded):",
            session.id,
          );
        }
        break;
      }

      const supabase = createAdminClient();
      // client_reference_id now carries the organization_id (set in
      // createCheckoutSession); metadata.organization_id is the primary source,
      // with the legacy user_id path handled by resolveOrganizationId.
      const organizationId = await resolveOrganizationId(
        supabase,
        session.metadata,
        session.client_reference_id,
      );
      if (!organizationId) {
        console.error("Stripe checkout session has no resolvable organization:", session.id);
        break;
      }

      const { error } = await supabase.from("billing").upsert(
        {
          organization_id: organizationId,
          stripe_customer_id:
            typeof session.customer === "string" ? session.customer : session.customer?.id,
          stripe_subscription_id:
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription?.id,
          subscription_status: "active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "organization_id" },
      );

      if (error) {
        console.error("Failed to update billing after checkout:", error);
        break;
      }

      // Additive only (issue #79): see the comment on grantReferralRewardIfDue
      // in updateBillingForSubscription below -- same reasoning applies here.
      // subscription_status is hardcoded "active" above, which is exactly the
      // genuine-activation signal the reward requires.
      await grantReferralRewardIfDue(supabase, organizationId, "active");
      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await updateBillingForSubscription(subscription);
      break;
    }

    default:
      // Ignore all other event types -- we only care about the three above.
      break;
  }

  return new Response(null, { status: 200 });
}
