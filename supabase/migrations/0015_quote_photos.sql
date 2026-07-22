-- Job-site photo attachments on quotes (issue #72). A tradesperson attaches
-- photos (before/after, site conditions) to a quote as a whole or to an
-- individual line item, following the org-scoped RLS pattern established in
-- 0010_organizations.sql.
--
-- This migration adds the `quote_photos` join table. It does NOT create the
-- storage bucket itself: `storage.buckets` inserts and the associated
-- `storage.objects` RLS policies work fine as plain SQL against a live
-- Supabase project (the storage schema is just more Postgres tables), but
-- doing so as an automated migration run against a database this agent has
-- no direct access to risks silently no-op'ing or conflicting with a bucket
-- that may already exist from a manual dashboard action. To stay consistent
-- with this project's existing convention (see 0010's own header: "NOT run
-- against any real database by any agent -- added to
-- docs/MANUAL-STEPS-PENDING.md for the human to apply"), the bucket creation
-- and its storage.objects policies are written below as a documented SQL
-- block for the human to run once in the Supabase SQL editor, tracked as a
-- manual-step-labeled GitHub issue (see PR description). The `quote_photos`
-- table below is fully self-contained and safe to run automatically.

-- ---------------------------------------------------------------------------
-- 1. quote_photos table
-- ---------------------------------------------------------------------------

create table public.quote_photos (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  quote_line_item_id uuid references public.quote_line_items(id) on delete cascade,
  storage_path text not null,
  caption text,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id) on delete set null
);

alter table public.quote_photos enable row level security;

-- Storage paths are always written by the app as
-- `{organization_id}/{quote_id}/{filename}` (see PhotosSection.tsx), so the
-- storage.objects RLS policies (manual step, see PR description) can check
-- the same organization_id prefix independently of this table. This column
-- itself has no uniqueness constraint on storage_path: deleting a
-- quote_photos row does not delete the underlying object (the app issues a
-- separate storage.remove() call), so a stray duplicate row is harmless.

create index quote_photos_quote_id_idx on public.quote_photos(quote_id);
create index quote_photos_organization_id_idx on public.quote_photos(organization_id);
create index quote_photos_line_item_id_idx on public.quote_photos(quote_line_item_id) where quote_line_item_id is not null;

-- ---------------------------------------------------------------------------
-- 2. RLS -- standard org-scoped select/insert/delete via is_org_member.
--    No update policy: photos are immutable once uploaded (caption edits are
--    out of scope for this feature; delete + re-upload is the escape hatch).
-- ---------------------------------------------------------------------------

create policy "Members can view their org quote photos"
  on public.quote_photos for select
  using (public.is_org_member(organization_id));

create policy "Members can insert quote photos in their org"
  on public.quote_photos for insert
  with check (public.is_org_member(organization_id));

create policy "Members can delete their org quote photos"
  on public.quote_photos for delete
  using (public.is_org_member(organization_id));

-- ---------------------------------------------------------------------------
-- MANUAL STEP (not run by this migration -- see docs/MANUAL-STEPS-PENDING.md
-- and the manual-step-labeled GitHub issue linked from the PR): create the
-- `quote-photos` storage bucket and its object policies by running the
-- following once in the Supabase SQL editor (or equivalent dashboard action):
--
-- insert into storage.buckets (id, name, public)
-- values ('quote-photos', 'quote-photos', false)
-- on conflict (id) do nothing;
--
-- -- Storage object paths are `{organization_id}/{quote_id}/{filename}`, so
-- -- the org id is `(storage.foldername(name))[1]` -- the first path segment.
--
-- create policy "Members can view their org quote photos"
--   on storage.objects for select
--   using (
--     bucket_id = 'quote-photos'
--     and public.is_org_member((storage.foldername(name))[1]::uuid)
--   );
--
-- create policy "Members can upload quote photos in their org"
--   on storage.objects for insert
--   with check (
--     bucket_id = 'quote-photos'
--     and public.is_org_member((storage.foldername(name))[1]::uuid)
--   );
--
-- create policy "Members can delete their org quote photos"
--   on storage.objects for delete
--   using (
--     bucket_id = 'quote-photos'
--     and public.is_org_member((storage.foldername(name))[1]::uuid)
--   );
