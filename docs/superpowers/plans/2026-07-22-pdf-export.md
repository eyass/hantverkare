# PDF Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Export a quote as a PDF via a GET route handler, downloadable from the quote view. Closes issue #10.

**Architecture:** `app/quotes/[id]/pdf/route.ts` (Node runtime GET handler, own RLS-scoped data fetch) renders `app/quotes/[id]/QuotePdfDocument.tsx` (`@react-pdf/renderer` component tree) via `renderToBuffer`, returning a `Response` with `application/pdf` + `Content-Disposition: attachment`. `QuoteEditor.tsx` gets a plain download link.

**Tech Stack:** Next.js Route Handlers, `@react-pdf/renderer`, Supabase RLS.

---

## Task 1: Add dependency

- [ ] **Step 1:** `npm install @react-pdf/renderer`
- [ ] **Step 2:** Commit `package.json`/`package-lock.json`:
```bash
git add package.json package-lock.json
git commit -m "chore: add @react-pdf/renderer dependency (#10)"
```

## Task 2: PDF layout component

**Files:** Create `app/quotes/[id]/QuotePdfDocument.tsx`

- [ ] **Step 1:** Define prop types: `quote` (customer_description, status, subtotal_cents,
  vat_cents, total_cents, created_at), `lineItems` (description, quantity, unit,
  unit_price_cents, line_total_cents), `businessSettings` (company_name, address, vat_id,
  tax_number — all nullable, or the whole object null).
- [ ] **Step 2:** Build `Document`/`Page`/`View`/`Text` tree with `StyleSheet.create`:
  letterhead block (only present business_settings fields, each on its own line),
  "Angebot" heading + formatted creation date, customer description paragraph, a table
  (header row + one row per line item, columns: Beschreibung/Menge/Einheit/
  Einzelpreis/Gesamt), totals block (Zwischensumme/MwSt. (19%)/Gesamt) right-aligned.
  Format cents as EUR via `toLocaleString("de-DE", ...)` same helper pattern as
  `QuoteEditor.tsx`.
- [ ] **Step 3:** Commit:
```bash
git add "app/quotes/[id]/QuotePdfDocument.tsx"
git commit -m "feat: add PDF layout component for quotes (#10)"
```

## Task 3: Route handler

**Files:** Create `app/quotes/[id]/pdf/route.ts`

- [ ] **Step 1:** `export const runtime = "nodejs";` GET handler `(request, { params })`.
  `const { id } = await params;`. `createClient()` from `lib/supabase/server.ts`.
- [ ] **Step 2:** Fetch quote: `select("id, customer_description, status, subtotal_cents,
  vat_cents, total_cents, created_at").eq("id", id).single()` (or `maybeSingle()`) — on
  no row, `return new Response("Not found", { status: 404 })`.
- [ ] **Step 3:** Fetch line items ordered by `position`; on error log + fall back to `[]`
  rather than 404ing (empty list still renders a valid PDF).
- [ ] **Step 4:** Fetch `business_settings` via `.maybeSingle()` (RLS-scoped, no explicit
  `user_id` filter needed — mirrors `app/settings/page.tsx`); log on error, treat as null.
- [ ] **Step 5:** `const buffer = await renderToBuffer(<QuotePdfDocument .../>)`. Return
  `new Response(buffer, { headers: { "Content-Type": "application/pdf",
  "Content-Disposition": \`attachment; filename="angebot-${id}.pdf"\` } })`.
- [ ] **Step 6:** Commit:
```bash
git add "app/quotes/[id]/pdf/route.ts"
git commit -m "feat: add PDF export route handler for quotes (#10)"
```

## Task 4: UI trigger

**Files:** Modify `app/quotes/[id]/QuoteEditor.tsx`

- [ ] **Step 1:** Add `<a href={\`/quotes/${quote.id}/pdf\`} download className="...">Als
  PDF herunterladen</a>` near the share-link / finalize-button area, styled as a
  secondary button (border, not the solid finalize-button style).
- [ ] **Step 2:** Commit:
```bash
git add "app/quotes/[id]/QuoteEditor.tsx"
git commit -m "feat: add PDF download link to quote view (#10)"
```

## Task 5: Verification pass

- [ ] **Step 1:** Optional — dispatch a review sub-agent focused on the route handler's
  auth/error-handling correctness (working solo in an isolated worktree).
- [ ] **Step 2:** Run `npm run build`, `npm run typecheck`, `npm run lint`, `npm test` —
  all must pass clean. Pay special attention to `npm run build` succeeding with the new
  dependency; add `export const runtime = "nodejs";` if the build complains about Edge
  compatibility.
- [ ] **Step 3:** Push branch `feat/pdf-export`, open PR against `main` noting T2 risk
  tier. Do not merge.
