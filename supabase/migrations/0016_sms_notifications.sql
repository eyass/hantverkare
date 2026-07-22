-- SMS notifications (issue #75), alongside the existing Resend email
-- notifications (sendSignedEmail.ts / sendExpiryReminderEmail.ts).
--
-- This adds exactly ONE new column: an owner-configurable, opt-in toggle on
-- `organizations`. SMS costs real money per message (unlike email), so unlike
-- 0014's permission booleans (which defaulted to preserve existing behavior),
-- this one defaults to `false` -- no organization sends SMS, and incurs no
-- Twilio cost, until an owner explicitly opts in via the team settings page.
--
-- No new RLS policy is needed: this column is read through the exact same
-- "Members can view their organization" select policy that already covers
-- every other `organizations` column (see 0010_organizations.sql), and it is
-- only ever written via the service-role admin client from the existing
-- owner-gated `updateTeamPermissions` Server Action path (see
-- app/(app)/settings/team/actions.ts), the same way 0014's three booleans are
-- written. There is no new write surface to protect.

alter table public.organizations
  add column sms_notifications_enabled boolean not null default false;

comment on column public.organizations.sms_notifications_enabled is
  'Opt-in (default false): if true, the org additionally sends SMS via Twilio for quote-signed and expiry-reminder notifications, alongside the existing Resend emails. Defaults false since SMS incurs per-message cost and must never be sent without explicit owner consent.';
