-- Online payment collection on invoices (issue #131), T3 (payments/secrets).
--
-- Architecture decision (made autonomously, recorded on the issue): Stripe
-- Connect, Standard accounts. Each organization connects its own Stripe
-- account via Stripe-hosted onboarding (accounts.create + accountLinks.create).
-- hantverkare's platform Stripe account NEVER custodies customer-payment
-- funds -- only its own SaaS subscription revenue, which is a completely
-- separate, pre-existing integration (lib/billing/, the `billing` table,
-- app/api/stripe/webhook/route.ts). This migration and its application code
-- (lib/stripe/connect.ts, app/api/stripe/connect-webhook/route.ts,
-- app/(app)/settings/payments/) are a deliberately parallel, non-overlapping
-- code path from the subscription billing one, even though both ultimately
-- call the Stripe API.
--
--   1. organizations.stripe_connect_account_id: the Connect Standard account
--      id (acct_...) once the owner starts onboarding. Nullable -- most orgs
--      won't have connected yet.
--   2. organizations.stripe_connect_onboarded: flips to true only once
--      Stripe's `account.updated` webhook reports charges_enabled AND
--      payouts_enabled on that connected account -- i.e. it can actually
--      accept a Checkout payment. Starting false (not "has an account id")
--      avoids showing a "pay now" button for a half-onboarded account.
--   3. invoices.payment_status: tri-state, defaults 'unpaid'. 'partial' is
--      included now (not added later) because #131 explicitly asks for
--      deposit/progress payments in the future, even though this first cut
--      only ever writes 'unpaid' -> 'paid' (a Checkout Session is created for
--      the full invoice total, see lib/stripe/connect.ts). The column exists
--      so a later partial-payment feature is additive, not another migration
--      touching this same check constraint.
--   4. invoices.stripe_checkout_session_id: the most recent Checkout Session
--      created for this invoice (a customer can re-click "Jetzt bezahlen" and
--      get a fresh session; we only need the latest one to reconcile against
--      the connected-account webhook).
--   5. invoices.amount_paid_cents: cumulative amount actually confirmed paid
--      via `checkout.session.completed`, independent of total_cents so a
--      partial payment (future work) can be reflected without touching the
--      invoice's own totals.
--
-- paid_at already exists (0025_invoice_dunning.sql, issue #122) and is reused
-- here: the connect-webhook handler sets it (in addition to payment_status
-- and amount_paid_cents) the same moment payment_status flips to 'paid',
-- which also has the side effect of stopping the dunning cron for that
-- invoice (dunning already skips any invoice with paid_at set).

alter table public.organizations
  add column stripe_connect_account_id text,
  add column stripe_connect_onboarded boolean not null default false;

comment on column public.organizations.stripe_connect_account_id is
  'Stripe Connect Standard account id (acct_...) for this organization, used to collect customer payments on invoices. Null until the owner starts onboarding from /settings/payments. Entirely separate from billing.stripe_customer_id, which is hantverkare''s own SaaS-subscription customer on the platform account.';
comment on column public.organizations.stripe_connect_onboarded is
  'True once Stripe''s account.updated webhook (app/api/stripe/connect-webhook) reports charges_enabled and payouts_enabled for stripe_connect_account_id. Gates whether the "Jetzt bezahlen" button appears on invoices -- an account with an id but this still false cannot yet accept a Checkout payment.';

alter table public.invoices
  add column payment_status text not null default 'unpaid' check (payment_status in ('unpaid', 'partial', 'paid')),
  add column stripe_checkout_session_id text,
  add column amount_paid_cents integer not null default 0 check (amount_paid_cents >= 0);

comment on column public.invoices.payment_status is
  'Customer-payment status collected via Stripe Connect Checkout (issue #131). unpaid (default) / partial / paid. partial is reserved for future deposit/progress-payment support -- v1 only ever transitions unpaid -> paid for the full invoice total.';
comment on column public.invoices.stripe_checkout_session_id is
  'Most recent Stripe Checkout Session id created on the organization''s connected account for this invoice (see lib/stripe/connect.ts createInvoiceCheckoutSession). Re-clicking "Jetzt bezahlen" creates a new session and overwrites this.';
comment on column public.invoices.amount_paid_cents is
  'Cumulative cents confirmed paid via checkout.session.completed on the connected account. 0 until the first successful payment; set to the full total_cents on a v1 (full-payment) checkout.';

-- No new RLS policy needed: these are plain columns on tables that already
-- have owner/member-scoped select policies (0010_organizations.sql,
-- 0008_invoices.sql). Writes to organizations.stripe_connect_* only ever
-- happen via the service-role admin client (the settings action that starts
-- onboarding, and the connect-webhook route) -- same pattern as
-- 0025_invoice_dunning.sql's dunning columns. Writes to invoices.payment_status
-- / stripe_checkout_session_id / amount_paid_cents happen via the invoice
-- payment-session action (admin client, organization_id re-derived
-- server-side) and the connect-webhook route (admin client) -- never a
-- client-writable surface.
