# Manual steps pending (for the human)

Running list of things only you can do, accumulated while working through the backlog
autonomously. Nothing here blocks progress — each item is noted and work continues.

## Migrations to apply in the Supabase SQL editor

Run these **in order** (0004 → 0005 → 0006 → 0007 → 0008 → 0009 → 0010) — later
ones reference earlier tables/columns.

### `0004_business_settings.sql`
```sql
create table public.business_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  company_name text,
  address text,
  vat_id text,
  tax_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.business_settings enable row level security;

create policy "Users can view their own business settings"
  on public.business_settings for select
  using (auth.uid() = user_id);

create policy "Users can insert their own business settings"
  on public.business_settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own business settings"
  on public.business_settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

### `0005_customers.sql`
```sql
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  email text,
  phone text,
  address text,
  created_at timestamptz not null default now()
);

alter table public.customers enable row level security;

create policy "Users can view their own customers"
  on public.customers for select
  using (auth.uid() = user_id);

create policy "Users can insert their own customers"
  on public.customers for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own customers"
  on public.customers for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own customers"
  on public.customers for delete
  using (auth.uid() = user_id);
```

### `0006_esignature.sql`
```sql
alter table public.quotes
  add column share_token uuid not null default gen_random_uuid() unique,
  add column signed_at timestamptz,
  add column signer_name text,
  add column signer_ip text;

alter table public.quotes
  drop constraint quotes_status_check;

alter table public.quotes
  add constraint quotes_status_check
  check (status in ('draft', 'final', 'signed'));
```
(Verified: the original constraint in `0002_quotes.sql` was an inline column check with
no explicit name, so Postgres auto-named it `quotes_status_check` — this drop/recreate
is safe as written.)

### `0007_quote_customer_link.sql`
```sql
alter table public.quotes
  add column customer_id uuid references public.customers(id) on delete set null;
```

### `0008_invoices.sql`
```sql
create table public.invoice_counters (
  user_id uuid not null references auth.users(id) on delete cascade,
  year integer not null,
  last_seq integer not null default 0,
  primary key (user_id, year)
);

alter table public.invoice_counters enable row level security;

create policy "Users can view their own invoice counters"
  on public.invoice_counters for select
  using (auth.uid() = user_id);

create or replace function public.next_invoice_number()
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_user_id uuid := auth.uid();
  v_year int := extract(year from now())::int;
  v_seq int;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  insert into public.invoice_counters (user_id, year, last_seq)
  values (v_user_id, v_year, 1)
  on conflict (user_id, year)
  do update set last_seq = public.invoice_counters.last_seq + 1
  returning last_seq into v_seq;

  return 'RE-' || v_year::text || '-' || lpad(v_seq::text, 4, '0');
end;
$$;

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  quote_id uuid not null references public.quotes(id) on delete cascade,
  invoice_number text not null,
  issued_at timestamptz not null default now(),
  subtotal_cents integer not null,
  vat_cents integer not null,
  total_cents integer not null,
  unique (user_id, invoice_number),
  unique (quote_id)
);

alter table public.invoices enable row level security;

create policy "Users can view their own invoices"
  on public.invoices for select
  using (auth.uid() = user_id);

create policy "Users can insert their own invoices"
  on public.invoices for insert
  with check (auth.uid() = user_id);
