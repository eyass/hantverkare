-- Auto-generated invoicing from signed quotes (closes #8).
--
-- Invoices are frozen snapshots of a signed quote's amounts at issue time -- they never
-- recompute from live quote data later, matching real-world invoicing semantics.
-- Invoice numbers are sequential per-user, per-year ("RE-{year}-{seq}"), generated
-- race-safely by the next_invoice_number() function below (see the design spec at
-- docs/superpowers/specs/2026-07-22-invoicing-design.md for the full reasoning).

-- Per-user, per-year sequence counter backing next_invoice_number(). Not directly
-- writable by clients -- only the security definer function below mutates it, so RLS
-- here only needs an owner-scoped select policy (useful for debugging/inspection),
-- no insert/update/delete policy.
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

-- Atomically bumps and returns the next sequence number for a user/year, formatted as
-- the full invoice number. Race-safe: the insert ... on conflict do update ... returning
-- is a single atomic statement, so concurrent callers for the same (user_id, year)
-- serialize on the row and each gets a distinct, strictly increasing sequence -- there
-- is no read-then-write window visible to callers where two could observe the same
-- last_seq. security definer lets a user invoke this to bump their own counter row
-- without a client-side write policy on invoice_counters; it only ever touches the row
-- matching its own p_user_id argument (always the caller's own auth.uid(), passed by the
-- Server Action), so it cannot be used to tamper with another user's sequence.
create or replace function public.next_invoice_number(p_user_id uuid)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_year int := extract(year from now())::int;
  v_seq int;
begin
  insert into public.invoice_counters (user_id, year, last_seq)
  values (p_user_id, v_year, 1)
  on conflict (user_id, year)
  do update set last_seq = public.invoice_counters.last_seq + 1
  returning last_seq into v_seq;

  return 'RE-' || v_year::text || '-' || lpad(v_seq::text, 4, '0');
end;
$$;

-- One invoice per quote (unique (quote_id)), frozen amounts copied from the quote at
-- issue time (never recomputed later). unique (user_id, invoice_number) is a backstop
-- alongside the race-safe counter above.
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

-- Owner-scoped select/insert only. No update/delete policies: invoices are immutable
-- once issued (mistakes are corrected with a real-world credit/correcting invoice, not
-- an edit -- out of scope for this feature).
create policy "Users can view their own invoices"
  on public.invoices for select
  using (auth.uid() = user_id);

create policy "Users can insert their own invoices"
  on public.invoices for insert
  with check (auth.uid() = user_id);
