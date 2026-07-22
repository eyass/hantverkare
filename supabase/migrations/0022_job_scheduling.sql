-- Job scheduling / calendar tied to signed quotes (issue #124).
--
-- Once a quote is signed, the tradesperson needs to put the actual job on a
-- calendar: pick a date/time slot, optionally an end time and notes. This is
-- explicitly scoped as lightweight (a date + time slot), not a dispatch
-- board -- no recurring jobs, no multi-technician assignment, no drag/drop.
--
-- One signed quote maps to at most one scheduled job: the `unique` constraint
-- on quote_id enforces that at the DB level. Cancelling a scheduled job is a
-- row delete (see scheduling-actions.ts), not a soft-cancel flag, matching
-- this repo's existing convention of deleting rather than soft-deleting for
-- ephemeral state (cf. quote_photos deletes).
--
-- The "quote must be signed before it can be scheduled" rule is enforced in
-- the Server Action (app/(app)/quotes/[id]/scheduling-actions.ts), NOT as a
-- DB constraint/trigger -- this repo's established convention is app-level
-- checks over DB triggers for business-rule enforcement (see 0002_quotes.sql's
-- "Known gap" comment: RLS/DB does not enforce quote immutability rules,
-- Server Actions do). A DB trigger cross-referencing quotes.status here would
-- be one more moving part to keep in sync and this project has consistently
-- chosen not to pay that cost.
--
-- reminder_sent_at follows the same guard-column pattern as
-- quotes.expiry_reminder_sent_at (0013_quote_expiry.sql): the day-before
-- reminder cron (app/api/cron/job-reminders/route.ts) only picks up rows
-- where this is still null, and stamps it after a successful send so the
-- reminder is never sent twice.

create table public.scheduled_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quote_id uuid not null unique references public.quotes(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  scheduled_start timestamptz not null,
  scheduled_end timestamptz,
  notes text,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.scheduled_jobs enable row level security;

-- quote_id already has a unique index from the `unique` constraint above, so
-- lookups by quote_id (e.g. "does this quote already have a scheduled job?")
-- are covered. organization_id and scheduled_start get their own indexes for
-- the org-scoped calendar/upcoming-jobs queries (/schedule page, the quotes
-- list's "Anstehende Termine" widget, and the reminder cron's date-window
-- scan).
create index scheduled_jobs_organization_id_idx on public.scheduled_jobs(organization_id);
create index scheduled_jobs_scheduled_start_idx on public.scheduled_jobs(scheduled_start);

-- ---------------------------------------------------------------------------
-- RLS -- standard org-scoped select/insert/update/delete via is_org_member,
-- following the pattern established in 0010_organizations.sql and used by
-- quote_photos (0015_quote_photos.sql). is_org_member already exists (created
-- in 0010) -- no new helper function needed.
-- ---------------------------------------------------------------------------

create policy "Members can view their org scheduled jobs"
  on public.scheduled_jobs for select
  using (public.is_org_member(organization_id));

create policy "Members can insert scheduled jobs in their org"
  on public.scheduled_jobs for insert
  with check (public.is_org_member(organization_id));

create policy "Members can update their org scheduled jobs"
  on public.scheduled_jobs for update
  using (public.is_org_member(organization_id))
  with check (public.is_org_member(organization_id));

create policy "Members can delete their org scheduled jobs"
  on public.scheduled_jobs for delete
  using (public.is_org_member(organization_id));
