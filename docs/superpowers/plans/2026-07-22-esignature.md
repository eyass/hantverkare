# Customer-Facing Quote Review + E-Signature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A public, unauthenticated `/q/[token]` link a tradesperson can share with their
customer, showing a read-only finalized quote with a click-to-sign consent flow that
moves the quote's status from `final` to `signed`.

**Architecture:** New `share_token`/`signed_at`/`signer_name`/`signer_ip` columns and a
three-value status check constraint on `quotes`; a service-role admin client used only
by the new public route and its sign Server Action; the existing authenticated
`/quotes/[id]` page gains a read-only share-link input and a three-way status label.

**Tech Stack:** Next.js (App Router, Server Components + Server Actions), Supabase
(Postgres/RLS + service-role client), TypeScript.

---

## Task 1: Migration — share token, signature columns, status constraint

**Files:**
- Create: `supabase/migrations/0006_esignature.sql`

- [ ] Add `share_token uuid not null default gen_random_uuid() unique`, `signed_at
      timestamptz`, `signer_name text`, `signer_ip text` to `public.quotes`.
- [ ] Drop and recreate the `status` check constraint to allow `('draft', 'final',
      'signed')`.

## Task 2: Admin (service-role) Supabase client

**Files:**
- Create: `lib/supabase/admin.ts`

- [ ] `createAdminClient()` using `@supabase/supabase-js`, `NEXT_PUBLIC_SUPABASE_URL` +
      `SUPABASE_SERVICE_ROLE_KEY`, `autoRefreshToken: false`, `persistSession: false`.
- [ ] No `"use client"` directive; confirm no client component imports it.

## Task 3: Public route — view + sign

**Files:**
- Create: `app/q/[token]/page.tsx`
- Create: `app/q/[token]/SignForm.tsx`
- Create: `app/q/[token]/actions.ts`

- [ ] `page.tsx`: look up quote by `share_token` via admin client, `notFound()` if
      missing; fetch line items; render read-only table + totals; branch on status
      (`draft` -> not-ready message, `final` -> `<SignForm>`, `signed` -> confirmation).
- [ ] `SignForm.tsx`: client component, name input + agreement checkbox + submit button,
      calls `signQuote`, shows German error text, disables while pending.
- [ ] `actions.ts`: `signQuote(token, signerName)` — validate trimmed non-empty name,
      look up quote by token via admin client, `update(...).eq("share_token",
      token).eq("status", "final")`, best-effort IP via `headers()`, return discriminated
      union result matching the existing `updateLineItem`/`finalizeQuote` pattern.

## Task 4: Tradesperson-side share link + status label

**Files:**
- Modify: `app/quotes/[id]/page.tsx`
- Modify: `app/quotes/[id]/QuoteEditor.tsx`

- [ ] Add `share_token` to the `.select(...)` column list in `page.tsx`.
- [ ] `QuoteEditor.tsx`: add `share_token` to the `Quote` type; render a read-only
      `<input readOnly>` with `{NEXT_PUBLIC_SITE_URL}/q/{share_token}` when status is
      `final` or `signed`; update the status header to a three-way label.

## Task 5: Verification

- [ ] `npm run build`, `npm run typecheck`, `npm run lint`, `npm test` all clean.
- [ ] Confirm `SUPABASE_SERVICE_ROLE_KEY` only appears in `lib/supabase/admin.ts` and
      `.env.example`, never in a `"use client"` file or client bundle.

## Task 6: Ship

- [ ] Commit in small logical commits, push `feat/e-signature`, open PR (T3, note
      pending manual migration step, note this is consent-click not qualified
      e-signature). Do not merge.
