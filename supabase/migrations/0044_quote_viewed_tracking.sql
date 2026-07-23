-- Quote view tracking (issue #208).
--
-- Problem this addresses: today a tradesperson has no way to tell whether a
-- customer has actually opened the public quote link they were sent -- the
-- only signals are signed_at/declined_at, which only fire once the customer
-- has taken an action, not simply looked. A tradesperson following up on a
-- quote can't distinguish "ignored" from "hasn't seen it yet".
--
-- The fix: a single nullable "viewed_at" timestamp on quotes, stamped once
-- (set-once, never-unset) the first time the public /q/[token] page is
-- rendered for that quote -- the same pattern this repo already uses for
-- paid_at/deposit_paid_at/signed_at: null until the event happens, then
-- frozen at the first occurrence. Set only when currently null, so re-visits
-- (the tradesperson previewing their own link, the customer reloading the
-- page) never overwrite the original first-view timestamp.
--
-- Columns:
--   viewed_at -- null until the public quote page has been loaded once for
--                this quote (via app/q/[token]/page.tsx), then frozen at
--                that first load. Purely informational for the
--                tradesperson-facing QuoteEditor UI -- never affects
--                pricing, signing, or any other quote lifecycle logic.
--
-- No RLS changes needed: this is a plain column on quotes, which already has
-- owner/member-scoped RLS (is_org_member(organization_id)) from
-- 0001_init.sql / 0002_quotes.sql. The public page stamps it via the
-- service-role admin client, exactly as it already does for other
-- customer-facing writes (signed_at, declined_at, deposit_paid_at).

alter table public.quotes
  add column viewed_at timestamptz;

comment on column public.quotes.viewed_at is
  'Timestamp of the first time the public /q/[token] quote page was loaded for this quote (issue #208). Null until then, set once and never unset (matches the paid_at/deposit_paid_at/signed_at pattern). Purely informational for the tradesperson-facing UI.';
