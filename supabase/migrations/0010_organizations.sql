-- Multi-user / team accounts (issue #15). The single largest, highest-risk
-- migration in the project: it moves the row-ownership model of every owned
-- table from user_id-scoped to organization_id-scoped RLS.
--
-- Structure:
--   1. organizations + organization_members + organization_invites (new tables)
--   2. SECURITY DEFINER membership helpers (used by every RLS policy below;
--      they intentionally bypass RLS on organization_members to avoid the
--      classic policy-recursion problem where a table's policy queries a table
--      whose own policy queries back)
--   3. add organization_id to every owned table
--   4. BACKFILL: one org per existing user, that user becomes its owner, every
--      existing owned row gets that org (the whole file runs as one implicit
--      transaction in the Supabase SQL editor)
--   5. tighten organization_id to NOT NULL now that it is backfilled, and
--      repoint the per-user keys (business_settings / invoice_counters /
--      billing) at organization_id
--   6. drop every user_id-scoped RLS policy from 0001-0009 and recreate it
--      org-scoped
--   7. rewrite next_invoice_number() to be per-organization
--
-- This file is written to be safe to run once against a database that already
-- has real 0001-0009 data. It is NOT run against any real database by any
-- agent -- it is added to docs/MANUAL-STEPS-PENDING.md for the human to apply.

-- ---------------------------------------------------------------------------
-- 1. New tables
-- ---------------------------------------------------------------------------

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.organizations enable row level security;

-- One membership row per (organization, user). role gates owner-only actions
-- (invite/remove members, see billing). No client-writable policy exists on
-- this table at all: memberships are only ever written by the service-role
-- admin client (org creation on signup, invite acceptance, member removal),
-- with role computed server-side. This is what prevents a `member` from
-- PATCHing their own row to role='owner' from the browser.
create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

alter table public.organization_members enable row level security;

-- Pending invites. token is the unguessable capability used by the public
-- /invite/[token] accept flow (looked up via the service-role client, like
-- quotes' share_token). Writes happen only via the service-role admin client
-- (owner invites, acceptance stamps accepted_at); owners get a SELECT policy
-- to list pending invites in the team-settings UI.
create table public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  token uuid not null default gen_random_uuid() unique,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);

alter table public.organization_invites enable row level security;

-- ---------------------------------------------------------------------------
-- 2. Membership helper functions (SECURITY DEFINER -> bypass RLS internally)
-- ---------------------------------------------------------------------------

-- True if the calling user (auth.uid()) is a member of org_id (any role).
create or replace function public.is_org_member(org_id uuid)
returns boolean
language sql
security definer
stable
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = org_id
      and om.user_id = auth.uid()
  );
$$;

-- True if the calling user (auth.uid()) is an OWNER of org_id.
create or replace function public.is_org_owner(org_id uuid)
returns boolean
language sql
security definer
stable
set search_path = pg_catalog, public
as $$
  select exists (
    select 1
    from public.organization_members om
    where om.organization_id = org_id
      and om.user_id = auth.uid()
      and om.role = 'owner'
  );
$$;

-- ---------------------------------------------------------------------------
-- RLS policies on the new tables (defined here now that the helpers exist)
-- ---------------------------------------------------------------------------

-- organizations: members can see their own org. No client write policies --
-- orgs are created only by the service-role admin client.
create policy "Members can view their organization"
  on public.organizations for select
  using (public.is_org_member(id));

-- organization_members: a user can see the membership rows of any org they
-- belong to (so the team page can list teammates). The helper is SECURITY
-- DEFINER, so this policy referencing organization_members does not recurse.
-- No insert/update/delete policy: writes are service-role only.
create policy "Members can view memberships in their organizations"
  on public.organization_members for select
  using (public.is_org_member(organization_id));

-- organization_invites: only owners can list their org's invites. No client
-- write policy -- invites are created/accepted via the service-role client.
create policy "Owners can view their organization invites"
  on public.organization_invites for select
  using (public.is_org_owner(organization_id));

-- ---------------------------------------------------------------------------
-- 3. Add organization_id (nullable for now, backfilled below, then set NOT NULL)
-- ---------------------------------------------------------------------------

alter table public.quotes            add column organization_id uuid references public.organizations(id) on delete cascade;
alter table public.quote_line_items  add column organization_id uuid references public.organizations(id) on delete cascade;
alter table public.customers         add column organization_id uuid references public.organizations(id) on delete cascade;
alter table public.price_list_items  add column organization_id uuid references public.organizations(id) on delete cascade;
alter table public.business_settings add column organization_id uuid references public.organizations(id) on delete cascade;
alter table public.invoices          add column organization_id uuid references public.organizations(id) on delete cascade;
alter table public.invoice_counters  add column organization_id uuid references public.organizations(id) on delete cascade;
alter table public.billing           add column organization_id uuid references public.organizations(id) on delete cascade;

