-- Customer-facing quote decline flow, with optional reason (closes #76).
--
-- Modeling choice: orthogonal nullable columns on `quotes`, the same
-- lightweight pattern used by 0013_quote_expiry.sql for expires_at /
-- expiry_reminder_sent_at, rather than adding a new 'declined' value to the
-- quotes_status_check enum (see 0006_esignature.sql for that check).
--
-- Reasoning: `status` already models the quote's core lifecycle stage
-- (draft -> final -> signed). "Declined" isn't a further lifecycle stage --
-- it's a customer response that can only happen to a 'final' quote, and it
-- is mutually exclusive with signing (enforced at the application layer in
-- app/q/[token]/actions.ts via .eq("status", "final").is("declined_at", null)
-- guards on both the sign and decline updates). Modeling it as a new status
-- value would force every other status-based query/UI in the app (the
-- quotes list filter, the expiry-reminder cron, QuoteEditor's status pill)
-- to special-case a fourth state that behaves like 'final' in every respect
-- except this one flag. An orthogonal timestamp keeps `status` untouched and
-- lets callers just check `declined_at is not null` wherever relevant.

alter table public.quotes
  add column declined_at timestamptz,
  add column decline_reason text;
