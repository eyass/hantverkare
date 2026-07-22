-- Automated review-request after invoice paid (issue #157).
--
-- Design (T2 per the issue, but treated as T3 procedurally per CLAUDE.md:
-- "Any change under supabase/migrations/... is T3" -- this repo's rule takes
-- precedence over the issue's own risk label):
--
--   1. Review requests need a platform link (Google Business Profile,
--      Trustpilot, etc.) and an opt-in toggle, following the exact precedent
--      of sms_notifications_enabled (0016) and dunning_enabled (0025):
--      per-organization plain columns, no new table, defaulting to the
--      *safe* state -- OFF here (unlike dunning's default-on, since this
--      sends an unsolicited email to a customer and the issue explicitly
--      calls for opt-in, "don't spam customers who didn't ask for it").
--
--   2. review_request_days configures how long after an invoice is marked
--      paid (invoices.paid_at, added in 0025_invoice_dunning.sql) to wait
--      before sending, mirroring dunning_reminder_days.
--
--   3. review_request_sent_at on invoices tracks whether the one-time
--      request has already gone out for this invoice, mirroring
--      payment_reminder_sent_at/mahnung_sent_at/escalation_sent_at exactly:
--      set at most once, gated by "is null" in the cron query, never
--      un-sent or resent automatically.
--
-- No new RLS policy needed, same reasoning as 0025: plain columns on tables
-- that already have owner/member-scoped select policies. Writes only ever
-- happen via the service-role admin client (the cron route, or the
-- owner-gated settings action mirroring updateTeamPermissions).

alter table public.invoices
  add column review_request_sent_at timestamptz;

comment on column public.invoices.review_request_sent_at is
  'Timestamp of the automated review-request email, or null if not yet sent. Set at most once, like payment_reminder_sent_at/mahnung_sent_at/escalation_sent_at. Only ever considered for invoices that already have a paid_at (issue #157: no fabricated "paid" signal -- invoices without a real paid_at are never eligible).';

alter table public.organizations
  add column review_request_enabled boolean not null default false,
  add column review_request_days integer not null default 3,
  add column review_platform_url text;

comment on column public.organizations.review_request_enabled is
  'Opt-in (default false): the review-request cron only considers invoices belonging to organizations where this is true. Off by default so customers who never asked for review outreach are not emailed -- unlike dunning''s default-on, this is a marketing-adjacent send, not a payment obligation.';
comment on column public.organizations.review_request_days is
  'Days after an invoice''s paid_at before the automated review-request email is sent.';
comment on column public.organizations.review_platform_url is
  'Link to the organization''s review platform profile (e.g. Google Business Profile, Trustpilot) included in the review-request email. Null/empty disables sending regardless of review_request_enabled, since there would be nowhere to send the customer.';
