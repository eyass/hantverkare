-- Smarter AI quote line items (issue #200).
--
-- Problem this fixes: generateLineItems (lib/quotes/generateLineItems.ts)
-- used to hand the AI a flat, ID-less price list dump and let it free-write
-- its own unitPriceCents for every line item -- it never actually referenced
-- a specific price_list_items row. app/(app)/quotes/new/actions.ts then had
-- to reconnect each AI-written line item back to a real price list row via
-- matchPriceListItemId() (lib/inventory/matchPriceListItem.ts), a fragile
-- heuristic that matches on exact unit + unit_price_cents and silently
-- returns null the moment the AI's price drifts even slightly. That broke
-- stock decrement/cost tracking and let quoted prices drift from the
-- tradesperson's actual price list.
--
-- The fix: the AI is now given each price list item's id and required to
-- either pick one by id (server resolves the real unit/price from that row,
-- never trusting an AI-echoed price for a catalog item) or explicitly
-- declare a custom item with its own price. That closes the drift bug at
-- the source instead of papering over it after the fact -- see
-- lib/quotes/generateLineItems.ts for the resolution logic.
--
-- Columns:
--   item_type          -- 'labor' | 'material', set by the AI generation
--                          path per line item (issue #200's labor/material
--                          split, a gap vs. the competitor benchmark -- see
--                          docs/superpowers/specs/2026-07-23-*.md). Nullable
--                          for backward compat: existing rows and
--                          template-copied items (buildLineItemsFromTemplate,
--                          lib/quoteTemplates/templateBuilder.ts) don't set
--                          this and that's fine -- the UI only shows the
--                          badge when non-null.
--   quantity_reasoning -- short human-readable justification for the
--                          quantity the AI chose (e.g. "6m² Boden / 1,5m²
--                          pro Paket = 4 Pakete, aufgerundet"), forced as a
--                          required field in the AI tool schema so the model
--                          has to show its work instead of emitting an
--                          unexplainable number. Nullable for the same
--                          backward-compat reason as item_type -- old rows
--                          and manually-added/template items have none, and
--                          the review screen simply omits the helper line
--                          when null.
--
-- No new RLS policy needed: these are plain columns on
-- quote_line_items, which already has owner/member-scoped RLS
-- (is_org_member(organization_id)) from 0001_init.sql / 0002_quotes.sql.

alter table public.quote_line_items
  add column item_type text check (item_type is null or item_type in ('labor', 'material')),
  add column quantity_reasoning text;

comment on column public.quote_line_items.item_type is
  'Optional labor/material classification set by the AI generation path (issue #200). Null for pre-existing rows and template-copied items that don''t classify items.';
comment on column public.quote_line_items.quantity_reasoning is
  'Optional short human-readable justification for this line item''s quantity, set by the AI generation path (issue #200) so the tradesperson can sanity-check a quantity instead of it being an unexplainable black box. Null for pre-existing rows and non-AI-generated items.';
