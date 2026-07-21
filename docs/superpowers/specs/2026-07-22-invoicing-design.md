# Auto-Generated Invoicing from Signed Quotes — Design Spec

## Context

Closes issue #8: once a quote is `signed`, the tradesperson needs to generate invoice
documentation from it — matching Bliqat's own "signed quote becomes invoice-ready" flow.
German invoices carry legal minimum-content requirements (Rechnungspflichtangaben):
sequential invoice number, issuer name/address, issuer tax number or VAT ID, customer
name (if known), date, description of service, net amount, VAT rate/amount, gross total.
Decisions below made autonomously per the project's standing full-autonomy override
(`.harness/LOOP.md`).

## Decisions made autonomously

- **New table `invoices`, frozen snapshot semantics.** `id uuid pk`, `user_id uuid not
  null references auth.users(id) on delete cascade`, `quote_id uuid not null references
  public.quotes(id) on delete cascade`, `invoice_number text not null`, `issued_at
  timestamptz not null default now()`, `subtotal_cents`/`vat_cents`/`total_cents integer
  not null` copied from the quote at issue time. Invoices never recompute from live quote
  data later — this matches real invoicing semantics (an invoice is a record of what was
  charged, not a live view). `unique (user_id, invoice_number)` and `unique (quote_id)`
  (one invoice per quote — no double-invoicing).

- **Sequential invoice numbering: `RE-{year}-{sequence}`** (e.g. `RE-2026-0001`),
  `{sequence}` a per-user, per-year counter starting at 1, zero-padded to 4 digits.
  Chosen approach: **a Postgres function `next_invoice_number(p_user_id uuid) returns
  text`, called via `.rpc(...)`, marked `security definer`** doing the count-and-format
  atomically inside the database.

  **Race-safety reasoning:** the tricky part is two concurrent "Rechnung erstellen"
  clicks (e.g. double-click, or two tabs) for two *different* quotes by the *same* user
  in the *same* year, both trying to become `RE-2026-0001`. A naive
  `select count(*) ... then insert` from the JS client is NOT race-safe — two concurrent
  transactions can both read the same count before either inserts, producing a duplicate
  number that then only fails at the `unique (user_id, invoice_number)` constraint (which
  is a good safety net but leaves the loser needing an app-level retry with no good UX).

  Instead, `next_invoice_number` uses a **per-user-per-year counter table**
  (`invoice_counters`: `user_id uuid`, `year int`, `last_seq int`, pk `(user_id, year)`),
  bumped with a single atomic statement inside the function body (which itself runs as
  one implicit transaction when called via `.rpc()`):

  ```sql
  create or replace function next_invoice_number(p_user_id uuid)
  returns text
  language plpgsql
  security definer
  set search_path = public
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
  ```

  This is race-safe because `insert ... on conflict do update` is a single atomic
  statement in Postgres: concurrent callers targeting the same `(user_id, year)` row
  serialize on that row's lock — the second transaction's `on conflict do update` blocks
  until the first commits, then reads the already-incremented `last_seq` and increments
  again from there. There is no separate read-then-write step visible to the caller (no
  window where two callers can both read the same `last_seq` before either writes) — the
  increment is expressed as one atomic `insert/on conflict/update/returning`. This is the
  standard Postgres-safe counter pattern and avoids needing an explicit `select ... for
  update` + separate `update` (which would also work but takes two statements inside the
  function; the `on conflict do update ... returning` form is one statement and simpler
  to reason about while still fully atomic).

  `security definer` lets a user without direct write access to `invoice_counters`
  (RLS restricts it to owner-select only — no client insert/update policy, since the
  counter is an internal implementation detail the app should never touch directly)
  still invoke the function to bump their own counter; the function only ever touches
  the row matching its `p_user_id` argument, and the Server Action always passes the
  authenticated caller's own `auth.uid()`, so this cannot be used to tamper with another
  user's sequence.

  The `createInvoice` Server Action calls `.rpc("next_invoice_number", { p_user_id:
  user.id })` to get the number, then inserts the `invoices` row with that number. The
  `unique (user_id, invoice_number)` constraint on `invoices` remains a hard backstop in
  case anything unexpected happens between the RPC call and the insert, but is not
  expected to trigger in the normal case since the counter step itself is already
  race-safe. The constraint that actually matters for this feature's real double-click
  scenario (the same quote, clicked twice rapidly) is `unique (quote_id)` — see below.

