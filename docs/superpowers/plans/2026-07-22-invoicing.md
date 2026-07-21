# Auto-Generated Invoicing from Signed Quotes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Once a quote is `signed`, a "Rechnung erstellen" button on `/quotes/[id]`
generates a frozen invoice record (sequential per-user-per-year number, amounts copied
from the quote at issue time) and displays it inline.

**Architecture:** New `invoices` + `invoice_counters` tables and a race-safe
`next_invoice_number` Postgres function; a `createInvoice` Server Action appended to the
existing `app/quotes/[id]/actions.ts`; a new `InvoiceSection` client component rendered
by `QuoteEditor` when `status === "signed"`.

**Tech Stack:** Next.js (App Router, Server Components + Server Actions), Supabase
(Postgres/RLS + `.rpc()`), TypeScript.

---

## Task 1: Migration — invoices table, counter table, numbering function

**Files:**
- Create: `supabase/migrations/0008_invoices.sql`

- [ ] `invoice_counters` table: `user_id uuid`, `year int`, `last_seq int not null
      default 0`, pk `(user_id, year)`. RLS enabled, owner-select-only policy (no
      client insert/update — only the `security definer` function touches it).
- [ ] `invoices` table: `id uuid pk default gen_random_uuid()`, `user_id uuid not null
      references auth.users(id) on delete cascade`, `quote_id uuid not null references
      public.quotes(id) on delete cascade`, `invoice_number text not null`, `issued_at
      timestamptz not null default now()`, `subtotal_cents integer not null`,
      `vat_cents integer not null`, `total_cents integer not null`, `unique (user_id,
      invoice_number)`, `unique (quote_id)`.
- [ ] RLS on `invoices`: owner-scoped select + insert only (no update/delete policies).
- [ ] `next_invoice_number(p_user_id uuid) returns text` — `security definer`,
      `set search_path = public`, atomic `insert ... on conflict (user_id, year) do
      update set last_seq = last_seq + 1 returning last_seq`, formats
      `RE-{year}-{seq zero-padded to 4}`.

## Task 2: `createInvoice` Server Action

**Files:**
- Modify: `app/quotes/[id]/actions.ts` (append only — do not restructure
  `updateLineItem`/`finalizeQuote`)

- [ ] `createInvoice(quoteId: string)`: load quote, verify `status === "signed"`
      (RLS already scopes to owner); verify no existing invoice for `quote_id`; call
      `.rpc("next_invoice_number", { p_user_id: user.id })`; insert the `invoices` row
      copying `subtotal_cents`/`vat_cents`/`total_cents` from the quote; return a
      discriminated union result (`{ error, invoice? }`) matching the existing pattern.
- [ ] Handle the `unique (quote_id)` constraint violation gracefully (race: two rapid
      clicks) — return the already-created invoice instead of an error.

## Task 3: Invoice UI

**Files:**
- Create: `app/quotes/[id]/InvoiceSection.tsx`
- Modify: `app/quotes/[id]/page.tsx`
- Modify: `app/quotes/[id]/QuoteEditor.tsx`

- [ ] `page.tsx`: fetch `invoices` row where `quote_id = id` (RLS-scoped), pass to
      `QuoteEditor`.
- [ ] `QuoteEditor.tsx`: accept `invoice` prop; render `<InvoiceSection>` when
      `status === "signed"`.
- [ ] `InvoiceSection.tsx`: client component. No invoice yet -> "Rechnung erstellen"
      button, calls `createInvoice`, shows German error on failure. Invoice exists ->
      read-only display of invoice number, issue date, subtotal/VAT/total (German
      formatting, matching `QuoteEditor`'s `formatEuros`/labels tone).

## Task 4: Verification

- [ ] Self-review (or sub-agent review) the race-safety logic in
      `next_invoice_number` and `createInvoice` specifically.
- [ ] `npm run build`, `npm run typecheck`, `npm run lint`, `npm test` all clean.

## Task 5: Ship

- [ ] Commit in small logical commits, push `feat/invoicing`, open PR (T3, note pending
      manual migration step). Do not merge.
