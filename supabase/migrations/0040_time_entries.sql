-- Internal time tracking / timesheet entries (closes #195).
--
-- Lets an org member log hours worked against a scheduled_jobs row -- either
-- via a manual form or via the existing voice-transcription pipeline (see
-- app/(app)/jobs/[id]/TimeEntryForm.tsx). This is v1 scope: log hours -> see
-- per-job totals -> optionally pull the total into an invoice as a labor
-- line item. Payroll export and time-approval workflows are explicitly out
-- of scope for v1 (see the design spec at
-- docs/superpowers/specs/2026-07-23-time-tracking-design.md) -- any org
-- member can log their own hours, no manager-approval step, mirroring how
-- this repo hasn't built approval workflows for photos/comments either.
--
-- job_id references scheduled_jobs(id) -- NOT quotes(id). Note that the
-- app/(app)/jobs/[id]/ route param is actually a *quote* id (see that page's
-- existing doc comment), so callers resolve the scheduled_jobs row for a
-- quote (`.eq("quote_id", quoteId)`) to get the job_id used here, the same
-- way app/(app)/quotes/[id]/scheduling-actions.ts already does.
--
-- source distinguishes manual keyboard entry from voice-captured entries
-- (transcribed via Whisper, then a lightweight AI call extracts
-- {hours, note} -- see lib/timeTracking/extractTimeEntry.ts). Both paths
-- still require the user to confirm the fields before saving, so `source`
-- is purely informational/for future analytics, not a trust signal.
create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  job_id uuid not null references public.scheduled_jobs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  worked_on date not null,
  hours numeric(5,2) not null check (hours > 0 and hours <= 24),
  note text,
  source text not null default 'manual' check (source in ('manual', 'voice')),
  created_at timestamptz not null default now()
);

alter table public.time_entries enable row level security;

-- Lookups by job (job detail page's running total + invoice-time unbilled
-- sum) and by organization (any future org-wide reporting) both get their
-- own index, mirroring scheduled_jobs' organization_id index.
create index time_entries_job_id_idx on public.time_entries (job_id);
create index time_entries_organization_id_idx on public.time_entries (organization_id);

-- ---------------------------------------------------------------------------
-- RLS -- select/insert are standard org-scoped via is_org_member, matching
-- scheduled_jobs (0022_job_scheduling.sql) and quote_comments
-- (0029_quote_comments.sql). update/delete are narrower: only the entry's
-- own author (user_id = auth.uid()) or the org owner (is_org_owner) may
-- modify/remove a row -- this is the "member-authored row" pattern this
-- repo doesn't have an exact precedent for yet (quote_comments is
-- append-only with no update/delete policy at all), but is_org_owner
-- already exists from 0010_organizations.sql and is the natural "owner can
-- always fix/clean up" escape hatch used elsewhere (e.g. organization_invites).
-- ---------------------------------------------------------------------------

create policy "Members can view their org time entries"
  on public.time_entries for select
  using (public.is_org_member(organization_id));

create policy "Members can insert time entries in their org"
  on public.time_entries for insert
  with check (public.is_org_member(organization_id));

create policy "Authors and owners can update their org time entries"
  on public.time_entries for update
  using (
    public.is_org_member(organization_id)
    and (user_id = auth.uid() or public.is_org_owner(organization_id))
  )
  with check (
    public.is_org_member(organization_id)
    and (user_id = auth.uid() or public.is_org_owner(organization_id))
  );

create policy "Authors and owners can delete their org time entries"
  on public.time_entries for delete
  using (
    public.is_org_member(organization_id)
    and (user_id = auth.uid() or public.is_org_owner(organization_id))
  );

comment on table public.time_entries is
  'Timesheet rows logged against a scheduled_jobs row (#195). v1 scope: log hours -> per-job totals -> optional opt-in labor line item on invoice creation. No payroll export/approval workflow yet.';
comment on column public.time_entries.source is
  '''manual'' for direct form entry, ''voice'' for entries prefilled via Whisper transcription + AI field extraction and then confirmed by the user in the form. Informational only -- both paths require user confirmation before saving.';
