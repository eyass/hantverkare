-- Business settings: one row per account, used for future quote/invoice branding
-- (issue #11). All fields nullable -- a business may not have every field on hand
-- yet (e.g. VAT ID pending registration). No logo field: Supabase Storage setup
-- is out of scope for this first version (YAGNI).

create table public.business_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  company_name text,
  address text,
  vat_id text,
  tax_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.business_settings enable row level security;

create policy "Users can view their own business settings"
  on public.business_settings for select
  using (auth.uid() = user_id);

create policy "Users can insert their own business settings"
  on public.business_settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own business settings"
  on public.business_settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
