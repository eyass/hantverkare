import Stripe from "stripe";
import { getStripeClient } from "./client";

// Stripe Connect helpers for collecting CUSTOMER payments on invoices
// (issue #131). Deliberately separate from lib/billing/ and
// app/api/stripe/webhook/route.ts, which are hantverkare's own SaaS
// subscription revenue on the platform Stripe account -- this file never
// touches the `billing` table and the subscription code never touches
// `organizations.stripe_connect_*` / `invoices.payment_status`.
//
// Custody-of-funds model: Standard Connect accounts. Each organization
// connects (and owns) its own Stripe account; hantverkare's platform account
// never holds customer-payment funds. Checkout Sessions and the resulting
// charges are created directly on the connected account via the
// `stripeAccount` request option, per Stripe's Connect API pattern.

// The same underlying Stripe SDK instance as the subscription integration is
// fine to share (it's just an HTTP client keyed by hantverkare's own secret
// key) -- what matters is that every Connect call below passes
// `{ stripeAccount: ... }` so the operation actually happens on the
// connected account, not the platform account.
function getConnectStripeClient(): Stripe {
  return getStripeClient();
}

/**
 * Creates a new Stripe Connect Standard account for an organization that
 * hasn't started onboarding yet. Standard accounts (not Express/Custom) put
 * Stripe's own dashboard, ToS acceptance, and compliance in front of the
 * organization directly -- the lowest-liability option for hantverkare,
 * matching the "we never custody funds" decision on issue #131.
 */
export async function createConnectAccount(email?: string | null): Promise<string> {
  const stripe = getConnectStripeClient();
  const account = await stripe.accounts.create({
    type: "standard",
    email: email ?? undefined,
  });
  return account.id;
}

/**
 * Creates a Stripe-hosted onboarding link (Account Link) for a connected
 * account. Stripe requires fresh, short-lived links -- callers should create
 * one right before redirecting, never persist/reuse the URL.
 */
export async function createConnectOnboardingLink(
  accountId: string,
  refreshUrl: string,
  returnUrl: string,
): Promise<string> {
  const stripe = getConnectStripeClient();
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: "account_onboarding",
  });
  return accountLink.url;
}

/**
 * Reads current capability flags for a connected account. Used by the
 * connect-webhook handler on `account.updated` to decide whether to flip
 * organizations.stripe_connect_onboarded.
 */
export function isAccountReadyForPayments(account: Stripe.Account): boolean {
  return Boolean(account.charges_enabled && account.payouts_enabled);
}

/**
 * Platform application fee, in basis points of the invoice total, taken on
 * top of each Checkout Session created on a connected account.
 *
 * Chosen default: 0% for v1. Reasoning: hantverkare's revenue model is
 * already the flat SaaS subscription (lib/billing/) -- this payment-
 * collection feature exists to make the *product* more useful (customers can
 * pay directly from an invoice), not to open a second, transaction-based
 * revenue line on day one. A non-zero take rate is a real product/pricing
 * decision (would need ToS updates, disclosure to organizations, and likely
 * a per-plan tier) that's out of scope for shipping the core flow. Kept as a
 * single named constant so turning on a take rate later is a one-line change
 * plus the `application_fee_amount` wiring already present in
 * createInvoiceCheckoutSession below.
 */
export const PLATFORM_APPLICATION_FEE_BPS = 0;

function computeApplicationFeeCents(totalCents: number): number | undefined {
  if (PLATFORM_APPLICATION_FEE_BPS <= 0) {
    return undefined;
  }
  return Math.round((totalCents * PLATFORM_APPLICATION_FEE_BPS) / 10_000);
}

/**
 * Creates a Checkout Session ON THE CONNECTED ACCOUNT for a single invoice's
 * full total. Money flows directly to the organization's own Stripe balance;
 * hantverkare only ever sees an optional application fee (currently 0, see
 * PLATFORM_APPLICATION_FEE_BPS above) via Stripe Connect's standard
 * destination-charge-on-connected-account flow.
 */
export async function createInvoiceCheckoutSession(params: {
  connectedAccountId: string;
  invoiceId: string;
  invoiceNumber: string;
  totalCents: number;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  const stripe = getConnectStripeClient();
  const applicationFeeAmount = computeApplicationFeeCents(params.totalCents);

  const session = await stripe.checkout.sessions.create(
    {
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "eur",
            unit_amount: params.totalCents,
            product_data: {
              name: `Rechnung ${params.invoiceNumber}`,
            },
          },
          quantity: 1,
        },
      ],
      payment_intent_data: applicationFeeAmount
        ? { application_fee_amount: applicationFeeAmount }
        : undefined,
      metadata: { invoice_id: params.invoiceId },
      success_url: params.successUrl,
      cancel_url: params.cancelUrl,
    },
    { stripeAccount: params.connectedAccountId },
  );

  return session;
}