```

### `0009_billing.sql`
```sql
create table public.billing (
  user_id uuid primary key references auth.users(id) on delete cascade,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text,
  trial_ends_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.billing enable row level security;

create policy "Users can view their own billing row"
  on public.billing for select
  using (auth.uid() = user_id);
```
(Deliberately a separate table from `business_settings`, not new columns on it:
`business_settings`'s existing update policy lets a user write any column on their
own row from the client, which would let anyone PATCH their own
`subscription_status` to `active` and bypass billing entirely. `billing` has no
insert/update/delete policy for the `authenticated` role — only the webhook route,
using the service-role client, can write to it.)

### `0010_organizations.sql` (T3-high — multi-user / team accounts, issue #15)

**The single largest, highest-risk migration in the project.** It moves the
row-ownership model of every owned table from `user_id`-scoped to
`organization_id`-scoped RLS, and includes a **backfill of existing production
data** (every existing user gets a new 1-person org and becomes its owner; every
existing owned row is stamped with that org). Run it exactly once, in the
Supabase SQL editor, as a single statement batch (it runs in one implicit
transaction). It is written to be safe against a database that already has real
0001–0009 data. No agent has run this against any real database.

After applying, deploy the matching app code (this same PR) — the app writes
`organization_id` and reads via the new org-scoped RLS, so schema and code must
land together.

```sql
-- Multi-user / team accounts (issue #15). Moves the row-ownership model of every
-- owned table from user_id-scoped to organization_id-scoped RLS.

-- 1. New tables --------------------------------------------------------------
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);
alter table public.organizations enable row level security;

create table public.organization_members (
  organization_id uuid not null references public.organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'member')),
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);
alter table public.organization_members enable row level security;

create table public.organization_invites (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  token uuid not null default gen_random_uuid() unique,
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  accepted_at timestamptz
);
alter table public.organization_invites enable row level security;

-- 2. Membership helpers (SECURITY DEFINER -> bypass RLS to avoid recursion) --
create or replace function public.is_org_member(org_id uuid)
returns boolean language sql security definer stable
set search_path = pg_catalog, public as $$
  select exists (
    select 1 from public.organization_members om
    where om.organization_id = org_id and om.user_id = auth.uid()
  );
$$;

create or replace function public.is_org_owner(org_id uuid)
returns boolean language sql security definer stable
set search_path = pg_catalog, public as $$
  select exists (
    select 1 from public.organization_members om
    where om.organization_id = org_id and om.user_id = auth.uid() and om.role = 'owner'
  );
$$;

create policy "Members can view their organization"
  on public.organizations for select using (public.is_org_member(id));
create policy "Members can view memberships in their organizations"
  on public.organization_members for select using (public.is_org_member(organization_id));
create policy "Owners can view their organization invites"
  on public.organization_invites for select using (public.is_org_owner(organization_id));

-- 3. Add organization_id to every owned table --------------------------------
alter table public.quotes            add column organization_id uuid references public.organizations(id) on delete cascade;
alter table public.quote_line_items  add column organization_id uuid references public.organizations(id) on delete cascade;
alter table public.customers         add column organization_id uuid references public.organizations(id) on delete cascade;
alter table public.price_list_items  add column organization_id uuid references public.organizations(id) on delete cascade;
alter table public.business_settings add column organization_id uuid references public.organizations(id) on delete cascade;
alter table public.invoices          add column organization_id uuid references public.organizations(id) on delete cascade;
alter table public.invoice_counters  add column organization_id uuid references public.organizations(id) on delete cascade;
alter table public.billing           add column organization_id uuid references public.organizations(id) on delete cascade;

-- 4. BACKFILL: one org per existing user, that user as owner, all rows stamped -
create temporary table _user_org_map (
  user_id uuid primary key,
  organization_id uuid not null default gen_random_uuid()
) on commit drop;

insert into _user_org_map (user_id)
select distinct user_id from (
  select user_id from public.quotes
  union select user_id from public.quote_line_items
  union select user_id from public.customers
  union select user_id from public.price_list_items
  union select user_id from public.business_settings
  union select user_id from public.invoices
  union select user_id from public.invoice_counters
  union select user_id from public.billing
) all_users
where user_id is not null;

insert into public.organizations (id, name)
select m.organization_id,
       coalesce(nullif(trim(bs.company_name), ''), 'Mein Unternehmen')
from _user_org_map m
left join public.business_settings bs on bs.user_id = m.user_id;

insert into public.organization_members (organization_id, user_id, role)
select m.organization_id, m.user_id, 'owner' from _user_org_map m;

