-- Automated Mahnwesen / payment reminders (issue #122).
--
-- Design (T2, no schema risk beyond tracking timestamps -- same pattern as
-- 0013_quote_expiry.sql's expiry_reminder_sent_at):
--
--   1. Invoices need a due date and a "has it been paid" flag. Neither
--      existed before this migration -- 0008_invoices.sql only tracked
--      issued_at. due_date defaults to issued_at + 14 days (a reasonable
--      German B2C default payment term); organizations can't yet configure
--      this per-org, matching "keep scope small" -- timing is configurable
--      at the *reminder* level instead (see below).
--
--   2. Three reminder-sent timestamps, one per stage of the dunning
--      sequence (friendly reminder -> formal Mahnung -> escalation),
--      mirroring quotes.expiry_reminder_sent_at exactly: each stage is sent
--      at most once (idempotent, gated by `is X_sent_at null` in the cron
--      query) and is never un-sent or resent automatically.
--
--   3. Per-organization configuration lives on `organizations`, following
--      the precedent of sms_notifications_enabled (0016) and the
--      team-permission booleans (0014): opt-out toggle + day thresholds for
--      each stage, all with sane defaults so existing organizations get the
--      feature automatically (unlike SMS, dunning has no direct send cost,
--      so it defaults to enabled).
--
-- Verzugszinsen (statutory default interest, BGB SS 288) is NOT stored --
-- it's derived at send time from the invoice total and days overdue by the
-- pure function in lib/invoices/dunning.ts, the same "pure date/money math,
-- computed on read" approach as lib/quotes/expiry.ts.

alter table public.invoices
  add column due_date timestamptz,
  add column paid_at timestamptz,
  add column payment_reminder_sent_at timestamptz,
  add column mahnung_sent_at timestamptz,
  add column escalation_sent_at timestamptz;

-- Backfill due_date for any existing invoices (none expected in a real
-- database yet, but keep this safe/idempotent regardless) before tightening
-- to NOT NULL.
update public.invoices
  set due_date = issued_at + interval '14 days'
  where due_date is null;

alter table public.invoices
  alter column due_date set not null,
  alter column due_date set default (now() + interval '14 days');

comment on column public.invoices.due_date is
  'When payment is due. Defaults to issued_at + 14 days at insert time (a standard German B2C payment term). Drives the dunning cron (app/api/cron/invoice-dunning): reminder timing is computed from this date, not from issued_at.';
comment on column public.invoices.paid_at is
  'Set once the invoice is marked paid (manual, out of scope for this issue -- no UI/action writes it yet). While null, the invoice is eligible for dunning reminders; once set, the cron skips it immediately.';
comment on column public.invoices.payment_reminder_sent_at is
  'Timestamp of the friendly first-stage payment reminder, or null if not yet sent. Set at most once, like quotes.expiry_reminder_sent_at.';
comment on column public.invoices.mahnung_sent_at is
  'Timestamp of the formal Mahnung (stage 2, includes Verzugszinsen calculation), or null if not yet sent.';
comment on column public.invoices.escalation_sent_at is
  'Timestamp of the final escalation notice (stage 3), or null if not yet sent.';

-- Per-organization dunning configuration. Defaults preserve "the feature is
-- on for everyone" (no cost to sending email, unlike SMS) while letting an
-- owner turn it off or retime it from team settings later.
alter table public.organizations
  add column dunning_enabled boolean not null default true,
  add column dunning_reminder_days integer not null default 3,
  add column dunning_mahnung_days integer not null default 10,
  add column dunning_escalation_days integer not null default 24,
  add column dunning_tone text not null default 'neutral' check (dunning_tone in ('freundlich', 'neutral', 'streng'));

comment on column public.organizations.dunning_enabled is
  'Opt-out (default true): if false, the invoice-dunning cron skips every invoice belonging to this organization entirely.';
comment on column public.organizations.dunning_reminder_days is
  'Days after an invoice''s due_date before the friendly stage-1 reminder is sent. Should stay < dunning_mahnung_days for the sequence to make sense; not enforced in SQL (org-owner-configurable, like the other dunning_* columns) -- validated in the settings form instead.';
comment on column public.organizations.dunning_mahnung_days is
  'Days after due_date before the formal Mahnung (stage 2, with Verzugszinsen) is sent.';
comment on column public.organizations.dunning_escalation_days is
  'Days after due_date before the final escalation notice (stage 3) is sent.';
comment on column public.organizations.dunning_tone is
  'Wording register for dunning emails/SMS: freundlich (friendly), neutral (default), or streng (stern). Purely cosmetic -- does not change which stage fires when.';

-- No new RLS policy needed: these are plain columns on tables that already
-- have owner/member-scoped select policies (0010_organizations.sql's
-- "Members can view their org invoices" / organizations select policy).
-- Writes to invoices.* dunning columns and organizations.dunning_* only ever
-- happen via the service-role admin client (the cron route, or a future
-- owner-gated settings action mirroring updateTeamPermissions) -- no new
-- client-writable surface is introduced here.
