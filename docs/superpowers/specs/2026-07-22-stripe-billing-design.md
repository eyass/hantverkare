# Stripe SaaS Billing — Design

**Goal:** Charge tradespeople a subscription to use hantverkare itself, matching
Bliqat's freemium/14-day-trial model. Solo build (T3, financial), decided
autonomously per the standing full-autonomy override in `.harness/LOOP.md`.

## Decisions (no user input available — documented rationale)

- **Model:** single paid plan, 14-day free trial, no free tier. Simplest to build
  and matches Bliqat. (A tiered/metered model can be added later without schema
  changes if `stripe_price_id` stays a column, not a hardcoded constant.)
- **Price:** placeholder €29/month — a real Stripe Price object must be created in
  the Stripe Dashboard (manual step, see below) since creating live prices requires
  a real Stripe account decision the human should make.
- **Enforcement:** a `subscription_status` check in the `(app)` layout — if
  `trialing`/`active`, allow; otherwise redirect to `/billing` with an upsell.
  Enforced server-side in the layout (not middleware) since it needs a DB read
  already happening there for `AppShell`.
- **Checkout:** Stripe Checkout (hosted page), not custom Elements — far less PCI
  surface, no card data ever touches our server. This also respects the hard
  prohibition on entering payment details ourselves — the human enters their own
  card directly into Stripe's hosted page.
- **Webhooks:** a single `/api/stripe/webhook` route verifying signatures, handling
  `checkout.session.completed`, `customer.subscription.updated`,
  `customer.subscription.deleted`.
- **No real charge is ever executed by any agent in this build** — Stripe test mode
  keys are used throughout; going live (switching to real API keys, creating the
  real Price) is a manual human step.

## Schema (T3 migration — human must run)

```sql
alter table public.business_settings
  add column stripe_customer_id text,
  add column stripe_subscription_id text,
  add column subscription_status text,
  add column trial_ends_at timestamptz;
```

`business_settings` already exists and is 1:1 with a user — no new table needed.

## Files

- `lib/stripe/client.ts` — server-side Stripe SDK singleton
- `app/(app)/billing/page.tsx` — shows trial/subscription status, "Abonnieren" CTA
- `app/(app)/billing/actions.ts` — `createCheckoutSession()` Server Action, redirects
  to Stripe Checkout
- `app/api/stripe/webhook/route.ts` — webhook handler, updates `business_settings`
- `app/(app)/layout.tsx` — add subscription-gate check (redirect to `/billing` if
  not trialing/active), except `/billing` itself is always reachable
- `.env.example` — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `STRIPE_PRICE_ID`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (unused server-side but
  documented for future Elements use)

## New-user trial

On first login (no `business_settings` row / no `trial_ends_at`), set
`trial_ends_at = now() + interval '14 days'` and `subscription_status = 'trialing'`
via the existing business-settings creation path.

## What we do NOT build now

- Plan tiers/upgrades, proration UI, invoices/receipts UI (Stripe's own customer
  portal covers this — link to it via `stripe.billingPortal.sessions.create`)
- Usage-based billing
