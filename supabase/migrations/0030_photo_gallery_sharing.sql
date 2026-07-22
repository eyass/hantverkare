-- Shareable before/after job photo gallery (issue #156).
--
-- Job-site photos are already captured on a quote (quote_photos, see
-- 0015_quote_photos.sql). This migration adds an explicit, per-quote opt-in
-- toggle plus an unguessable public token so a tradesperson can choose to
-- publish a public before/after gallery page for a job, in the same spirit
-- as the existing public quote link (`quotes.share_token`, see
-- 0006_esignature.sql / app/q/[token]).
--
-- Privacy is the whole point here: photos must NEVER be publicly reachable
-- without an explicit action by the quote owner. That's why both a boolean
-- gate (gallery_enabled, default false) AND a separate unguessable token
-- (gallery_token) are required together -- flipping the toggle back off
-- immediately closes the public page even though the token keeps existing,
-- and the token is distinct from share_token so publishing a gallery can
-- never be inferred from (or confused with) the customer quote-signing link.

alter table public.quotes
  add column gallery_enabled boolean not null default false,
  add column gallery_token uuid not null default gen_random_uuid() unique;

-- No new RLS policies needed: gallery_enabled/gallery_token are plain columns
-- on public.quotes, already covered by that table's existing owner/org-scoped
-- policies for reads and writes from the authenticated app. The public
-- gallery page itself is served via the admin (service-role) client, exactly
-- like app/q/[token]/page.tsx does for quotes.share_token -- the token is the
-- only access control for that unauthenticated path, and the query there
-- additionally always filters on `gallery_enabled = true` so toggling sharing
-- off takes effect immediately without needing to rotate the token.
