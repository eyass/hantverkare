-- Referral program (issue #79). Give a trial month, get a trial month: an
-- existing organization shares its referral link; when a brand-new org signs
-- up using that code and its subscription genuinely activates for the first
-- time (Stripe webhook, not at signup), both orgs get a 30-day bonus tacked
-- onto trial_ends_at.
--
-- T3: this touches billing-adjacent state (trial_ends_at), even though the
-- reward itself is granted app-side (via the service-role client from the
-- webhook), not via any live Stripe call. See app/api/stripe/webhook/route.ts
-- and lib/referrals/ for the grant logic and its idempotency guard.

-- ---------------------------------------------------------------------------
-- 1. organizations.referral_code -- unique, stable per org
-- ---------------------------------------------------------------------------

alter table public.organizations add column referral_code text;

-- Backfill existing orgs with a random 8-char code. Collisions are
-- astronomically unlikely (8 hex-ish chars from md5), but if two rows ever
-- did collide the unique constraint below would fail this migration loudly
-- rather than silently allow a duplicate -- acceptable for a one-time backfill
-- reviewed by a human before being applied (see docs/MANUAL-STEPS-PENDING.md
-- convention established in 0010).
update public.organizations
set referral_code = upper(substr(md5(id::text || clock_timestamp()::text), 1, 8))
where referral_code is null;

alter table public.organizations alter column referral_code set not null;
alter table public.organizations add constraint organizations_referral_code_key unique (referral_code);

-- ---------------------------------------------------------------------------
-- 2. referrals -- who referred whom, and whether the reward has been granted
-- ---------------------------------------------------------------------------

create table public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_organization_id uuid not null references public.organizations(id) on delete cascade,
  referred_organization_id uuid not null references public.organizations(id) on delete cascade,
  code_used text not null,
  created_at timestamptz not null default now(),
  reward_granted_at timestamptz,
  -- Defense in depth: an org can never be recorded as having referred itself.
  -- The application never constructs a row like this either (a referral is
  -- only ever recorded at the moment a BRAND NEW org is created in
  -- ensureOrganization(), so referred_organization_id did not exist yet when
  -- code_used was captured), but this makes the invariant impossible to
  -- violate even if application logic changes later.
  constraint referrals_no_self_referral check (referrer_organization_id <> referred_organization_id),
  -- An org can be "the referred org" at most once -- it only ever gets
  -- created (and can only ever be brand-new) a single time in its life.
  -- This also caps the reward at one grant per referred org by construction.
  constraint referrals_referred_org_unique unique (referred_organization_id)
);

alter table public.referrals enable row level security;

-- No client-writable policy at all: rows are only ever written by the
-- service-role admin client (recorded in ensureOrganization() at signup,
-- reward_granted_at stamped in the Stripe webhook), exactly like billing and
-- organization_members. Members may only SELECT referrals where their own org
-- is the referrer -- i.e. "referrals I made" -- not ones where they were
-- referred (that's private to the referrer's view, mirroring how billing is
-- visible only to the owning side).
create policy "Members can view referrals they made"
  on public.referrals for select
  using (public.is_org_member(referrer_organization_id));
