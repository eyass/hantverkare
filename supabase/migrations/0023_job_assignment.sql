-- Job-to-helper assignment (issue #128), a follow-on to the multi-user/team
-- accounts work in 0010_organizations.sql and role permissions in
-- 0014_team_permissions.sql.
--
-- Scope, per the issue: a lightweight "assign to" tag on a quote/job pointing
-- to an existing org member, plus a read-only view the assignee can already
-- reach. No new auth surface is introduced.
--
-- Design decisions (documented here since this touches supabase/migrations/,
-- which CLAUDE.md flags as T3 regardless of the issue's T2-medium label):
--
-- * `assigned_to` is a plain nullable FK to auth.users, NOT to
--   organization_members (organization_members has a composite PK, no single-
--   column id to reference). Nullable so "unassigned" is the natural default
--   for every existing row -- this migration changes nothing observable until
--   someone explicitly assigns a quote.
--
-- * `on delete set null`: if an assigned user is later removed from
--   auth.users entirely (rare -- org member removal in 0010 only deletes the
--   organization_members row, not the auth.users row), the quote falls back
--   to unassigned rather than the row being destroyed or the FK blocking the
--   user deletion.
--
-- * No new RLS policy. Quotes are already viewable and editable by ANY member
--   of the owning organization (0010's "Members can view/update their org
--   quotes" policies, using is_org_member(organization_id)) -- assignment is
--   a filter/label on top of that existing access, not a narrower grant. In
--   particular this deliberately does NOT restrict a non-assigned member from
--   viewing or editing the quote: the issue asks for an assignment tag and a
--   read-only link for the assignee, not a permission boundary that locks out
--   other teammates. The "read-only shared view" mentioned in the issue is
--   implemented as an app-level page that only *renders* fewer controls; it
--   still relies on the same org-membership RLS for its actual data access,
--   consistent with "no new auth surface."
--
-- * assigned_to is intentionally NOT constrained to be a current member of
--   the quote's organization_id at the database level (Postgres FKs can't
--   express "is a member of the same org as this row" without a trigger).
--   That invariant is enforced in the Server Action (assignQuote) instead,
--   which looks up the target user's membership in organization_members
--   before writing -- the same pattern removeMember already uses to keep
--   writes server-side and validated. A stale assigned_to left behind after a
--   member is removed from the org (organization_members row deleted, quote
--   row untouched) is harmless: the quote is still fully visible/editable by
--   every remaining member via the unchanged org-scoped RLS, it just displays
--   as "assigned to a former member" until reassigned.

alter table public.quotes
  add column assigned_to uuid references auth.users(id) on delete set null;

comment on column public.quotes.assigned_to is
  'Optional org member (auth.users id) this job/quote is assigned to (issue #128). Purely a label for the "assign to" UI + "my jobs" filter -- does NOT narrow who can view/edit the quote, which remains governed by the existing org-membership RLS from 0010_organizations.sql.';

-- Supports "my assigned jobs" listings (WHERE organization_id = ? AND
-- assigned_to = ?) without a sequential scan as quotes grow.
create index quotes_organization_assigned_to_idx
  on public.quotes (organization_id, assigned_to);
