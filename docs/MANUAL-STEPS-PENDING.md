# Manual steps pending (for the human)

Running list of things only you can do, accumulated while working through the backlog
autonomously. Nothing here blocks progress — each item is noted and work continues.

<!-- Entries appended below as they come up. -->

## Migrations to apply in the Supabase SQL editor

Run these in order (each is idempotent-safe to run once; running out of order will fail
on FK/constraint dependencies).

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

## Visual/manual QA spot-check needed

Supabase's default mailer hit its project-wide rate limit (2 emails/hour) during
earlier testing, so live browser QA (sign in via magic link → click through the UI)
couldn't be done for every feature built afterward. Each was still verified via code
review (spec-compliance + adversarial quality review) and `npm run build`/`npm test`,
but you should eyeball these once you're back:

- [ ] `/quotes` — list page, status filter tabs, empty state, header nav links
  ("Angebote" / "Preisliste" / "Kunden" / "Einstellungen")
- [ ] `/settings` — business settings form saves/loads correctly
- [ ] `/customers` — add/edit/delete a customer, inline save-on-blur works
- [ ] `/quotes/[id]` (a finalized quote) — shows the public share link
- [ ] `/q/[token]` (the public link from a finalized quote) — loads without auth, shows
  line items + totals, sign form works, transitions to "signiert" and shows the
  confirmation on reload
- [ ] Sharing a **draft** quote's link (if you can get one before finalizing) should
  show only "noch nicht bereit zur Ansicht", no pricing detail