-- ---------------------------------------------------------------------------
-- 4. BACKFILL -- one org per existing user, that user as owner, all their rows
-- ---------------------------------------------------------------------------

-- Build a deterministic user->org mapping so every backfilled row can be tied
-- back to exactly one org. The set of existing users is derived from every
-- table that references auth.users so no user with data is missed (e.g. one who
-- has customers but no business_settings row). Temp table is dropped on commit.
create temporary table _user_org_map (
  user_id uuid primary key,
  organization_id uuid not null default gen_random_uuid()
) on commit drop;

insert into _user_org_map (user_id)
select distinct user_id from (
  select user_id from public.quotes
  union select user_id from public.quote_line_items
  union select user_id from public.customers
  union select user_id from public.price_list_items
  union select user_id from public.business_settings
  union select user_id from public.invoices
  union select user_id from public.invoice_counters
  union select user_id from public.billing
) all_users
where user_id is not null;

-- 4a. One organization per existing user; name = their company_name or default.
insert into public.organizations (id, name)
select
  m.organization_id,
  coalesce(nullif(trim(bs.company_name), ''), 'Mein Unternehmen')
from _user_org_map m
left join public.business_settings bs on bs.user_id = m.user_id;

-- 4b. Every existing user becomes the OWNER of their new org.
insert into public.organization_members (organization_id, user_id, role)
select m.organization_id, m.user_id, 'owner'
from _user_org_map m;

-- 4c. Stamp organization_id onto every existing owned row.
update public.quotes            t set organization_id = m.organization_id from _user_org_map m where m.user_id = t.user_id;
update public.quote_line_items  t set organization_id = m.organization_id from _user_org_map m where m.user_id = t.user_id;
update public.customers         t set organization_id = m.organization_id from _user_org_map m where m.user_id = t.user_id;
update public.price_list_items  t set organization_id = m.organization_id from _user_org_map m where m.user_id = t.user_id;
update public.business_settings t set organization_id = m.organization_id from _user_org_map m where m.user_id = t.user_id;
update public.invoices          t set organization_id = m.organization_id from _user_org_map m where m.user_id = t.user_id;
update public.invoice_counters  t set organization_id = m.organization_id from _user_org_map m where m.user_id = t.user_id;
update public.billing           t set organization_id = m.organization_id from _user_org_map m where m.user_id = t.user_id;

-- ---------------------------------------------------------------------------
-- 5. Enforce NOT NULL now that every row is backfilled, and repoint per-user
--    keys at organization_id.
-- ---------------------------------------------------------------------------

alter table public.quotes            alter column organization_id set not null;
alter table public.quote_line_items  alter column organization_id set not null;
alter table public.customers         alter column organization_id set not null;
alter table public.price_list_items  alter column organization_id set not null;
alter table public.business_settings alter column organization_id set not null;
alter table public.invoices          alter column organization_id set not null;
alter table public.invoice_counters  alter column organization_id set not null;
alter table public.billing           alter column organization_id set not null;

-- business_settings: one row per org (was one row per user). user_id kept as a
-- nullable "last editor" audit column but no longer the primary key.
alter table public.business_settings drop constraint business_settings_pkey;
alter table public.business_settings alter column user_id drop not null;
alter table public.business_settings add primary key (organization_id);

-- invoice_counters: sequence is now per (organization, year).
alter table public.invoice_counters drop constraint invoice_counters_pkey;
alter table public.invoice_counters alter column user_id drop not null;
alter table public.invoice_counters add primary key (organization_id, year);

-- invoices: invoice numbers are now unique per organization, not per user.
alter table public.invoices drop constraint invoices_user_id_invoice_number_key;
alter table public.invoices add constraint invoices_org_invoice_number_key unique (organization_id, invoice_number);

-- billing: one subscription per org (was per user).
alter table public.billing drop constraint billing_pkey;
alter table public.billing alter column user_id drop not null;
alter table public.billing add primary key (organization_id);

-- ---------------------------------------------------------------------------
-- 6. Replace every user_id-scoped RLS policy with an org-scoped one.
-- ---------------------------------------------------------------------------

-- quotes ---------------------------------------------------------------------
drop policy "Users can view their own quotes" on public.quotes;
drop policy "Users can insert their own quotes" on public.quotes;
drop policy "Users can update their own quotes" on public.quotes;

create policy "Members can view their org quotes"
  on public.quotes for select
  using (public.is_org_member(organization_id));