update public.quotes            t set organization_id = m.organization_id from _user_org_map m where m.user_id = t.user_id;
update public.quote_line_items  t set organization_id = m.organization_id from _user_org_map m where m.user_id = t.user_id;
update public.customers         t set organization_id = m.organization_id from _user_org_map m where m.user_id = t.user_id;
update public.price_list_items  t set organization_id = m.organization_id from _user_org_map m where m.user_id = t.user_id;
update public.business_settings t set organization_id = m.organization_id from _user_org_map m where m.user_id = t.user_id;
update public.invoices          t set organization_id = m.organization_id from _user_org_map m where m.user_id = t.user_id;
update public.invoice_counters  t set organization_id = m.organization_id from _user_org_map m where m.user_id = t.user_id;
update public.billing           t set organization_id = m.organization_id from _user_org_map m where m.user_id = t.user_id;

-- 5. NOT NULL + repoint per-user keys at organization_id ---------------------
alter table public.quotes            alter column organization_id set not null;
alter table public.quote_line_items  alter column organization_id set not null;
alter table public.customers         alter column organization_id set not null;
alter table public.price_list_items  alter column organization_id set not null;
alter table public.business_settings alter column organization_id set not null;
alter table public.invoices          alter column organization_id set not null;
alter table public.invoice_counters  alter column organization_id set not null;
alter table public.billing           alter column organization_id set not null;

alter table public.business_settings drop constraint business_settings_pkey;
alter table public.business_settings alter column user_id drop not null;
alter table public.business_settings add primary key (organization_id);

alter table public.invoice_counters drop constraint invoice_counters_pkey;
alter table public.invoice_counters alter column user_id drop not null;
alter table public.invoice_counters add primary key (organization_id, year);

alter table public.invoices drop constraint invoices_user_id_invoice_number_key;
alter table public.invoices add constraint invoices_org_invoice_number_key unique (organization_id, invoice_number);

alter table public.billing drop constraint billing_pkey;
alter table public.billing alter column user_id drop not null;
alter table public.billing add primary key (organization_id);

-- 6. Replace every user_id-scoped RLS policy with an org-scoped one ----------
drop policy "Users can view their own quotes" on public.quotes;
drop policy "Users can insert their own quotes" on public.quotes;
drop policy "Users can update their own quotes" on public.quotes;
create policy "Members can view their org quotes" on public.quotes for select using (public.is_org_member(organization_id));
create policy "Members can insert quotes in their org" on public.quotes for insert with check (public.is_org_member(organization_id));
create policy "Members can update their org quotes" on public.quotes for update using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

drop policy "Users can view their own line items" on public.quote_line_items;
drop policy "Users can insert their own line items" on public.quote_line_items;
drop policy "Users can update their own line items" on public.quote_line_items;
create policy "Members can view their org line items" on public.quote_line_items for select using (public.is_org_member(organization_id));
create policy "Members can insert line items in their org" on public.quote_line_items for insert with check (public.is_org_member(organization_id));
create policy "Members can update their org line items" on public.quote_line_items for update using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

drop policy "Users can view their own price list items" on public.price_list_items;
drop policy "Users can insert their own price list items" on public.price_list_items;
drop policy "Users can update their own price list items" on public.price_list_items;
drop policy "Users can delete their own price list items" on public.price_list_items;
create policy "Members can view their org price list items" on public.price_list_items for select using (public.is_org_member(organization_id));
create policy "Members can insert price list items in their org" on public.price_list_items for insert with check (public.is_org_member(organization_id));
create policy "Members can update their org price list items" on public.price_list_items for update using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "Members can delete their org price list items" on public.price_list_items for delete using (public.is_org_member(organization_id));

drop policy "Users can view their own customers" on public.customers;
drop policy "Users can insert their own customers" on public.customers;
drop policy "Users can update their own customers" on public.customers;
drop policy "Users can delete their own customers" on public.customers;
create policy "Members can view their org customers" on public.customers for select using (public.is_org_member(organization_id));
create policy "Members can insert customers in their org" on public.customers for insert with check (public.is_org_member(organization_id));
create policy "Members can update their org customers" on public.customers for update using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));
create policy "Members can delete their org customers" on public.customers for delete using (public.is_org_member(organization_id));

