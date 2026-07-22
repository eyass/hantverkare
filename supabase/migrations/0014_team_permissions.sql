-- Role-based permissions within a team (issue #52), a follow-on to the
-- multi-user/team accounts work in 0010_organizations.sql.
--
-- 0010 only ever distinguished owner vs. member for ONE thing: viewing billing
-- (owner-only, hardcoded, not configurable). This migration lets an owner
-- additionally restrict members from:
--   1. deleting customers
--   2. viewing invoices (customer invoices, not the Stripe subscription row)
--   3. editing business settings
--
-- Design decisions (documented here since this is a T3 RLS change):
--
-- * Three new boolean columns on `organizations`, owner-configurable, default
--   to whatever members could ALREADY do before this migration -- so applying
--   this migration to a live database changes nothing until an owner
--   explicitly visits the team settings page and tightens a toggle. Per
--   0010's original policies: members could already delete customers, already
--   view invoices, and already edit business settings. So all three default
--   to `true` (permissive == today's behavior). There is no "off" default
--   that would silently break anyone's workflow on deploy.
--
-- * The Stripe subscription/billing row (`public.billing`) is deliberately
--   NOT made configurable here and stays hardcoded owner-only, exactly as
--   0010 left it. That table holds `stripe_customer_id` and subscription
--   status -- payment-adjacent data -- and the issue's "billing" restriction
--   is about protecting it, not about ever exposing it further. Making it
--   owner-configurable would mean an owner could affirmatively grant members
--   access to payment data, which is a strictly new capability nobody asked
--   for and is the less conservative choice. So: `billing` policy is
--   untouched by this migration. `members_can_view_billing` below governs
--   ONLY the `invoices` table (a customer's invoice/PDF documents), which is
--   the thing that was actually viewable by any member before now, and which
--   plausibly is what an owner wants to restrict for a bookkeeping employee.
--
-- * New SECURITY DEFINER helper functions follow the exact pattern of
--   `is_org_member` / `is_org_owner` in 0010: owners are always allowed
--   (an owner can never lock themselves out), members are allowed only when
--   both the membership check AND the relevant organization setting pass.
--   This fails closed: if the organization row is somehow missing, the
--   `exists` guard returns false, so a member gets denied rather than
--   admitted by default.

-- ---------------------------------------------------------------------------
-- 1. New owner-configurable settings columns on organizations
-- ---------------------------------------------------------------------------

alter table public.organizations
  add column members_can_delete_customers boolean not null default true,
  add column members_can_view_billing boolean not null default true,
  add column members_can_edit_business_settings boolean not null default true;

comment on column public.organizations.members_can_delete_customers is
  'If false, only owners may delete customers (members retain view/create/edit). Defaults true to preserve pre-#52 behavior.';
comment on column public.organizations.members_can_view_billing is
  'If false, only owners may view the organization''s invoices. Does NOT affect the separate `billing` (Stripe subscription) table, which stays hardcoded owner-only. Defaults true to preserve pre-#52 behavior.';
comment on column public.organizations.members_can_edit_business_settings is
  'If false, only owners may create/update business_settings. Defaults true to preserve pre-#52 behavior.';

-- ---------------------------------------------------------------------------
-- 2. SECURITY DEFINER helpers (same bypass-RLS-to-avoid-recursion pattern as
--    is_org_member / is_org_owner in 0010)
-- ---------------------------------------------------------------------------

create or replace function public.can_member_delete_customers(org_id uuid)
returns boolean
language sql
security definer
stable
set search_path = pg_catalog, public
as $$
  select
    public.is_org_owner(org_id)
    or (
      public.is_org_member(org_id)
      and exists (
        select 1 from public.organizations o
        where o.id = org_id and o.members_can_delete_customers
      )
    );
$$;

create or replace function public.can_member_view_invoices(org_id uuid)
returns boolean
language sql
security definer
stable
set search_path = pg_catalog, public
as $$
  select
    public.is_org_owner(org_id)
    or (
      public.is_org_member(org_id)
      and exists (
        select 1 from public.organizations o
        where o.id = org_id and o.members_can_view_billing
      )
    );
$$;

create or replace function public.can_member_edit_business_settings(org_id uuid)
returns boolean
language sql
security definer
stable
set search_path = pg_catalog, public
as $$
  select
    public.is_org_owner(org_id)
    or (
      public.is_org_member(org_id)
      and exists (
        select 1 from public.organizations o
        where o.id = org_id and o.members_can_edit_business_settings
      )
    );
$$;

-- ---------------------------------------------------------------------------
-- 3. Replace the affected RLS policies to also check the new setting.
--    Views/inserts/updates that are NOT called out by the issue (create,
--    view, edit customers; view business_settings) are left exactly as 0010
--    defined them -- only the 3 named restrictions change.
-- ---------------------------------------------------------------------------

-- customers: delete only ------------------------------------------------------
drop policy "Members can delete their org customers" on public.customers;

create policy "Members can delete their org customers"
  on public.customers for delete
  using (public.can_member_delete_customers(organization_id));

-- business_settings: insert + update (upsert uses both) ----------------------
drop policy "Members can insert their org business settings" on public.business_settings;
drop policy "Members can update their org business settings" on public.business_settings;

create policy "Members can insert their org business settings"
  on public.business_settings for insert
  with check (public.can_member_edit_business_settings(organization_id));

create policy "Members can update their org business settings"
  on public.business_settings for update
  using (public.can_member_edit_business_settings(organization_id))
  with check (public.can_member_edit_business_settings(organization_id));

-- invoices: select only --------------------------------------------------------
drop policy "Members can view their org invoices" on public.invoices;

create policy "Members can view their org invoices"
  on public.invoices for select
  using (public.can_member_view_invoices(organization_id));

-- Note: public.billing's "Owners can view their org billing row" policy from
-- 0010 is intentionally left untouched (see rationale above).