- **Migration file: `supabase/migrations/0008_invoices.sql`** — 0007 reserved for other
  parallel work per the task brief.

- **One invoice per quote**, enforced by `unique (quote_id)` on `invoices`. The "Rechnung
  erstellen" button/action only appears/works when `quotes.status = 'signed'` AND no
  invoice exists yet for that quote (checked both in the UI, by passing down the
  existing invoice if any, and in the Server Action, by pre-checking and relying on the
  unique constraint as a backstop for a genuine double-click race — if the insert fails
  on that constraint, the action re-fetches and returns the already-created invoice
  instead of erroring, so a double-click resolves to the same single invoice rather than
  a confusing failure).

- **No separate `/invoices` list page** in this version (YAGNI, matches the issue's
  explicit scope) — invoice display is inline on `/quotes/[id]` only.

- **RLS**: owner-scoped select/insert only, no update/delete — invoices are immutable
  once issued (matches real accounting practice; a correcting/credit invoice is the
  real-world fix for mistakes, out of scope here).

## Known limitation

On a genuine double-click race for the same quote, the losing request has already
called `next_invoice_number` (burning a sequence number) before its `invoices` insert
fails on `unique (quote_id)` and falls back to returning the winner's row. This leaves a
permanent gap in the sequence (e.g. `RE-2026-0004` issued, `0003` never appears). This
does not violate correctness (no duplicate numbers, no double invoicing — both remain
DB-enforced), but German invoicing conventions generally prefer gapless sequences.
Accepted as a minor, low-probability tradeoff for keeping the numbering function simple
and side-effect-free otherwise; revisit if gapless numbering becomes a hard requirement
(e.g. by moving the existence check inside the same transaction/function as the
number generation).

## Out of scope

- PDF export / print view / business-letterhead rendering of the invoice.
- `/invoices` list page.
- Correcting/credit invoices, editing or voiding an issued invoice.
- Emailing the invoice to the customer.

## Architecture

- `supabase/migrations/0008_invoices.sql` — `invoices` table, `invoice_counters` table,
  `next_invoice_number` function, RLS policies.
- `app/quotes/[id]/actions.ts` — append `createInvoice(quoteId)` Server Action.
- `app/quotes/[id]/InvoiceSection.tsx` — new client component: shows "Rechnung
  erstellen" button (only rendered by the parent when eligible), or the existing
  invoice's number/date/amounts read-only.
- `app/quotes/[id]/page.tsx` — fetch the quote's existing invoice (if any), pass `status`
  and `invoice` down to `QuoteEditor`.
- `app/quotes/[id]/QuoteEditor.tsx` — render `<InvoiceSection>` when `status ===
  "signed"`.

## Data flow

1. Quote reaches `status = 'signed'` via the existing e-signature flow (unchanged).
2. `/quotes/[id]` loads the quote plus any existing `invoices` row for it (RLS-scoped
   `select` on `invoices` where `quote_id = id`).
3. `QuoteEditor` renders `<InvoiceSection>` when signed. If no invoice exists, shows the
   "Rechnung erstellen" button.
4. Clicking it calls `createInvoice(quoteId)`, which: re-checks the quote is `signed`
   and owned by the caller, re-checks no invoice already exists for it, calls
   `next_invoice_number` via RPC, inserts the frozen `invoices` row copying
   `subtotal_cents`/`vat_cents`/`total_cents` from the quote, and returns the new
   invoice row (or the existing one, if it lost a double-click race).
5. `InvoiceSection` swaps to showing the invoice's number, issue date, and amounts.

## Risk

T3 per `.harness/RISK-TIERS.md` (new table + RLS + a `security definer` function). Per
the standing auto-merge override, no human plan approval is required, but the migration
must be applied to the live Supabase database by a human — reported back to the
controller, not applied or added to `docs/MANUAL-STEPS-PENDING.md` by this agent.
