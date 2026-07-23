-- Multi-room / multi-phase line-item grouping (issue #205).
--
-- Problem this addresses: a job description spanning multiple rooms or
-- phases (e.g. "Küche und Bad renovieren", or a job with clear
-- prep/execution/cleanup phases) currently produces one flat,
-- undifferentiated line-item list -- there is no concept of grouping
-- anywhere in the schema or UI today. See
-- docs/superpowers/specs/2026-07-23-line-item-grouping-design.md.
--
-- The fix: a single nullable "group_label" column on quote_line_items --
-- the tradesperson's own vocabulary (room, trade, or phase name), not a
-- fixed taxonomy. Rejected alternative: a separate
-- quote_line_item_groups table with its own id/order -- unnecessary
-- normalization for something that's just a shared label with no
-- independent metadata (no per-group description, no per-group discount),
-- mirroring this repo's existing preference for plain additive columns
-- over new join tables when the "entity" has no independent identity (see
-- item_type/quantity_reasoning/confidence from #200-#202, all plain
-- columns on the same row rather than side tables).
--
-- Ordering: "position" remains the single global sort key across the
-- whole quote, exactly as today -- this migration does not add a second
-- per-group ordering column. Group boundaries are derived at render time
-- by lib/quotes/groupLineItems.ts: cluster items by group_label, order
-- each cluster by the minimum position among its members (first-appearance
-- order), and sort within a cluster by position. A quote with no grouped
-- items renders byte-identical to today (empty/absent group_label on every
-- row is exactly the current flat-list behavior).
--
-- Columns:
--   group_label -- optional free-text label ("Küche", "Vorbereitung", ...)
--                  set either by the AI generation path
--                  (lib/quotes/generateLineItems.ts, issue #205) when a job
--                  description clearly spans multiple distinct
--                  rooms/areas/phases, or manually by the tradesperson via
--                  the QuoteEditor group-assignment control. Null for the
--                  common single-room/single-phase case, and for all
--                  pre-existing rows. Length-capped at 60 chars for UI
--                  sanity -- content itself is free text, not constrained
--                  to a fixed taxonomy.
--
-- No RLS changes needed: this is a plain column on quote_line_items, which
-- already has owner/member-scoped RLS (is_org_member(organization_id))
-- from 0001_init.sql / 0002_quotes.sql.

alter table public.quote_line_items
  add column group_label text check (group_label is null or char_length(group_label) <= 60);

comment on column public.quote_line_items.group_label is
  'Optional free-text group label (room/trade/phase, e.g. "Küche", "Vorbereitung") for organizing a multi-area quote''s line items (issue #205). Set by the AI generation path when a job clearly spans multiple areas, or manually by the tradesperson. Null for the common single-group case and for pre-existing rows -- purely a display/organization concern, never affects pricing or totals.';
