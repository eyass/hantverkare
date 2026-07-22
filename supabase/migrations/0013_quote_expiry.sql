-- Quote expiry + automatic follow-up reminders (issue #49).
--
-- A finalized (status = 'final') quote is only actionable for a limited time
-- before the customer should be nudged to sign. expires_at is set by the app
-- when a quote transitions draft -> final (see finalizeQuote in
-- app/(app)/quotes/[id]/actions.ts), defaulting to 14 days out. It stays null
-- for draft quotes (not yet sent) and signed quotes don't need it anymore,
-- though we leave whatever value was set rather than clearing it.
--
-- expiry_reminder_sent_at guards the reminder cron
-- (app/api/cron/quote-expiry-reminders/route.ts) against sending duplicate
-- reminder emails: the cron only picks up quotes where this is still null.

alter table public.quotes
  add column expires_at timestamptz,
  add column expiry_reminder_sent_at timestamptz;
