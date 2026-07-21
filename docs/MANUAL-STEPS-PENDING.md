# Manual steps pending (for the human)

Running list of things only you can do, accumulated while working through the backlog
autonomously. Nothing here blocks progress — each item is noted and work continues.

## Migrations to apply in the Supabase SQL editor

Run these **in order** (0004 → 0005 → 0006 → 0007 → 0008) — later ones reference
earlier tables/columns.

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
