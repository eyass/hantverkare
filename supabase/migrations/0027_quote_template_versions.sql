-- Version/audit trail for quote templates (closes #152).
--
-- Quote templates (0012_quote_templates.sql) can currently be edited in
-- place with no history: an accidental bad edit silently overwrites a
-- template other quotes may have been built from, with no way to see what
-- changed or revert. This migration adds an append-only snapshot table,
-- mirroring the immutable-snapshot pattern already used for warranty
-- records (0021_warranty_records.sql) and invoices (0008_invoices.sql):
-- rows here are never updated or recomputed later, so each one stays a
-- true record of what the template looked like at that point in time.
--
-- A row is inserted on every edit, capturing the template's state as it
-- existed immediately BEFORE the edit is applied (i.e. version 1 is the
-- template's original as-created state, captured at the moment of its
-- first edit). Restoring an old version goes through the same "update"
-- action, so it also snapshots the about-to-be-overwritten state first --
-- nothing is ever lost, restoring is just another edit.
--
-- name_snapshot + items_snapshot together capture the full editable state
-- of a template (public.quote_templates.name and the denormalized
-- public.quote_template_items rows) as plain data, independent of the
-- live tables, so a version stays readable/restorable even if the
-- template itself is later changed further or its items table shape
-- evolves in incompatible ways.
create table public.quote_template_versions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  template_id uuid not null references public.quote_templates(id) on delete cascade,
  version_number integer not null,
  name_snapshot text not null,
  items_snapshot jsonb not null,
  edited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (template_id, version_number)
);

alter table public.quote_template_versions enable row level security;

create policy "Org members can view their quote template versions"
  on public.quote_template_versions for select
  using (public.is_org_member(organization_id));

-- Insert-only, mirroring public.warranty_records: a version is an immutable
-- snapshot taken at edit time, so no update/delete policy is provided --
-- there is intentionally no app-level path to edit or remove one once
-- created.
create policy "Org members can insert quote template versions"
  on public.quote_template_versions for insert
  with check (public.is_org_member(organization_id));

create index quote_template_versions_template_id_idx on public.quote_template_versions (template_id);
