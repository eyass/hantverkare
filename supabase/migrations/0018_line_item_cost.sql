-- Optional per-line-item cost tracking: what the tradesperson actually pays
-- for materials or their own labor, as distinct from unit_price_cents (what
-- the customer is charged). Nullable and purely additive — a tradesperson
-- may not fill this in for every line item, and reports must treat a missing
-- value as "unknown", never as zero cost (that would overstate margin).
alter table public.quote_line_items
  add column if not exists cost_cents integer;

alter table public.quote_line_items
  add constraint quote_line_items_cost_cents_check
  check (cost_cents is null or cost_cents >= 0);

-- No RLS changes: existing "quote_line_items" policies already cover select/
-- insert/update of this column since it's just an additional column on the
-- same table.
