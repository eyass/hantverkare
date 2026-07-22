-- Price list creation wizard: curated starter templates per trade.
-- These are GLOBAL reference tables (not organization_id-scoped) -- every
-- user reads the same catalog. Read-only from the app: no insert/update/
-- delete policy for any client role. Edit templates by running SQL directly
-- in the Supabase SQL editor.

create table public.price_list_templates (
  id uuid primary key default gen_random_uuid(),
  trade_key text not null unique,
  trade_label text not null,
  sort_order integer not null default 0
);
alter table public.price_list_templates enable row level security;

create policy "Authenticated users can view price list templates"
  on public.price_list_templates for select
  to authenticated using (true);

create table public.price_list_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.price_list_templates(id) on delete cascade,
  label text not null,
  unit text not null,
  default_unit_price_cents integer not null,
  category text not null,
  sort_order integer not null default 0
);
alter table public.price_list_template_items enable row level security;

create policy "Authenticated users can view price list template items"
  on public.price_list_template_items for select
  to authenticated using (true);

-- Seed data. Prices are starting estimates sourced from public German trade
-- price guides (2026) -- sanity-check against your own market before relying
-- on them; they are not verified quotes.

insert into public.price_list_templates (trade_key, trade_label, sort_order) values
  ('maler', 'Maler', 1),
  ('elektriker', 'Elektriker', 2),
  ('sanitaer_heizung', 'Sanitär & Heizung', 3),
  ('bodenleger', 'Bodenleger', 4);

insert into public.price_list_template_items (template_id, label, unit, default_unit_price_cents, category, sort_order)
select t.id, item.label, item.unit, item.price_cents, item.category, item.sort_order
from public.price_list_templates t
join (
  values
    ('maler', 'Wände streichen (Innenraum)', 'm²', 1200, 'Malerarbeiten', 1),
    ('maler', 'Decke streichen', 'm²', 1400, 'Malerarbeiten', 2),
    ('maler', 'Tapezieren', 'm²', 1600, 'Malerarbeiten', 3),
    ('maler', 'Untergrund spachteln', 'm²', 900, 'Malerarbeiten', 4),
    ('maler', 'Fenster/Türen lackieren', 'Stück', 8500, 'Malerarbeiten', 5),
    ('maler', 'Anfahrt', 'Pauschale', 4500, 'Sonstiges', 6),
    ('maler', 'Abdeckarbeiten', 'Pauschale', 6000, 'Sonstiges', 7),
    ('elektriker', 'Steckdose setzen/tauschen', 'Stück', 4500, 'Elektroinstallation', 1),
    ('elektriker', 'Lichtschalter setzen/tauschen', 'Stück', 4000, 'Elektroinstallation', 2),
    ('elektriker', 'Deckenleuchte anschließen', 'Stück', 6500, 'Elektroinstallation', 3),
    ('elektriker', 'Sicherungskasten prüfen/warten', 'Pauschale', 12000, 'Elektroinstallation', 4),
    ('elektriker', 'Kabel verlegen (Unterputz)', 'm', 1800, 'Elektroinstallation', 5),
    ('elektriker', 'Std. Arbeitszeit', 'Std.', 7500, 'Arbeitszeit', 6),
    ('elektriker', 'Anfahrt', 'Pauschale', 4500, 'Sonstiges', 7),
    ('sanitaer_heizung', 'Wasserhahn tauschen', 'Stück', 9500, 'Sanitär', 1),
    ('sanitaer_heizung', 'WC tauschen', 'Stück', 35000, 'Sanitär', 2),
    ('sanitaer_heizung', 'Heizkörper entlüften', 'Stück', 3500, 'Heizung', 3),
    ('sanitaer_heizung', 'Rohrleitung erneuern', 'm', 4500, 'Sanitär', 4),
    ('sanitaer_heizung', 'Heizungswartung', 'Pauschale', 15000, 'Heizung', 5),
    ('sanitaer_heizung', 'Std. Arbeitszeit', 'Std.', 8000, 'Arbeitszeit', 6),
    ('sanitaer_heizung', 'Anfahrt', 'Pauschale', 4500, 'Sonstiges', 7),
    ('bodenleger', 'Laminat verlegen', 'm²', 2500, 'Bodenbelagsarbeiten', 1),
    ('bodenleger', 'Vinylboden verlegen', 'm²', 2800, 'Bodenbelagsarbeiten', 2),
    ('bodenleger', 'Alten Belag entfernen', 'm²', 900, 'Bodenbelagsarbeiten', 3),
    ('bodenleger', 'Untergrund ausgleichen', 'm²', 1100, 'Bodenbelagsarbeiten', 4),
    ('bodenleger', 'Sockelleisten montieren', 'm', 700, 'Bodenbelagsarbeiten', 5),
    ('bodenleger', 'Anfahrt', 'Pauschale', 4500, 'Sonstiges', 6)
) as item(trade_key, label, unit, price_cents, category, sort_order)
  on item.trade_key = t.trade_key;
