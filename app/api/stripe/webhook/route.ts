import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripeClient } from "@/lib/stripe/client";

// Stripe requires the raw request body for signature verification, so this
// route must not run any body-parsing middleware -- Route Handlers give us
// the raw text directly via request.text(), which is what we use below.

async function updateBusinessSettingsForSubscription(
  subscription: Stripe.Subscription,
) {
  const userId = subscription.metadata?.user_id;
  if (!userId) {
    console.error("Stripe subscription is missing metadata.user_id:", subscription.id);
    return;
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from("billing")
    .update({
      stripe_subscription_id: subscription.id,
      subscription_status: subscription.status,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);

  if (error) {
    console.error("Failed to update billing from webhook:", error);
  }
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
      const userId = session.metadata?.user_id ?? session.client_reference_id;
      if (!userId) {
        console.error("Stripe checkout session is missing user_id:", session.id);
        break;
      }

      const supabase = createAdminClient();
      const { error } = await supabase.from("billing").upsert(
        {
          user_id: userId,
          stripe_customer_id:
            typeof session.customer === "string" ? session.customer : session.customer?.id,
          stripe_subscription_id:
            typeof session.subscription === "string"
              ? session.subscription
              : session.subscription?.id,
          subscription_status: "active",
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );

      if (error) {
        console.error("Failed to update billing after checkout:", error);
      }
      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await updateBusinessSettingsForSubscription(subscription);
      break;
    }

    default:
      // Ignore all other event types -- we only care about the three above.
      break;
  }

  return new Response(null, { status: 200 });
}
