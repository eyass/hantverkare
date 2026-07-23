-- Customer self-service portal (closes #154).
--
-- Decision (see issue #154 comments): a magic-link auth surface scoped per
-- customer record, entirely separate from the org/team login
-- (0003_auth.sql / Supabase Auth). Customers are NOT auth.users rows in this
-- app's model (see public.customers, 0005_customers.sql) -- they are plain
-- contact records owned by an organization -- so this cannot reuse Supabase
-- Auth. Instead this is a small, standalone token table modeled on the
-- existing unguessable-token-column pattern already used elsewhere on quotes
-- (see 0006_esignature.sql and 0030_photo_gallery_sharing.sql), but scoped to a whole
-- customer record rather than a single quote, and -- because this grants
-- standing access to a customer's full quote/invoice/job/warranty history
-- rather than one already-shareable document -- the token itself is hashed at
-- rest (sha256), not stored raw, unlike the lighter-weight per-quote tokens.
--
-- Flow:
--   1. Customer requests access at /portal/request with their email.
--   2. Server Action looks up public.customers by email (across all orgs --
--      an email isn't unique per se, so every match gets a link), generates a
--      random raw token, stores only sha256(raw token) here with a 24h
--      expiry, and emails the raw token as part of a /portal/[token] URL.
--   3. app/portal/[token]/page.tsx (public, no Supabase Auth session) hashes
--      the incoming token and looks up this table via the service-role admin
--      client (lib/supabase/admin.ts) -- same access-control model as
--      app/q/[token]/page.tsx: the token IS the access control, there is no
--      RLS-driven authorization here at all.
--   4. On a valid, unexpired token, the page sets a short-lived signed
--      browser cookie (see lib/portal/session.ts) scoped to that customer_id,
--      so subsequent /portal/* navigation within the window doesn't require
--      re-requesting a link. The token row itself is single-use in the sense
--      that consumed_at is stamped on first successful validation; the
--      cookie -- not the token -- carries the session forward from there.
--
-- No RLS select/insert policies for regular users: every access to this
-- table happens through the service-role admin client (the Server Action
-- that creates a row, and the portal page that reads one), mirroring
-- organization_invites (0010_organizations.sql) which has no client-writable
-- policy either. RLS is still enabled per this repo's blanket convention
-- (every table gets RLS enabled, see CLAUDE.md) even though no policy grants
-- access -- that means the default-deny applies to any anon/authenticated
-- Supabase client, which is exactly what we want here.
create table public.customer_portal_tokens (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now()
);

alter table public.customer_portal_tokens enable row level security;

-- Lookup index for the portal page (by token_hash, already unique -> indexed)
-- and for the request flow's "does this customer already have a live token"
-- check / cleanup.
create index customer_portal_tokens_customer_id_idx on public.customer_portal_tokens (customer_id);
create index customer_portal_tokens_expires_at_idx on public.customer_portal_tokens (expires_at);
