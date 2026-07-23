-- Google Calendar sync for job scheduling (issue #166).
--
-- Decision (made autonomously, see issue #166 comments): Google Calendar only
-- for v1 -- simpler OAuth flow and larger market share among target users
-- than Outlook/Microsoft 365. Outlook two-way sync is explicitly deferred to
-- a future issue if requested.
--
-- Sync direction: one-way (app -> Google Calendar) for v1, not true two-way.
-- Pulling changes made directly in Google Calendar back into the app would
-- require either polling (rate limits, staleness, wasted API calls for the
-- vast majority of orgs that never touch the synced event in Google) or
-- standing up Google's push-notification/webhook channel machinery (its own
-- renewal/expiry lifecycle, a public HTTPS endpoint, and channel-id bookkeeping
-- per org). That's a meaningfully larger project than the "put the job on the
-- calendar tradespeople already live in" problem this issue is actually
-- solving (see the issue's "Why"). One-way sync is a complete, real
-- improvement over the status quo (an internal-only calendar) and is the
-- correct-sized v1; two-way can be a follow-up if one-way turns out to be
-- insufficient in practice.
--
-- organizations.google_calendar_refresh_token: OAuth 2.0 refresh token for the
-- org's connected Google account. Server-only -- never selected by the
-- browser client. There is intentionally no RLS SELECT policy exposing this
-- column to members (see the "no owner-write policy on organizations" note in
-- 0010_organizations.sql; writes/reads of sensitive org columns go through the
-- service-role admin client, same pattern as billing/Stripe fields).
--
-- organizations.google_calendar_id: which calendar to sync events to, e.g.
-- 'primary' (the account's default calendar) or a specific calendar id if the
-- tradesperson wants jobs kept out of their main calendar. Defaults to
-- 'primary' so a bare OAuth connect (no extra picker UI in v1) just works.
--
-- scheduled_jobs.google_calendar_event_id: the id of the corresponding Google
-- Calendar event, so updates/cancellations can PATCH/DELETE the same event
-- instead of creating duplicates. Null until the first successful sync (or
-- forever, for orgs that never connect Google Calendar).

alter table public.organizations
  add column google_calendar_refresh_token text,
  add column google_calendar_id text not null default 'primary';

alter table public.scheduled_jobs
  add column google_calendar_event_id text;

comment on column public.organizations.google_calendar_refresh_token is
  'OAuth 2.0 refresh token for the org''s connected Google Calendar account. Server-only; never expose to the browser client.';
comment on column public.organizations.google_calendar_id is
  'Which Google Calendar to sync scheduled jobs to. Defaults to the account''s primary calendar.';
comment on column public.scheduled_jobs.google_calendar_event_id is
  'Id of the corresponding synced Google Calendar event, if any (one-way app -> Google sync, issue #166).';

-- 0010_organizations.sql's "Members can view their organization" RLS policy
-- is row-level, not column-level: any member (not just the owner) of an org
-- can already SELECT the whole organizations row via the anon/authenticated
-- client, which is fine for the existing columns (booleans, IDs, a referral
-- code) but NOT fine for a bearer credential like a Google OAuth refresh
-- token -- unlike e.g. billing.stripe_customer_id (just an id, useless
-- without the Stripe secret key), this token alone is enough to read/write
-- events on the connected Google Calendar. Column-level REVOKE closes that
-- gap in addition to (not instead of) the app code only ever reading it via
-- the service-role admin client: a bare `select *` from the browser client
-- now fails outright for this one column instead of quietly returning it.
revoke select (google_calendar_refresh_token) on public.organizations from authenticated, anon;
