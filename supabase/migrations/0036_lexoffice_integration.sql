-- Direct accounting-software sync with lexoffice (issue #165).
--
-- Decision (see issue #165 comments): lexoffice is the v1 provider -- a clean
-- public REST API (api.lexoffice.io), common in this market segment. DATEV is
-- handled separately by #123's GoBD/DATEV *export* work; this migration and
-- its integration code do not touch that. sevDesk/other providers are
-- explicitly deferred, matching the issue decision.
--
-- lexoffice's auth model is simpler than most: no OAuth app registration is
-- needed for this kind of integration, just a per-organization "public API
-- key" (a Bearer token) that the tradesperson generates themselves inside the
-- lexoffice app and pastes into our settings UI. That's why this is a single
-- plain column rather than an oauth-tokens table like a provider that needed
-- an authorization-code flow would require.
--
-- Columns:
--   organizations.lexoffice_api_key -- the pasted API key. Nullable; null
--     means "not connected". Stored as plain text server-side-only, never
--     selected by a client-exposed query path (see lib/integrations/lexoffice
--     and the settings Server Action, both of which only ever use the
--     service-role admin client to read/write this column). No RLS SELECT
--     policy is added for this column's table beyond what already exists on
--     organizations, and this repo has no existing "encrypt a secret at rest"
--     pattern to follow (STRIPE_SECRET_KEY, for comparison, lives in an env
--     var, not a DB row -- there was no precedent to reuse here). Plaintext
--     storage, gated entirely on service-role-only access, is called out as a
--     v1 improvement opportunity in the PR body: a follow-up should look at
--     pgsodium/Vault-based column encryption before this handles real
--     customer API keys at scale.
--   organizations.lexoffice_sync_enabled -- opt-in (default false, mirroring
--     review_request_enabled from 0031): invoices are only ever pushed to
--     lexoffice for organizations that have explicitly turned this on AND
--     have a saved API key. Off by default so nothing is sent to a
--     third-party API without explicit action.
--   invoices.lexoffice_voucher_id -- the lexoffice-side voucher/invoice id
--     once successfully synced, null otherwise. Used both to show sync status
--     in the UI and to avoid re-pushing an invoice that already synced.
--
-- No new RLS policies: these are plain columns on tables that already have
-- owner/member-scoped policies (organizations from 0010, invoices from
-- 0008/0010). All writes to lexoffice_api_key/lexoffice_sync_enabled happen
-- through an owner-gated Server Action using the service-role admin client
-- (mirroring updateTeamPermissions in app/(app)/settings/team/actions.ts);
-- lexoffice_voucher_id is only ever written by the server-side sync helper
-- (lib/integrations/lexoffice/sync.ts), never by client input.

alter table public.organizations
  add column lexoffice_api_key text,
  add column lexoffice_sync_enabled boolean not null default false;

comment on column public.organizations.lexoffice_api_key is
  'Per-organization lexoffice public API key (Bearer token), pasted by the owner from the lexoffice app. Null = not connected. Plain text server-side-only: never read via a client-exposed query, only via the service-role admin client from Server Actions / the sync helper. Flagged as a v1 gap -- encrypt-at-rest is a follow-up, this repo has no existing secret-column-encryption pattern to build on yet.';
comment on column public.organizations.lexoffice_sync_enabled is
  'Opt-in (default false): invoices are only pushed to lexoffice for organizations where this is true AND lexoffice_api_key is set. Mirrors review_request_enabled (0031) in defaulting to the safe/off state.';

alter table public.invoices
  add column lexoffice_voucher_id text;

comment on column public.invoices.lexoffice_voucher_id is
  'lexoffice-side voucher/invoice id once this invoice has been successfully synced, or null if never synced (sync disabled, not yet attempted, or every attempt failed so far). A sync failure never blocks or rolls back the invoice''s own creation -- see lib/integrations/lexoffice/sync.ts.';
