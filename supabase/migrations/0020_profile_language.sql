-- Per-user UI language preference for the authenticated app (issue #116).
--
-- Personal viewing preference, not organization data -- two members of the
-- same org may prefer different languages -- so this lives on `profiles`,
-- not `organizations`/`business_settings`. Default 'de' preserves current
-- behavior exactly for all existing rows (no backfill needed); the existing
-- "Users can update their own profile" RLS policy from 0001_init.sql already
-- scopes writes to `auth.uid() = id`, so no new policy is needed here.
alter table public.profiles
  add column language text not null default 'de'
    check (language in ('de', 'en'));
