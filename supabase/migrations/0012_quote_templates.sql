-- Quote templates: named, reusable bundles of line items an org can insert
-- into a new quote in one click (e.g. "Badezimmer Renovierung Standard").
--
-- Distinct from price_list_templates/price_list_template_items (0011), which
-- are GLOBAL, read-only, per-unit catalog starter prices shared by everyone.
-- These tables are the opposite: org-owned, fully mutable, and hold specific
-- line items (label + quantity + unit price) forming a mini-quote starting
-- point -- so unlike 0011 they are RLS-scoped by organization_id, following
-- the is_org_member/is_org_owner pattern introduced in 0010.

create table public.quote_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.quote_templates enable row level security;

create policy "Org members can view their quote templates"
  on public.quote_templates for select
  using (public.is_org_member(organization_id));

create policy "Org members can insert quote templates"
  on public.quote_templates for insert
  with check (public.is_org_member(organization_id));

create policy "Org members can update their quote templates"
  on public.quote_templates for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "Org members can delete their quote templates"
  on public.quote_templates for delete
  using (public.is_org_member(organization_id));

-- Denormalized organization_id (rather than joining through template_id) so
-- RLS on this table can be checked directly, matching the quote_line_items
-- convention from 0010 -- every owned table carries its own organization_id.
create table public.quote_template_items (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  template_id uuid not null references public.quote_templates(id) on delete cascade,
  label text not null,
  unit text not null,
  quantity numeric not null check (quantity > 0),
  unit_price_cents integer not null check (unit_price_cents > 0),
  sort_order integer not null default 0
);

alter table public.quote_template_items enable row level security;

create policy "Org members can view their quote template items"
  on public.quote_template_items for select
  using (public.is_org_member(organization_id));

create policy "Org members can insert quote template items"
  on public.quote_template_items for insert
  with check (public.is_org_member(organization_id));

create policy "Org members can update their quote template items"
  on public.quote_template_items for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "Org members can delete their quote template items"
  on public.quote_template_items for delete
  using (public.is_org_member(organization_id));

create index quote_template_items_template_id_idx on public.quote_template_items(template_id);
create index quote_templates_organization_id_idx on public.quote_templates(organization_id);
