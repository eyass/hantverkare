# Quote Customer Link — Design Spec

## Context

Closes [issue #13](https://github.com/eyass/hantverkare/issues/13): customers exist
(`app/customers`, issue #12) but quotes have no relationship to them — every quote just
has a free-text `customer_description`. This adds a nullable `customer_id` FK on `quotes`,
an optional customer picker on `/quotes/new`, and a customer detail/history page. Decisions
below made autonomously per the project's standing full-autonomy override
(`.harness/LOOP.md`).

## Decisions made autonomously

- **Column: `quotes.customer_id uuid references public.customers(id) on delete set
  null`** — nullable. Existing quotes and quotes created without picking a customer stay
  valid; this is additive, not a breaking change. `on delete set null` (not `cascade`):
  deleting a customer should not destroy quote history/revenue records.
- **Migration file: `supabase/migrations/0007_quote_customer_link.sql`** (this exact
  number; 0008 reserved for other parallel work per task instructions).
- **Picker on `/quotes/new`**: a plain `<select name="customerId">` populated from the
  signed-in user's `customers` (RLS-scoped `select id, name`, fetched server-side in
  `app/quotes/new/page.tsx` and passed as a prop to the existing client form), with a
  "— kein Kunde ausgewählt —" default option (value `""`). `generateQuoteDraft` reads
  `customerId` from `FormData`; empty string is treated as `null` (no customer), and a
  non-empty value is set on the `quotes` insert. No new validation needed — an invalid/
  foreign id would simply fail to satisfy the FK and RLS-select on `customers`, but since
  the value only ever comes from the picker itself, no attacker-supplied value is
  meaningfully worse than an invalid FK error already handled by the existing insert
  error path.
- **History page: `app/customers/[id]/page.tsx`** (new page, not appended to the existing
  list) — a customer detail page is the cleaner fit for "history" than expanding the
  inline-editable list-table. Server component: fetch the customer by id (`.eq("id",
  id).single()`), returning Next's `notFound()` if missing (covers both "doesn't exist"
  and "not owned" — RLS makes a not-owned row invisible, so the query behaves
  identically to "doesn't exist"). Then fetch `quotes` where `customer_id = id`, same
  columns/ordering/row-rendering as `app/quotes/page.tsx` (`id, customer_description,
  status, total_cents, created_at`, ordered by `created_at desc`) for visual consistency.
- **Customer list wiring**: add a small "Verlauf" link per row in
  `app/customers/CustomerEditor.tsx`'s table (new column, or appended into the existing
  actions cell next to "Löschen"), linking to `/customers/[id]`. Kept as a static
  `<Link>`, not part of the inline-edit state, so it doesn't interact with blur-save/
  revert logic at all.
- **RLS**: no new policies needed. The existing owner-scoped policies on `quotes`
  (`auth.uid() = user_id`) already cover the new nullable column, and `customers`'
  existing select policy already scopes the detail-page fetch.
- **Risk tier: T3** (migration under `supabase/migrations/`, per
  `.harness/RISK-TIERS.md`). Per the standing override this doesn't block auto-merge, but
  is noted in the PR body; the migration needs a human to apply it to the live Supabase
  database.

## Out of scope

- Editing/reassigning `customer_id` on an existing quote (issue #13 only asks for
  creation-time linking + history view).
- Search/filter/pagination on the history table (small per-customer volumes expected).
- Any change to `app/quotes/[id]/*`, `app/q/[token]/*`, `lib/supabase/admin.ts`,
  `app/price-list/*`, `app/settings/*`, `app/layout.tsx` (explicitly reserved for
  parallel work).

## Architecture

- `supabase/migrations/0007_quote_customer_link.sql` — nullable FK column, no RLS changes.
- `app/quotes/new/page.tsx` — additionally fetches `customers` (`id, name`), passes as a
  prop to the client form.
- `app/quotes/new/NewQuoteForm` (the existing default-export client component, currently
  inline in `page.tsx`) — gains a `customers` prop and a `<select name="customerId">`.
- `app/quotes/new/actions.ts` — `generateQuoteDraft` reads `customerId` from `FormData`,
  normalizes `""` to `null`, includes it in the `quotes` insert payload.
- `app/customers/[id]/page.tsx` — new server component: fetch customer (404 if absent),
  fetch their quotes, render name + history table mirroring `app/quotes/page.tsx`'s
  markup/helpers (`formatEuros`, `formatDate`, `STATUS_LABELS`).
- `app/customers/CustomerEditor.tsx` — add a "Verlauf" link per row.

## Data flow

1. User visits `/quotes/new`; server component fetches their `customers` alongside
   rendering the (unchanged) form shell, passing the list down.
2. User optionally picks a customer from the `<select>`, describes the job, submits.
3. `generateQuoteDraft` reads `customerId` (or `""`/absent → `null`), generates line
   items as before, and inserts the quote with `customer_id` set.
4. From `/customers`, the user clicks "Verlauf" next to a customer to reach
   `/customers/[id]`, which lists that customer's quotes (RLS + `eq("customer_id", id)`),
   each linking to `/quotes/[id]`.

## Error handling

- `/customers/[id]`: customer fetch error or no row → `notFound()` (Next.js 404), no
  distinction surfaced between "wrong id" and "someone else's customer" (RLS makes them
  indistinguishable and that's intentional — no ownership-oracle leak).
- Quotes-history query failure: log server-side, render empty history section rather
  than crashing (same tolerant-empty-state pattern as `app/quotes/page.tsx` and
  `app/customers/page.tsx`).
- `generateQuoteDraft`: no new error paths — an invalid `customerId` simply fails the
  existing insert-error branch, already handled.

## Testing

- No new pure logic complex enough to warrant unit tests (a FormData read + a select
  query), matching existing precedent (no dedicated test files for quotes/customers
  CRUD either).
- Manual QA: create a quote with a customer selected, verify `customer_id` set; create a
  quote with "kein Kunde ausgewählt", verify `customer_id` is `null`; visit a customer's
  `/customers/[id]`, verify their quotes appear and link correctly; visit a nonexistent/
  other-user's customer id, verify 404.
