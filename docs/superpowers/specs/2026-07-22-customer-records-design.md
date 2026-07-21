# Customer Records — Design Spec

## Context

Closes [issue #12](https://github.com/eyass/hantverkare/issues/12): there's currently no
way to store a customer's contact details separately from a one-off quote — every quote
just has a free-text `customer_description`. This adds a dedicated `customers` table and
a `/customers` CRUD page. Decisions below made autonomously per the project's standing
full-autonomy override (`.harness/LOOP.md`).

This is explicitly the *foundation* for issue #13 ("quote history per customer"), which
will later add a `customer_id` column to `quotes`. This task does not build that — no FK,
no picker on `/quotes/new`. Schema is kept simple/reasonable so that future FK is a
straightforward additive migration.

## Decisions made autonomously

- **Table: `customers`** — `id uuid pk default gen_random_uuid()`, `user_id uuid not null
  references auth.users(id) on delete cascade`, `name text not null`, `email text`
  (nullable), `phone text` (nullable), `address text` (nullable), `created_at timestamptz
  not null default now()`. Matches the shape of `price_list_items` (owner-scoped table
  introduced in `0003_auth.sql`), the closest existing analog for a "manage my own list of
  records" table.
- **Migration file: `supabase/migrations/0005_customers.sql`** (0004/0006 reserved for
  parallel work per task instructions).
- **RLS**: standard owner-scoped select/insert/update/delete policies (`auth.uid() =
  user_id`), matching `0003_auth.sql`'s policy style and comment tone exactly (one policy
  per operation, named "Users can view/insert/update/delete their own customers").
- **No unique constraint on email/name** — a tradesperson may have two customers who
  share a name (e.g. father/son) or no email at all. YAGNI for a first version.
- **Route: `/customers`** — server component fetches RLS-scoped rows ordered by `name`,
  renders a client `CustomerEditor` that mirrors `PriceListEditor`'s exact interaction
  pattern: inline-editable table with save-on-blur, `lastSavedItems` revert-on-failure,
  a discriminated-union `createCustomer` result, delete button per row, "add new" form
  below the table.
- **Validation**: only `name` is validated as non-empty (mirrors `price_list_items`'
  label/unit check). Email/phone/address get no format validation in v1 — YAGNI, matches
  task instructions.
- **No nav link added** — `app/layout.tsx` is explicitly out of scope for this task per
  instructions (avoids merge conflicts with parallel work); nav wiring is handled
  centrally afterward.
- **No wiring to quotes** — no `customer_id` on `quotes`, no picker on `/quotes/new`.
  Explicitly deferred to issue #13.
- **Risk tier: T3** (new table + migration under `supabase/migrations/`, per
  `.harness/RISK-TIERS.md`'s routing rule "Any file under `supabase/migrations/` changed
  → T3"). Per the standing PR-gate override, this does not block auto-merge, but is
  still noted in the PR description and the migration itself needs a human to apply it
  to the live Supabase database (cannot be run by the agent).

## Out of scope

- `customer_id` on `quotes` / customer picker on `/quotes/new` (issue #13)
- Search/filter/pagination (no account will have enough customers yet to need it)
- Email/phone format validation
- Nav link in `app/layout.tsx` (handled centrally)

## Architecture

- `supabase/migrations/0005_customers.sql` — table + RLS.
- `app/customers/actions.ts` — `createCustomer`, `updateCustomer`, `deleteCustomer`
  Server Actions, mirroring `app/price-list/actions.ts`'s shape.
- `app/customers/page.tsx` — server component, queries `customers` ordered by `name`.
- `app/customers/CustomerEditor.tsx` — client component mirroring `PriceListEditor.tsx`.

## Data flow

1. Signed-in user visits `/customers` (no nav link yet — direct URL only, until nav is
   wired centrally).
2. Server component queries `customers` (RLS-scoped to `auth.uid()`) ordered by `name`.
3. `CustomerEditor` renders an editable table; blur on any field saves via
   `updateCustomer`; the "Neuer Kunde" form at the bottom creates via `createCustomer`;
   each row has a "Löschen" button calling `deleteCustomer`.
4. On save/delete failure, a German error message is shown and (for update) the field
   reverts to the last successfully saved value, exactly like `PriceListEditor`.

## Error handling

- Query failure on page load: log server-side, render an empty table rather than
  crashing (same tolerant-empty-state pattern as `app/price-list/page.tsx`).
- Server Action failures: German user-facing error string, `console.error` server-side
  logging, discriminated-union return type — matches `app/price-list/actions.ts` exactly.

## Testing

- No pure logic complex enough to warrant unit tests (straight CRUD + validation of one
  field), matching the price-list precedent (no dedicated test file there either).
- Manual QA: create a customer, edit each field with blur-save, verify delete works,
  verify validation error shows for empty name.
