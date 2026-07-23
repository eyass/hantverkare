import type { SupabaseClient } from "@supabase/supabase-js";
import { getStripeClient } from "@/lib/stripe/client";

export type CreateDepositCheckoutSessionParams = {
  supabase: SupabaseClient;
  organizationId: string;
  quoteId: string;
  quoteDescription: string;
  depositAmountCents: number;
  successUrl: string;
  cancelUrl: string;
};

export type DepositCheckoutSessionResult =
  | { skipped: true; reason: string }
  | { skipped: false; sessionId: string; url: string | null };

/**
 * Creates a Stripe Checkout Session for a quote's deposit (Anzahlung), on
 * the organization's *connected* Stripe account -- issue #162, building on
 * #131's architecture decision (Stripe Connect, Standard accounts, per-
 * purpose Checkout Session created directly on the connected account so the
 * platform account never custodies customer-payment funds).
 *
 * DEPENDENCY ON #131: at the time this was written, #131 (Stripe Connect
 * onboarding) was being implemented in parallel on a separate branch and had
 * not yet been merged to `main`. This helper assumes the `organizations`
 * table will eventually have `stripe_connect_account_id` (text, nullable)
 * and `stripe_connect_onboarded` (boolean) columns from #131's migration.
 *
 * Those columns do not exist on `main` as of this PR. Rather than importing
 * a generated Supabase type that assumes they exist (which would break the
 * build until #131 lands), this helper selects them with an explicit local
 * type and treats ANY failure to read them -- missing columns, a query
 * error, or simply no connected/onboarded account yet -- as "skip deposit
 * collection for this org", never as a hard error. That means:
 *   - Before #131 merges: every deposit collection attempt cleanly no-ops
 *     (logged, not thrown), so this PR can ship and be reviewed
 *     independently.
 *   - After #131 merges: as soon as an org actually has a connected +
 *     onboarded Stripe account, deposit collection starts working with no
 *     code change here.
 *
 * Whoever merges the second of these two PRs should double-check the column
 * names below (`stripe_connect_account_id` / `stripe_connect_onboarded`)
 * still match whatever #131 actually shipped, and rename here if not.
 */
export async function createDepositCheckoutSession(
  params: CreateDepositCheckoutSessionParams,
): Promise<DepositCheckoutSessionResult> {
  const {
    supabase,
    organizationId,
    quoteId,
    quoteDescription,
    depositAmountCents,
    successUrl,
    cancelUrl,
  } = params;

  if (!Number.isInteger(depositAmountCents) || depositAmountCents <= 0) {
    return { skipped: true, reason: "Deposit amount must be a positive integer number of cents." };
  }

  type OrgConnectFields = {
    stripe_connect_account_id: string | null;
    stripe_connect_onboarded: boolean | null;
  };

  let connectedAccountId: string | null = null;
  let onboarded = false;
  try {
    const { data, error } = await supabase
      .from("organizations")
      .select("stripe_connect_account_id, stripe_connect_onboarded")
      .eq("id", organizationId)
      .maybeSingle<OrgConnectFields>();
    if (error) {
      // Expected until #131 lands (columns don't exist yet) -- log at info
      // level of detail but never throw, this is the documented fallback.
      console.error(
        "Could not read organization Stripe Connect status (expected until #131 merges):",
        error,
      );
      return { skipped: true, reason: "Organization Stripe Connect status is unavailable." };
    }
    connectedAccountId = data?.stripe_connect_account_id ?? null;
    onboarded = data?.stripe_connect_onboarded ?? false;
  } catch (err) {
    console.error("Unexpected error reading organization Stripe Connect status:", err);
    return { skipped: true, reason: "Organization Stripe Connect status is unavailable." };
  }

  if (!connectedAccountId || !onboarded) {
    return { skipped: true, reason: "Organization has no onboarded Stripe Connect account yet." };
  }

  try {
    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        payment_method_types: ["card"],
        line_items: [
          {
            price_data: {
              currency: "eur",
              unit_amount: depositAmountCents,
              product_data: {
                name: `Anzahlung: ${quoteDescription || "Angebot"}`.slice(0, 250),
              },
            },
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: cancelUrl,
        metadata: {
          kind: "deposit_checkout",
          quote_id: quoteId,
          organization_id: organizationId,
        },
      },
      { stripeAccount: connectedAccountId },
    );

    return { skipped: false, sessionId: session.id, url: session.url ?? null };
  } catch (err) {
    console.error("Failed to create deposit Checkout Session:", err);
    return { skipped: true, reason: "Stripe error creating checkout session." };
  }
}