create policy "Members can insert quotes in their org"
  on public.quotes for insert
  with check (public.is_org_member(organization_id));

create policy "Members can update their org quotes"
  on public.quotes for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- quote_line_items -----------------------------------------------------------
drop policy "Users can view their own line items" on public.quote_line_items;
drop policy "Users can insert their own line items" on public.quote_line_items;
drop policy "Users can update their own line items" on public.quote_line_items;

create policy "Members can view their org line items"
  on public.quote_line_items for select
  using (public.is_org_member(organization_id));

create policy "Members can insert line items in their org"
  on public.quote_line_items for insert
  with check (public.is_org_member(organization_id));

create policy "Members can update their org line items"
  on public.quote_line_items for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- price_list_items -----------------------------------------------------------
drop policy "Users can view their own price list items" on public.price_list_items;
drop policy "Users can insert their own price list items" on public.price_list_items;
drop policy "Users can update their own price list items" on public.price_list_items;
drop policy "Users can delete their own price list items" on public.price_list_items;

create policy "Members can view their org price list items"
  on public.price_list_items for select
  using (public.is_org_member(organization_id));

create policy "Members can insert price list items in their org"
  on public.price_list_items for insert
  with check (public.is_org_member(organization_id));

create policy "Members can update their org price list items"
  on public.price_list_items for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "Members can delete their org price list items"
  on public.price_list_items for delete
  using (public.is_org_member(organization_id));

-- customers ------------------------------------------------------------------
drop policy "Users can view their own customers" on public.customers;
drop policy "Users can insert their own customers" on public.customers;
drop policy "Users can update their own customers" on public.customers;
drop policy "Users can delete their own customers" on public.customers;

create policy "Members can view their org customers"
  on public.customers for select
  using (public.is_org_member(organization_id));

create policy "Members can insert customers in their org"
  on public.customers for insert
  with check (public.is_org_member(organization_id));

create policy "Members can update their org customers"
  on public.customers for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "Members can delete their org customers"
  on public.customers for delete
  using (public.is_org_member(organization_id));

-- business_settings ----------------------------------------------------------
drop policy "Users can view their own business settings" on public.business_settings;
drop policy "Users can insert their own business settings" on public.business_settings;
drop policy "Users can update their own business settings" on public.business_settings;

create policy "Members can view their org business settings"
  on public.business_settings for select
  using (public.is_org_member(organization_id));

create policy "Members can insert their org business settings"
  on public.business_settings for insert
  with check (public.is_org_member(organization_id));

create policy "Members can update their org business settings"
  on public.business_settings for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

-- invoice_counters -----------------------------------------------------------
drop policy "Users can view their own invoice counters" on public.invoice_counters;

create policy "Members can view their org invoice counters"
  on public.invoice_counters for select
  using (public.is_org_member(organization_id));

-- invoices -------------------------------------------------------------------
drop policy "Users can view their own invoices" on public.invoices;
drop policy "Users can insert their own invoices" on public.invoices;

create policy "Members can view their org invoices"
  on public.invoices for select
  using (public.is_org_member(organization_id));

create policy "Members can insert invoices in their org"
  on public.invoices for insert
  with check (public.is_org_member(organization_id));

-- billing --------------------------------------------------------------------
-- Owner-only visibility (only owners see billing, per the role model). Still no
-- client write policy at all: writes happen exclusively via the service-role
-- client in the Stripe webhook and ensureTrialStarted, both bypassing RLS.
drop policy "Users can view their own billing row" on public.billing;

create policy "Owners can view their org billing row"
  on public.billing for select
  using (public.is_org_owner(organization_id));

-- ---------------------------------------------------------------------------
-- 7. next_invoice_number() -> per-organization sequence
-- ---------------------------------------------------------------------------

-- Numbers are now sequential per (organization, year). The org is derived from
-- the caller's own membership via auth.uid() -- never a caller-supplied
-- argument (same hardening reasoning as the per-user version in 0008). If the
-- caller belongs to no org, it raises rather than silently corrupting data.
create or replace function public.next_invoice_number()
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_year int := extract(year from now())::int;
  v_seq int;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  select om.organization_id
    into v_org_id
    from public.organization_members om
   where om.user_id = v_user_id
   limit 1;

  if v_org_id is null then
    raise exception 'no organization for user';
  end if;

  insert into public.invoice_counters (organization_id, year, last_seq)
  values (v_org_id, v_year, 1)
  on conflict (organization_id, year)
  do update set last_seq = public.invoice_counters.last_seq + 1
  returning last_seq into v_seq;

  return 'RE-' || v_year::text || '-' || lpad(v_seq::text, 4, '0');
end;
$$;
