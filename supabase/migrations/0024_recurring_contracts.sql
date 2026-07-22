-- Recurring maintenance contracts (issue #126).
--
-- Risk tier note: the issue itself is labeled T2-medium, but per CLAUDE.md
-- "Any change under supabase/migrations/, auth, payments, or env is T3" --
-- this migration adds a brand-new table, so the whole feature is treated as
-- T3 regardless of the label (see the PR description for the explicit
-- reassignment).
--
-- A signed quote (status = 'signed', see 0006_esignature.sql) can be turned
-- into a `contracts` row -- a lightweight template that says "regenerate this
-- quote for this customer every {interval}". No proration/billing logic here,
-- just enough state for a cron (app/api/cron/contract-renewal/route.ts) to
-- find due contracts and spin up a fresh quote from the original.
--
-- Conventions mirrored from the existing schema:
--   * organization_id + org-scoped RLS via is_org_member(), same as quotes
--     (0010_organizations.sql) -- NOT the older per-user_id pattern from
--     0001-0009, since organizations.sql is the current model everything
--     else has been migrated to.
--   * user_id kept alongside organization_id as the creating user, same as
--     invoices.user_id (0008_invoices.sql) -- a "who did this" audit column,
--     not itself part of the access-control check.
--   * customer_id nullable FK to customers with on delete set null, exactly
--     like quotes.customer_id (0007_quote_customer_link.sql).
--   * source_quote_id FK to quotes(id) on delete cascade: a contract cannot
--     outlive the quote it was generated from (there is nothing left to
--     duplicate line items from).

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_quote_id uuid not null references public.quotes(id) on delete cascade,
  customer_id uuid references public.customers(id) on delete set null,
  interval text not null check (interval in ('monthly', 'quarterly', 'yearly')),
  status text not null default 'active' check (status in ('active', 'paused', 'cancelled')),
  next_due_date date not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Efficient lookup for the daily cron: "every active contract due today or
-- earlier". status can change over a contract's life (paused/cancelled), so
-- a plain composite index on both columns is used rather than a partial one
-- baked to status = 'active' -- still sargable for the cron's
-- `.eq("status", "active").lte("next_due_date", today)` query.
create index contracts_status_next_due_date_idx
  on public.contracts (status, next_due_date);

alter table public.contracts enable row level security;

create policy "Members can view their org contracts"
  on public.contracts for select
  using (public.is_org_member(organization_id));

create policy "Members can insert contracts in their org"
  on public.contracts for insert
  with check (public.is_org_member(organization_id));

create policy "Members can update their org contracts"
  on public.contracts for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- No delete policy: contracts are paused/cancelled via status, not deleted,
-- mirroring invoices' "no update/delete, use a real-world correction instead"
-- philosophy (0008_invoices.sql) -- a cancelled contract is still useful
-- history of what was set up for a customer.
