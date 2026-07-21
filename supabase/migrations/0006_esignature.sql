-- Customer-facing quote review + click-to-sign consent (closes #7).
--
-- Public access is via an unguessable share_token, looked up through a
-- server-only service-role client (see lib/supabase/admin.ts) -- RLS on
-- quotes/quote_line_items stays owner-scoped exactly as in 0003_auth.sql.
-- The token itself is the access control for the public /q/[token] route,
-- not a new RLS policy.

alter table public.quotes
  add column share_token uuid not null default gen_random_uuid() unique,
  add column signed_at timestamptz,
  add column signer_name text,
  add column signer_ip text;

-- Status gains a third value: 'signed'. Only a 'final' quote may transition to
-- 'signed' (enforced at the application layer in app/q/[token]/actions.ts via
-- an .eq("status", "final") guard on the update -- never 'draft' -> 'signed').
alter table public.quotes
  drop constraint quotes_status_check;

alter table public.quotes
  add constraint quotes_status_check
  check (status in ('draft', 'final', 'signed'));
