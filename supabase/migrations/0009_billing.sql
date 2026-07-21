-- Stripe SaaS billing: subscription state.
--
-- This is a SEPARATE table from business_settings, not new columns on it, because
-- business_settings' existing UPDATE RLS policy (0004_business_settings.sql) lets
-- any authenticated user update every column on their own row via the client-side
-- Supabase API. Putting subscription_status there would let a user just PATCH their
-- own row to subscription_status='active' and bypass billing entirely. This table
-- has a SELECT-only policy for the owning user -- writes only happen via the
-- webhook route using the service-role client (lib/supabase/admin.ts), which
-- bypasses RLS entirely, so no client-writable policy exists at all.

create table public.billing (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text,
  trial_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.billing enable row level security;

create policy "Users can view their own billing row"
  on public.billing for select
  using (auth.uid() = user_id);

-- No insert/update/delete policy for the `authenticated` role: rows are only
-- ever written by the webhook route via the service-role client, which bypasses
-- RLS. This is intentional -- do not add a client-writable policy here.
