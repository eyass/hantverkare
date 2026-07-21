# Customer Records Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `customers` table (RLS-scoped) plus a `/customers` page with inline-editable CRUD, matching the `app/price-list` pattern exactly. Foundation for future issue #13 (quote history per customer) — no wiring to `quotes` in this task.

**Architecture:** One migration adding `public.customers` + owner-scoped RLS policies. A server component (`app/customers/page.tsx`) fetching RLS-scoped rows ordered by `name`, a client component (`app/customers/CustomerEditor.tsx`) mirroring `PriceListEditor.tsx`'s save-on-blur / revert-on-error pattern, and Server Actions (`app/customers/actions.ts`) mirroring `app/price-list/actions.ts`'s discriminated-union shape.

**Tech Stack:** Next.js (App Router, Server Components + Server Actions), Supabase Postgres/RLS.

---

## Task 1: Migration — `customers` table + RLS

**Files:**
- Create: `supabase/migrations/0005_customers.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Customer records (issue #12): a dedicated table for a tradesperson's customer
-- contact info, separate from the free-text customer_description on quotes.
-- Foundation for issue #13 (quote history per customer), which will later add a
-- customer_id column to quotes — not part of this migration.

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

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0005_customers.sql
git commit -m "feat: add customers table + RLS (#12)"
```

Note: this migration must be applied to the live Supabase project by a human via the SQL
editor (or `supabase db push`) — the agent cannot run it. Report the exact SQL back to
the controller for `docs/MANUAL-STEPS-PENDING.md`.

---

## Task 2: Server Actions

**Files:**
- Create: `app/customers/actions.ts`

- [ ] **Step 1: Write `createCustomer`, `updateCustomer`, `deleteCustomer`**

Mirror `app/price-list/actions.ts`'s exact shape: a `CustomerInput` type (`name`, `email`,
`phone`, `address`), a `CustomerRow` type matching the select columns, a
`validateInput` helper that only checks `name.trim().length > 0` (German error:
"Name darf nicht leer sein."), a `CreateResult` discriminated union, and an
`ActionResult` type for update/delete. Auth check (`supabase.auth.getUser()`, "Bitte
melde dich an." on missing user) only needs to happen in `createCustomer` (matches the
price-list precedent — update/delete rely on RLS to scope/reject).

German error strings:
- Validation: "Name darf nicht leer sein."
- Create failure: "Kunde konnte nicht angelegt werden."
- Update failure: "Kunde konnte nicht gespeichert werden."
- Delete failure: "Kunde konnte nicht gelöscht werden."

- [ ] **Step 2: Commit**

```bash
git add app/customers/actions.ts
git commit -m "feat: add customer CRUD server actions (#12)"
```

---

## Task 3: List page + editor component

**Files:**
- Create: `app/customers/page.tsx`
- Create: `app/customers/CustomerEditor.tsx`

- [ ] **Step 1: `app/customers/page.tsx`**

Server component: `createClient()`, select `id, name, email, phone, address` from
`customers` ordered by `name`, log on error, render empty array fallback, pass to
`<CustomerEditor customers={...} />`.

- [ ] **Step 2: `app/customers/CustomerEditor.tsx`**

Mirror `PriceListEditor.tsx` structure: `customers` state, `lastSavedCustomers` state,
`error` state, `newCustomer` form state (`name`, `email`, `phone`, `address` — all
strings, no cents conversion needed here), `isPending`/`startTransition`. Table columns:
Name, E-Mail, Telefon, Adresse, delete button. Add-new section titled "Neuer Kunde" with
a "Kunde hinzufügen" button. Delete button labeled "Löschen". Blur-save on every field,
revert to `lastSavedCustomers` entry on update failure, same as the price-list pattern.

- [ ] **Step 3: Verify the build passes**

Run: `npm run build`, `npm run typecheck`, `npm run lint`.
Expected: all pass, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add app/customers/page.tsx app/customers/CustomerEditor.tsx
git commit -m "feat: add /customers list + inline-edit page (#12)"
```

---

## Task 4: Review + verification pass

- [ ] **Step 1:** Optional — dispatch a code-quality/spec-compliance review sub-agent
  against the diff (author is working solo in an isolated worktree, so this is
  recommended but not mandatory).
- [ ] **Step 2:** Run `npm run build`, `npm run typecheck`, `npm run lint`, `npm test` —
  all must pass clean before pushing.
- [ ] **Step 3:** Push branch `feat/customer-records`, open PR against `main` noting T3
  risk tier and the pending manual migration-apply step. Do not merge.
