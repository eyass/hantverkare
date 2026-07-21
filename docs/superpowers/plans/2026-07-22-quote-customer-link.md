# Quote Customer Link Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Link quotes to customers (`quotes.customer_id`), add an optional customer
picker to `/quotes/new`, and add a customer detail/history page at
`app/customers/[id]/page.tsx`.

**Architecture:** One migration adding a nullable `customer_id` FK to `quotes`. A picker
`<select>` on `/quotes/new` fed by a server-side customer fetch. A new customer detail
page mirroring `app/quotes/page.tsx`'s table rendering. A "Verlauf" link added to the
existing customer list.

**Tech Stack:** Next.js (App Router, Server Components + Server Actions), Supabase
Postgres/RLS.

---

## Task 1: Migration — `customer_id` on `quotes`

**Files:**
- Create: `supabase/migrations/0007_quote_customer_link.sql`

- [x] **Step 1: Write the migration**

```sql
alter table public.quotes
  add column customer_id uuid references public.customers(id) on delete set null;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0007_quote_customer_link.sql
git commit -m "feat: add customer_id link to quotes (#13)"
```

Note: this migration must be applied to the live Supabase project by a human — report
the exact SQL back to the controller for `docs/MANUAL-STEPS-PENDING.md`.

---

## Task 2: Customer picker on `/quotes/new`

**Files:**
- Modify: `app/quotes/new/page.tsx`
- Modify: `app/quotes/new/actions.ts`

- [ ] **Step 1:** `page.tsx` fetches `customers` (`select id, name order by name`),
  RLS-scoped, tolerant of query error (log + empty array), passes to the client form as
  a `customers` prop.
- [ ] **Step 2:** Client form renders a `<select name="customerId">` above/near the
  description textarea, default option `value=""` labeled "— kein Kunde ausgewählt —",
  followed by one `<option>` per customer (`value={id}`, text `name`).
- [ ] **Step 3:** `generateQuoteDraft` reads `formData.get("customerId")`; if it's a
  non-empty string, include `customer_id: customerId` in the `quotes` insert; otherwise
  `customer_id: null`.
- [ ] **Step 4: Commit**

```bash
git add app/quotes/new/page.tsx app/quotes/new/actions.ts
git commit -m "feat: add customer picker to new-quote form (#13)"
```

---

## Task 3: Customer detail/history page

**Files:**
- Create: `app/customers/[id]/page.tsx`
- Modify: `app/customers/CustomerEditor.tsx` (add "Verlauf" link per row)

- [ ] **Step 1:** `app/customers/[id]/page.tsx` — server component, `await params`,
  fetch `customers` row by id (`select id, name`), `notFound()` if error/missing. Fetch
  `quotes` (`id, customer_description, status, total_cents, created_at`) where
  `customer_id = id`, ordered by `created_at desc`. Render customer name as heading, then
  a table mirroring `app/quotes/page.tsx`'s markup (`formatEuros`, `formatDate`,
  `STATUS_LABELS`, truncated description linking to `/quotes/[id]`), with the same
  empty-state message pattern if there are no quotes yet.
- [ ] **Step 2:** `CustomerEditor.tsx` — add a "Verlauf" `<Link href={\`/customers/${customer.id}\`}>`
  in the actions cell (next to "Löschen"), as a static link outside the inline-edit
  state.
- [ ] **Step 3: Verify the build passes**

Run: `npm run build`, `npm run typecheck`, `npm run lint`, `npm test`.
Expected: all pass, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add app/customers/[id]/page.tsx app/customers/CustomerEditor.tsx
git commit -m "feat: add customer quote history page (#13)"
```

---

## Task 4: Review + verification pass

- [ ] **Step 1:** Self-review diff against spec.
- [ ] **Step 2:** Run `npm run build`, `npm run typecheck`, `npm run lint`, `npm test` —
  all must pass clean before pushing.
- [ ] **Step 3:** Push branch `feat/quote-customer-link`, open PR against `main` noting
  T3 risk tier and the pending manual migration-apply step. Do not merge.