drop policy "Users can view their own business settings" on public.business_settings;
drop policy "Users can insert their own business settings" on public.business_settings;
drop policy "Users can update their own business settings" on public.business_settings;
create policy "Members can view their org business settings" on public.business_settings for select using (public.is_org_member(organization_id));
create policy "Members can insert their org business settings" on public.business_settings for insert with check (public.is_org_member(organization_id));
create policy "Members can update their org business settings" on public.business_settings for update using (public.is_org_member(organization_id)) with check (public.is_org_member(organization_id));

drop policy "Users can view their own invoice counters" on public.invoice_counters;
create policy "Members can view their org invoice counters" on public.invoice_counters for select using (public.is_org_member(organization_id));

drop policy "Users can view their own invoices" on public.invoices;
drop policy "Users can insert their own invoices" on public.invoices;
create policy "Members can view their org invoices" on public.invoices for select using (public.is_org_member(organization_id));
create policy "Members can insert invoices in their org" on public.invoices for insert with check (public.is_org_member(organization_id));

drop policy "Users can view their own billing row" on public.billing;
create policy "Owners can view their org billing row" on public.billing for select using (public.is_org_owner(organization_id));

-- 7. next_invoice_number() -> per-organization sequence ---------------------
create or replace function public.next_invoice_number()
returns text language plpgsql security definer
set search_path = pg_catalog, public as $$
declare
  v_user_id uuid := auth.uid();
  v_org_id uuid;
  v_year int := extract(year from now())::int;
  v_seq int;
begin
  if v_user_id is null then raise exception 'not authenticated'; end if;
  select om.organization_id into v_org_id
    from public.organization_members om where om.user_id = v_user_id
    order by om.created_at asc limit 1;
  if v_org_id is null then raise exception 'no organization for user'; end if;
  insert into public.invoice_counters (organization_id, year, last_seq)
  values (v_org_id, v_year, 1)
  on conflict (organization_id, year)
  do update set last_seq = public.invoice_counters.last_seq + 1
  returning last_seq into v_seq;
  return 'RE-' || v_year::text || '-' || lpad(v_seq::text, 4, '0');
end;
$$;
```

**Billing note:** billing is now per-organization. Any Stripe subscriptions
created *before* this migration carry `metadata.user_id` (not
`organization_id`); the webhook resolves those to an org via the user's
membership, so existing subscriptions keep working. New Checkout sessions carry
`metadata.organization_id`.

## Stripe SaaS billing (T3 / financial) — human setup required

The app now gates access behind a subscription (14-day free trial, then
29 €/month), matching Bliqat's model. **No agent has created a real Stripe
account, a live Price object, or executed a real charge** — all code paths use
Stripe test mode only. To make billing actually work end-to-end, you (a human)
need to:

- [ ] Create a Stripe account at [stripe.com](https://stripe.com) if you don't have
  one yet (or use an existing one).
- [ ] Stay in **test mode** (toggle in the Stripe Dashboard) for all of dev/staging.
- [ ] Create a recurring Price: Products → Add product → recurring, €29.00/month.
  Copy its Price ID (starts with `price_`).
- [ ] Developers → API keys (test mode) → copy the **Secret key** (starts with
  `sk_test_` — never use a `sk_live_` key in this app's env vars).
- [ ] Developers → Webhooks → Add endpoint → URL `https://<your-domain>/api/stripe/webhook`
  (or use the Stripe CLI's `stripe listen --forward-to localhost:3000/api/stripe/webhook`
  for local dev) → select events `checkout.session.completed`,
  `customer.subscription.updated`, `customer.subscription.deleted` → copy the
  **Signing secret** (starts with `whsec_`).
