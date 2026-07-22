-- In-quote comment/question threads for customers (closes #155).
--
-- A simple flat thread scoped to a quote (not per line item -- v1 keeps this
-- as small as possible per the issue's own suggestion). Visible both on the
-- customer's public quote link (app/q/[token]/) and the tradesperson's quote
-- detail view (app/(app)/quotes/[id]/).
--
-- Authorship: the customer side has no auth at all (access is via the
-- unguessable share_token, same security model as signQuote/declineQuote in
-- app/q/[token]/actions.ts), so there is no customer user id to store here --
-- author_type distinguishes 'customer' vs 'member', and author_name is a
-- plain snapshot string (the member's email for 'member' rows, a fixed
-- "Kunde" label for 'customer' rows) rather than a foreign key. This avoids
-- adding any new auth surface, as instructed.
--
-- RLS mirrors quote_photos (0015_quote_photos.sql) exactly for the
-- org-member side: select/insert gated by is_org_member(organization_id).
-- There is deliberately no RLS policy allowing customer-side inserts/selects
-- -- the public quote page and its server actions use the service-role
-- admin client (lib/supabase/admin.ts), scoped by share_token, exactly like
-- signQuote/declineQuote already do. No update/delete policy: a comment
-- thread is append-only, matching quote_photos' "immutable once created"
-- precedent.

create table public.quote_comments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  author_type text not null check (author_type in ('customer', 'member')),
  author_name text not null,
  member_id uuid references auth.users(id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);

alter table public.quote_comments enable row level security;

create policy "Members can view their org quote comments"
  on public.quote_comments for select
  using (public.is_org_member(organization_id));

create policy "Members can insert quote comments in their org"
  on public.quote_comments for insert
  with check (public.is_org_member(organization_id));

create index quote_comments_quote_id_idx on public.quote_comments (quote_id, created_at);
create index quote_comments_organization_id_idx on public.quote_comments (organization_id);

comment on table public.quote_comments is
  'Flat comment/question thread scoped to a quote as a whole (not per line item, v1 scope per #155). Customer-side reads/writes go through the service-role admin client (share_token-scoped, see app/q/[token]/actions.ts) and are NOT covered by the RLS policies here, which only grant org-member access.';
comment on column public.quote_comments.author_type is
  '''customer'' for a comment left via the public share-token link, ''member'' for one left by a tradesperson/org member from the quote detail view.';
comment on column public.quote_comments.author_name is
  'Display name snapshot: the org member''s email for author_type = member, or a fixed customer-facing label for author_type = customer. Not a foreign key -- the customer side has no user account to reference.';
comment on column public.quote_comments.member_id is
  'Set only for author_type = member (the authenticated org member who wrote it). Null for customer comments. on delete set null so a departed member''s history is preserved.';
