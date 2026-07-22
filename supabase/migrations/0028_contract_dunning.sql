-- Renewal-failure / dunning handling for recurring contracts (issue #153).
--
-- Risk tier note: per CLAUDE.md, "Any change under supabase/migrations/... is
-- T3" -- this migration adds new columns to an existing table, so the whole
-- feature is treated as T3 procedurally even though the issue itself is
-- labeled T2-medium (same reassignment rationale as
-- 0024_recurring_contracts.sql's own header comment).
--
-- Context: app/api/cron/contract-renewal/route.ts (issue #126) regenerates a
-- fresh draft quote for a contract every time its next_due_date arrives, but
-- previously never recorded *which* quote it created, nor whether that
-- generation attempt failed. Meanwhile app/api/cron/invoice-dunning/route.ts
-- (issue #122) already tracks per-invoice reminder/Mahnung/escalation
-- timestamps, but has no notion of "this invoice came from a contract
-- renewal, and the contract itself should be flagged if it goes unpaid."
--
-- Three new columns close that gap, all following the existing dunning
-- precedent (0025_invoice_dunning.sql) of plain nullable timestamp columns
-- read by a pure function rather than a stored "status" enum -- the actual
-- at-risk/lapsed determination stays computed at read time (see
-- lib/contracts/dunning.ts), these columns just supply the raw inputs:
--
--   * latest_quote_id: FK to the most recently generated renewal quote for
--     this contract (backfilled to source_quote_id for existing rows, since
--     that's the only quote they have so far). Lets the dunning cron and the
--     /contracts list join through to that quote's invoice (if any) to check
--     its payment_reminder_sent_at / mahnung_sent_at / escalation_sent_at /
--     paid_at without having to search invoices by contract_id (no such
--     column exists, and adding one is unnecessary -- quotes.id is already
--     the join key invoices use).
--   * renewal_failed_at: set by the renewal cron whenever it hits an error
--     partway through generating the next period's quote for this contract
--     (invalid interval, missing source quote/line items, insert failure,
--     etc.) -- i.e. "the contract failed to renew", the second condition
--     from the issue. Cleared back to null the next time a renewal for this
--     contract succeeds.
--   * dunning_notified_at: set once an at-risk notification has been sent
--     for the contract's *current* risk episode, mirroring
--     invoices.payment_reminder_sent_at's "send once, don't spam" gate.
--     Cleared back to null once the contract recovers (renews successfully,
--     or its outstanding invoice gets paid) so a future episode notifies
--     again.

alter table public.contracts
  add column latest_quote_id uuid references public.quotes(id) on delete set null,
  add column renewal_failed_at timestamptz,
  add column dunning_notified_at timestamptz;

-- Backfill: every existing contract's only quote so far is its source quote.
update public.contracts
  set latest_quote_id = source_quote_id
  where latest_quote_id is null;

comment on column public.contracts.latest_quote_id is
  'The most recently generated renewal quote for this contract (or source_quote_id if it has never renewed yet). Used to look up that quote''s invoice for dunning purposes -- see lib/contracts/dunning.ts and app/api/cron/contract-dunning/route.ts.';
comment on column public.contracts.renewal_failed_at is
  'Set when app/api/cron/contract-renewal (issue #126) fails to generate the next period''s quote for this contract. Cleared on the next successful renewal. Null means the last renewal attempt (if any) succeeded.';
comment on column public.contracts.dunning_notified_at is
  'Set once an at-risk/lapsed notification has been sent for this contract''s current risk episode (see app/api/cron/contract-dunning/route.ts), so it fires at most once per episode. Cleared once the contract recovers.';

-- No RLS change needed: these are plain columns on a table that already has
-- org-member-scoped select/update policies (0024_recurring_contracts.sql).
-- Writes to renewal_failed_at/dunning_notified_at only ever happen via the
-- service-role admin client (the cron routes), never from client code.
