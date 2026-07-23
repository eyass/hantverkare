import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripeClient } from "@/lib/stripe/client";
import { isAccountReadyForPayments } from "@/lib/stripe/connect";

// Stripe Connect webhook for issue #131 (customer payment collection on
// invoices) -- DELIBERATELY a separate route/endpoint from
// app/api/stripe/webhook/route.ts, which handles hantverkare's own SaaS
// subscription events on the platform account. This route is registered in
// the Stripe Dashboard as a Connect webhook (events from CONNECTED accounts,
// not the platform account), and needs its own signing secret because Stripe
// signs Connect webhook payloads with a separate secret from the account
// webhook -- see STRIPE_CONNECT_WEBHOOK_SECRET in the PR description /
// docs/MANUAL-STEPS-PENDING.md-style manual step.
//
// Two event types matter here:
//   - account.updated: fired on the connected account itself once its
//     capabilities change (e.g. onboarding finished). We flip
//     organizations.stripe_connect_onboarded once charges_enabled AND
//     payouts_enabled are both true.
//   - checkout.session.completed: fired for a Checkout Session created with
//     `{ stripeAccount: ... }` (see lib/stripe/connect.ts). We look up the
//     invoice by session id and mark it paid.
//
// Stripe requires the raw request body for signature verification, so this
// route must not run any body-parsing middleware -- Route Handlers give us
// the raw text directly via request.text(), which is what we use below.

export async function POST(request: Request): Promise<Response> {
  const webhookSecret = process.env.STRIPE_CONNECT_WEBHOOK_SECRET;
  if (!webhookSecret) {
    console.error("STRIPE_CONNECT_WEBHOOK_SECRET is not set; rejecting webhook.");
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
    console.error("Stripe connect webhook signature verification failed:", err);
    return new Response("Invalid signature.", { status: 400 });
  }

  switch (event.type) {
    case "account.updated": {
      const account = event.data.object as Stripe.Account;
      const supabase = createAdminClient();

      const onboarded = isAccountReadyForPayments(account);
      const { error } = await supabase
        .from("organizations")
        .update({ stripe_connect_onboarded: onboarded })
        .eq("stripe_connect_account_id", account.id);

      if (error) {
        console.error("Failed to update stripe_connect_onboarded:", error);
      }
      break;
    }

    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const supabase = createAdminClient();

      const invoiceId = session.metadata?.invoice_id;
      if (!invoiceId) {
        console.error(
          "Connect checkout.session.completed with no metadata.invoice_id:",
          session.id,
        );
        break;
      }

      const amountPaidCents = session.amount_total ?? 0;
      const { error } = await supabase
        .from("invoices")
        .update({
          payment_status: "paid",
          amount_paid_cents: amountPaidCents,
          paid_at: new Date().toISOString(),
          stripe_checkout_session_id: session.id,
        })
        .eq("id", invoiceId);

      if (error) {
        console.error("Failed to mark invoice as paid from connect webhook:", error);
      }
      break;
    }

    default:
      // Ignore all other event types -- we only care about the two above.
      break;
  }

  return new Response(null, { status: 200 });
}