- [ ] Add these to `.env.local` and to Vercel (Preview + Production env vars):
  - [ ] `STRIPE_SECRET_KEY` (test mode secret key)
  - [ ] `STRIPE_WEBHOOK_SECRET` (webhook signing secret)
  - [ ] `STRIPE_PRICE_ID` (the €29/month Price ID)
- [ ] Once ready to accept real payments, switch to live-mode keys/Price/webhook
  yourself -- this is an explicit, deliberate step no agent will take.

## Secrets to add (Vercel env vars + `.env.local`)

- [ ] **`RESEND_API_KEY`** — from [resend.com](https://resend.com) (free tier is fine to
  start). Used by the new "email notification when a quote is signed" feature
  (`lib/notifications/sendSignedEmail.ts`). Until this is set, signing still works
  perfectly (the email send is a best-effort side effect that never blocks the
  customer-facing flow) — you just won't get notified by email yet. Also worth
  swapping the hardcoded `onboarding@resend.dev` sender in that file for a verified
  custom domain sender once you have one set up in Resend.

## Visual/manual QA spot-check needed

Supabase's default mailer hit its project-wide rate limit (2 emails/hour) during
earlier testing, so live browser QA (sign in via magic link → click through the UI)
couldn't be done for every feature built afterward. Each was still verified via code
review (spec-compliance + adversarial quality review) and `npm run build`/`npm test`,
but you should eyeball these once you're back:

- [ ] `/quotes` — list page, status filter tabs, empty state, header nav links
- [ ] `/settings` — business settings form saves/loads correctly
- [ ] `/customers` — add/edit/delete a customer, inline save-on-blur works
- [ ] `/customers/[id]` — shows that customer's quote history
- [ ] `/quotes/new` — customer picker dropdown works, quote generation still works
  end-to-end with a customer selected and with none selected
- [ ] `/quotes/[id]` (a finalized quote) — shows the public share link
- [ ] `/q/[token]` (the public link from a finalized quote) — loads without auth, shows
  line items + totals, sign form works, transitions to "signiert" and shows the
  confirmation on reload
- [ ] Sharing a **draft** quote's link (if you can get one before finalizing) should
  show only "noch nicht bereit zur Ansicht", no pricing detail
- [ ] After signing a quote (once `RESEND_API_KEY` is set): confirm you receive the
  "quote signed" email
- [ ] On a signed quote: click "Rechnung erstellen", confirm an invoice number appears
  (format `RE-2026-0001`) and re-clicking doesn't create a duplicate
- [ ] `/quotes/[id]/pdf` — download link produces a readable PDF with your business
  settings (once filled in) in the letterhead
- [ ] `/reports` — stat tiles show sensible numbers, "–" shown correctly with zero
  quotes/signed quotes

## Design-system restyle (Phase A + B, merged) — visual QA needed

The whole app was restyled to match `docs/DESIGN-SYSTEM.md` (dark sidebar shell,
card-based layouts, pill status badges, voice-capture "orb"). All logic was verified
unchanged via code review and `npm test`/`npm run build`, but no live browser pass was
possible (same email rate-limit blocker as above). Please eyeball:

- [ ] Desktop sidebar + mobile bottom tabs (`components/AppShell.tsx`) — nav highlighting,
  sign-out, on a real small screen (not just resized browser)
- [ ] `/quotes` — new stat tiles (Alle/Entwürfe/Final+Signiert) show correct counts
  regardless of which status-filter tab is active (fixed a bug where tiles previously
  reflected the *filtered* count instead of the full set)
- [ ] `/quotes/new` — voice orb pulsing-ring animation while recording, on both
  desktop and mobile, with an actual microphone
- [ ] `/quotes/[id]` — two-column layout on desktop, single column on mobile; sticky
  summary card behavior when scrolling a long line-item list
- [ ] `/q/[token]` — dark customer-facing page background, white card contrast, on a
  phone screen (this is the page real customers see)
- [ ] `/settings`, `/customers`, `/customers/[id]`, `/price-list` — card styling,
  delete-button visibility/contrast
