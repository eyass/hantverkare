# Multi-user / Team Accounts — Design

**Goal:** Support more than one user per business (owner + employees creating
quotes under the same company). Decided autonomously per the standing
full-autonomy override — this is the last backlog item, done last on purpose
since it changes the ownership model every other feature assumes.

## Model

Introduce `organizations` (one per business) and `organization_members`
(many-to-many, with a `role`: `owner` | `member`). Every existing owned table
(`quotes`, `customers`, `price_list_items`, `invoices`, `invoice_counters`,
`business_settings`, `billing`) gets an `organization_id` column replacing
`user_id` as the RLS scoping key. `user_id` columns are kept where they record
*who did something* (e.g. `quotes.created_by_user_id`) but access control moves
to org membership.

- **Backward-compat migration:** every existing user gets a new 1-person
  `organizations` row (name = their business_settings.company_name or "Mein
  Unternehmen") and becomes its `owner` in `organization_members`. Every existing
  row in every owned table gets `organization_id` set to that user's new org.
  This is done in the same migration, in a single transaction, so existing
  users see zero disruption.
- **RLS policies:** replace every `auth.uid() = user_id` check with `exists
  (select 1 from organization_members om where om.organization_id =
  <table>.organization_id and om.user_id = auth.uid())`. This is a single
  reusable pattern applied per table.
- **Roles:** only `owner` can invite/remove members and see billing; `member`
  can do everything else (create/edit quotes, customers, price list). No
  finer-grained permissions for v1 (YAGNI).
- **Billing stays per-organization**, not per-user — `billing.organization_id`
  replaces `billing.user_id`. One subscription covers the whole team.
- **Invites:** simplest workable mechanism — an `organization_invites` table
  (`org_id`, `email`, `token`, `invited_by`, `created_at`, `accepted_at`). Owner
  enters an email on a new `/settings/team` page, we send an invite email
  (reusing the existing Resend integration) with a link containing the token.
  Following the link while logged out sends them through the existing magic-link
  login for that email, then on `/invite/[token]` they're added to
  `organization_members` and redirected into the app. No signup flow beyond
  what auth already does.
- **Which org is "current":** since v1 has no multi-org-per-user case (a user
  who's a member of two orgs isn't a requirement here — YAGNI), a user's
  organization is resolved via a single `organization_members` lookup by
  `user_id`, no org-switcher UI needed.

## Files

- `supabase/migrations/0010_organizations.sql` — new tables + backfill + RLS
  rewrite for all 7 existing owned tables (this is the single largest, most
  careful migration in the project so far; every existing RLS policy from
  0001-0009 gets dropped and recreated)
- `lib/organizations/getCurrentOrg.ts` — resolves `{ organizationId, role }`
  for the signed-in user (single query, used everywhere instead of
  `user.id`)
- `app/(app)/settings/team/page.tsx` + `TeamSettingsForm.tsx` — list members,
  invite form (owner-only)
- `app/(app)/settings/team/actions.ts` — `inviteMember`, `removeMember`
  Server Actions (owner-only, enforced server-side by checking role, not just
  hiding the UI)
- `app/invite/[token]/page.tsx` — accept-invite landing page
- `lib/notifications/sendInviteEmail.ts` — reuses the existing Resend pattern
  from `sendSignedEmail.ts`
- Every existing query across `app/(app)/**/actions.ts` and page files that
  currently filters by `user_id` gets updated to filter by `organization_id`
  from `getCurrentOrg()` instead.

## What we do NOT build now

- Per-permission granularity beyond owner/member
- A user belonging to multiple organizations / an org switcher
- Removing/transferring ownership (an owner leaving is out of scope — YAGNI
  until it's a real request)
