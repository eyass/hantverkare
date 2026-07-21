-- Read-only (from the app's perspective) seeded price list a tradesperson's
-- quotes are generated against.
create table if not exists public.price_list_items (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  unit text not null,
  unit_price_cents integer not null,
  category text not null
);

alter table public.price_list_items enable row level security;

create policy "Price list items are viewable by everyone"
  on public.price_list_items for select
  using (true);

-- No insert/update/delete policy: correctly defaults to deny. The seeded price
-- list is not editable via the app in this feature.

-- No auth yet in this prototype: quotes are not scoped to a user. Policies are
-- intentionally open — revisit once quotes are tied to a real account.
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  customer_description text not null,
  status text not null default 'draft' check (status in ('draft', 'final')),
  subtotal_cents integer not null default 0,
  vat_cents integer not null default 0,
  total_cents integer not null default 0,
  created_at timestamptz not null default now(),
  finalized_at timestamptz
);

alter table public.quotes enable row level security;

create policy "Quotes are viewable by everyone"
  on public.quotes for select
  using (true);

create policy "Anyone can insert quotes"
  on public.quotes for insert
  with check (true);

create policy "Anyone can update quotes"
  on public.quotes for update
  using (true)
  with check (true);

-- Known gap: RLS does not enforce that a 'final' quote is immutable — only the
-- app's Server Actions check status before allowing edits. Accepted as a
-- prototype-scope limitation (no auth yet); revisit with a DB-level guard
-- (e.g. a trigger) once quotes are tied to real accounts.

create table if not exists public.quote_line_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  description text not null,
  quantity numeric not null check (quantity > 0),
  unit text not null,
  unit_price_cents integer not null check (unit_price_cents > 0),
  line_total_cents integer not null,
  position integer not null
);

alter table public.quote_line_items enable row level security;

create policy "Line items are viewable by everyone"
  on public.quote_line_items for select
  using (true);

create policy "Anyone can insert line items"
  on public.quote_line_items for insert
  with check (true);

create policy "Anyone can update line items"
  on public.quote_line_items for update
  using (true)
  with check (true);

-- Same known gap as quotes above: no DB-level guard against editing line
-- items on an already-finalized quote, only the app's Server Actions.

-- Seed a sample German Handwerker (Sanitär/Elektro-focused) price list, giving
-- the AI real pricing context to match job descriptions against.
insert into public.price_list_items (label, unit, unit_price_cents, category) values
  ('Sanitärinstallation, Arbeitsstunde', 'Stunde', 6500, 'Sanitär'),
  ('Wasserhahn montieren', 'Stück', 4500, 'Sanitär'),
  ('Spüle austauschen', 'Stück', 8000, 'Sanitär'),
  ('Rohrverlegung, Meter', 'Meter', 3200, 'Sanitär'),
  ('Abfluss reinigen', 'Stück', 5500, 'Sanitär'),
  ('Elektroinstallation, Arbeitsstunde', 'Stunde', 7000, 'Elektro'),
  ('Steckdose installieren', 'Stück', 4000, 'Elektro'),
  ('Anfahrtspauschale', 'Pauschale', 3500, 'Allgemein');
