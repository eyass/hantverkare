-- Materials/inventory tracking tied to the price list (closes #125).
--
-- Scope for v1 (kept intentionally tight -- see issue #125's own scope note):
--   * Optional stock quantity tracking per price list item ("track_stock" is
--     opt-in per item; existing items are unaffected -- track_stock defaults
--     false and stock_quantity/low_stock_threshold default null).
--   * Decrement stock when a quote is signed, gated on a NEW per-organization
--     toggle (organizations.inventory_decrement_enabled) that defaults FALSE,
--     matching the precedent set by sms_notifications_enabled in
--     0016_sms_notifications.sql -- existing orgs see no behavior change until
--     an owner opts in via Team settings.
--   * Low-stock indicator (computed in the app from stock_quantity vs.
--     low_stock_threshold -- no DB view needed for v1) and a manual restock
--     action (just an authenticated update/RPC call, no supplier integration).
--   * Explicitly OUT of scope (YAGNI, matches the issue): live supplier
--     ordering/reordering APIs. Nothing here talks to any external inventory
--     or supplier system.
--
-- This migration was scoped T2 in the issue, but per CLAUDE.md any change
-- under supabase/migrations/ is T3 (schema change) -- reassigned to T3 here.
-- A human must apply this migration to the real Supabase project; it is not
-- run automatically by this change.

-- 1. Price list items gain optional stock tracking fields.
alter table public.price_list_items
  add column track_stock boolean not null default false,
  add column stock_quantity numeric,
  add column low_stock_threshold numeric;

alter table public.price_list_items
  add constraint price_list_items_stock_quantity_check
  check (stock_quantity is null or stock_quantity >= 0);

alter table public.price_list_items
  add constraint price_list_items_low_stock_threshold_check
  check (low_stock_threshold is null or low_stock_threshold >= 0);

comment on column public.price_list_items.track_stock is
  'Opt-in per item (default false): whether stock_quantity is tracked/decremented for this item at all.';
comment on column public.price_list_items.stock_quantity is
  'Current stock on hand. Null means "not tracked", never treated as zero. Only meaningful when track_stock is true.';
comment on column public.price_list_items.low_stock_threshold is
  'When stock_quantity <= this value (and track_stock is true), the app shows a low-stock indicator. Null means no threshold configured yet.';

-- No RLS policy changes needed: these are just additional columns on
-- price_list_items, already covered by the org-member select/insert/update/
-- delete policies from 0010_organizations.sql.

-- 2. Organization-level opt-in: decrement stock automatically when a quote is
-- signed. Defaults false -- see rationale above (mirrors 0016's precedent).
alter table public.organizations
  add column inventory_decrement_enabled boolean not null default false;

comment on column public.organizations.inventory_decrement_enabled is
  'Opt-in (default false): if true, signing a quote decrements stock_quantity on any price_list_items linked to its line items (only for items with track_stock = true). Defaults false since some trades do not want automatic decrement.';

-- 3. Best-effort link from a quote line item back to the price list item it
-- was priced from. Nullable and set-null-on-delete: line items are generated
-- by matching an AI-produced (or template-copied) description/unit/price
-- against the org's price list at insert time (see
-- lib/inventory/matchPriceListItem.ts) -- it is a best-effort match, not a
-- guaranteed one, so this must stay optional. Deleting a price list item must
-- never cascade-delete historic quote line items.
alter table public.quote_line_items
  add column price_list_item_id uuid references public.price_list_items(id) on delete set null;

comment on column public.quote_line_items.price_list_item_id is
  'Best-effort link to the price list item this line was priced from (see lib/inventory/matchPriceListItem.ts). Null if no confident match was found -- never treat null as an error.';

create index quote_line_items_price_list_item_id_idx on public.quote_line_items(price_list_item_id);

-- 4. Atomic, race-safe stock mutation helpers. Plain client-side
-- read-then-write (`update ... set stock_quantity = current - qty`) would
-- race under concurrent signings; these do the read+write in one statement.
-- Both are SECURITY INVOKER (the default) so ordinary RLS/policies on
-- price_list_items still apply to callers -- no privilege escalation.
--
-- Decrementing floors at 0 rather than going negative: a best-effort estimate
-- should never render as a nonsensical negative "in stock" count. This means
-- an oversold item shows as merely out of stock (0), not how oversold it is --
-- an accepted simplification for v1.
create or replace function public.decrement_price_list_stock(item_id uuid, qty numeric)
returns void
language sql
as $$
  update public.price_list_items
  set stock_quantity = greatest(0, stock_quantity - qty)
  where id = item_id
    and track_stock
    and stock_quantity is not null;
$$;

create or replace function public.increment_price_list_stock(item_id uuid, qty numeric)
returns void
language sql
as $$
  update public.price_list_items
  set stock_quantity = coalesce(stock_quantity, 0) + qty
  where id = item_id;
$$;
