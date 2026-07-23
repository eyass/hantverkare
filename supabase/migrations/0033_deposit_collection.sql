-- Deposit (Anzahlung) collection at quote signing (issue #162).
--
-- Builds on #131's architecture decision (Stripe Connect, Standard accounts,
-- per-invoice/per-purpose Checkout Session on the connected account -- see
-- that issue's comment thread): a deposit is just another Checkout Session
-- for a partial amount, created at the moment the customer signs, on the
-- same connected account. No separate custody model needed.
--
-- Deliberately placed on `quotes`, not `invoices`: a deposit happens at
-- signing time, before an invoice exists (invoices are only ever created
-- for already-signed quotes, see createInvoice in
-- app/(app)/quotes/[id]/actions.ts). This keeps this migration additive-only
-- against `quotes` and avoids touching `invoices`/`organizations`, which is
-- exactly the surface #131's parallel migration is expected to touch --
-- minimizing merge conflict between the two.
--
-- Columns:
--   deposit_percent               -- set by the tradesperson before/at
--                                     finalizing (1-100), null = no deposit
--                                     requested for this quote.
--   deposit_amount_cents          -- snapshotted at signing time (percent *
--                                     the quote's total_cents at that
--                                     moment), not recomputed afterwards --
--                                     mirrors how invoices snapshot
--                                     subtotal/vat/total off the quote
--                                     rather than recomputing live.
--   deposit_paid_at               -- set at most once, by the Stripe webhook
--                                     handler on checkout.session.completed,
--                                     mirroring invoices.paid_at /
--                                     review_request_sent_at's
--                                     set-once-never-unset pattern.
--   deposit_stripe_checkout_session_id -- the most recent Checkout Session
--                                     created for this quote's deposit (a
--                                     customer can re-request a payment link
--                                     if the first one expired/was
--                                     abandoned, so this can be overwritten
--                                     before deposit_paid_at is set).
--
-- No new RLS policy needed: these are plain columns on `quotes`, which
-- already has owner/member-scoped RLS (is_org_member(organization_id)) from
-- 0001_init.sql. Writes happen either via the owner-gated tradesperson
-- action (setDepositPercent) or the service-role admin client (customer-side
-- signing flow / Stripe webhook), same pattern as every other quote column.

alter table public.quotes
  add column deposit_percent integer,
  add column deposit_amount_cents integer,
  add column deposit_paid_at timestamptz,
  add column deposit_stripe_checkout_session_id text;

alter table public.quotes
  add constraint quotes_deposit_percent_range
  check (deposit_percent is null or (deposit_percent >= 1 and deposit_percent <= 100));

comment on column public.quotes.deposit_percent is
  'Optional deposit percentage (1-100) the tradesperson configures before/at finalizing a quote. Null means no deposit is requested (issue #162).';
comment on column public.quotes.deposit_amount_cents is
  'Deposit amount in cents, snapshotted from deposit_percent * total_cents at the moment the customer signs. Null until a deposit checkout session has been created.';
comment on column public.quotes.deposit_paid_at is
  'Timestamp the deposit Checkout Session was completed, set at most once by the Stripe webhook handler. Null if unpaid or no deposit configured.';
comment on column public.quotes.deposit_stripe_checkout_session_id is
  'Most recent Stripe Checkout Session id created for this quote''s deposit. Overwritten if the customer requests a fresh payment link before paying; the webhook matches on this column to avoid marking a stale/replaced session as paid.';
