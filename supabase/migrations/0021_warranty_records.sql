-- Gewährleistung (warranty) record per job (closes #127).
--
-- Auto-generated from a signed quote at the moment it's signed (see
-- app/q/[token]/actions.ts::signQuote) -- no new user input required. Scope,
-- date, and line items are all derived from data already captured on the
-- quote at signing time. Like invoices (0008_invoices.sql), this is a frozen
-- snapshot: it never recomputes from live quote data later, so it stays a
-- true record of what was actually signed off on even if quote_line_items
-- were ever edited afterwards (in practice a 'signed' quote is already
-- treated as immutable at the app layer).
--
-- Warranty window: hardcoded to 24 months (2 years), the German statutory
-- minimum (Gewährleistungsfrist, BGB §634a) for a Werkvertrag. The actual
-- statutory window can run 2-5 years depending on the nature of the work
-- (e.g. building-related work can be longer), and a real product would
-- likely want this configurable per organization/job type. Out of scope for
-- this change -- documented here as a deliberate simplifying assumption.
-- warranty_period_months is stored per-row (not hardcoded at the query
-- layer) specifically so a future migration can make the default
-- configurable per organization without needing to backfill this column.
create table public.warranty_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  scope_description text not null,
  line_items_snapshot jsonb not null,
  warranty_start_date date not null,
  warranty_period_months integer not null default 24,
  warranty_expiry_date date not null,
  created_at timestamptz not null default now(),
  unique (quote_id)
);

alter table public.warranty_records enable row level security;

-- Owner-scoped select/insert only, mirroring public.invoices: a warranty
-- record is an immutable snapshot taken at signing time, so no update/delete
-- policy is provided -- there is intentionally no app-level path to edit or
-- remove one once created.
create policy "Users can view their own warranty records"
  on public.warranty_records for select
  using (auth.uid() = user_id);

create policy "Users can insert their own warranty records"
  on public.warranty_records for insert
  with check (auth.uid() = user_id);

create index warranty_records_customer_id_idx on public.warranty_records (customer_id);
