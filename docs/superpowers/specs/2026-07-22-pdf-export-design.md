# PDF Export — Design Spec

## Context

Closes [issue #10](https://github.com/eyass/hantverkare/issues/10): tradespeople need to
export a quote as a PDF to email, print, or archive it — independent of the e-signature
flow (`app/q/[token]/*`). Decisions below made autonomously per the project's standing
full-autonomy override (`.harness/LOOP.md`).

## Decisions made autonomously

- **Library: `@react-pdf/renderer`.** Pure-JS PDF renderer, no headless Chromium needed
  (avoids native-binary/serverless headaches on Vercel). New dependency.
- **Route: `app/quotes/[id]/pdf/route.ts`**, a GET Route Handler, not a Server Action —
  Route Handlers are the correct primitive for streaming a file download with
  `Content-Type`/`Content-Disposition` headers. Runs with `export const runtime =
  "nodejs";` since `@react-pdf/renderer` needs Node APIs, not the Edge runtime.
- **Auth/authorization**: uses the normal RLS-scoped `createClient()` (from
  `lib/supabase/server.ts`) exactly like `app/quotes/[id]/page.tsx` does. If the quote
  row isn't visible to the caller (not signed in, or not the owner — RLS hides other
  users' rows), the query returns no row and the handler responds `404`. No separate
  ownership check needed beyond what RLS already enforces — this matches the existing
  page's pattern of trusting RLS rather than re-checking `user_id` in application code.
- **Available for any quote status** (draft/final/signed) — a tradesperson may want to
  preview or print a draft. No status gate in the route.
- **Independent data fetch**: the route does its own `quotes` + `quote_line_items` +
  `business_settings` queries, mirroring the columns `app/quotes/[id]/page.tsx` and
  `app/settings/page.tsx` already select. This keeps the PDF route fully decoupled from
  the page component's data flow — no changes needed to `page.tsx`.
- **`business_settings` may not exist** (`maybeSingle()`, matching `app/settings/page.tsx`).
  Blank/null fields (company name, address, VAT ID, tax number) are simply omitted from
  the letterhead — never render the literal string "null" or an empty line for a missing
  field.
- **PDF content**: letterhead (company name / address / VAT ID / tax number — only the
  fields that are present), quote creation date, the customer description, a line-items
  table (description, quantity, unit, unit price, line total), and a totals block
  (subtotal, 19% VAT, total). Single page, simple business-document layout — no elaborate
  design work, matches the spirit of the existing plain-HTML-table quote editor.
- **Quote creation date**: the PDF route selects `created_at` explicitly in its own
  independent query and formats it `de-DE`. If the column somehow isn't present the
  render still succeeds (line simply omitted) — no crash on a missing field, consistent
  with the "omit blank/missing, never show null" rule.
- **Filename**: `Content-Disposition: attachment; filename="angebot-<id>.pdf"` — plain,
  predictable, no dependency on customer name being set.
- **Trigger**: a plain `<a href={\`/quotes/${quote.id}/pdf\`} download>Als PDF
  herunterladen</a>` styled as a secondary button in `QuoteEditor.tsx`, next to the
  existing finalize button / share-link section. No client JS — a normal browser
  download link, so it doesn't need a Server Action or `useTransition`.
- **Risk tier: T2** (new page/route, no auth/schema/payment changes) per
  `.harness/RISK-TIERS.md`. Per the standing PR-gate override this doesn't block
  auto-merge, but no migration is involved so there's no manual apply step either.

## Out of scope

- Any change to `app/quotes/[id]/page.tsx`'s data fetching, `app/quotes/[id]/actions.ts`,
  `app/q/[token]/*`, `lib/supabase/admin.ts`, `app/customers/*`, `app/price-list/*`,
  `app/settings/*`, `app/layout.tsx`, `app/quotes/new/*`.
- Emailing the PDF, storing it, or any e-signature interaction — this is a plain download.
- Custom fonts/logo upload — default `@react-pdf/renderer` fonts (Helvetica) are enough
  for a "sensible business document," not a design-polish task.

## Architecture

- `app/quotes/[id]/pdf/route.ts` — GET handler: RLS-scoped fetch of the quote, its line
  items, and the caller's `business_settings` row; renders `QuotePdfDocument` via
  `renderToBuffer`; returns a `Response` with PDF headers. 404 if the quote isn't found.
- `app/quotes/[id]/QuotePdfDocument.tsx` — `@react-pdf/renderer` `Document`/`Page`/
  `View`/`Text`/`StyleSheet` component tree defining the PDF layout. Pure presentation,
  no data fetching.
- `app/quotes/[id]/QuoteEditor.tsx` — adds the download link (already has `quote.id`
  in props, no new prop needed).

## Data flow

1. User on `/quotes/[id]` clicks "Als PDF herunterladen".
2. Browser navigates to `GET /quotes/[id]/pdf` as a normal download (the `download`
   attribute plus `Content-Disposition: attachment` triggers a save-file dialog rather
   than in-browser navigation).
3. The route handler creates an RLS-scoped Supabase client, fetches the quote (404s if
   absent), fetches its line items ordered by `position`, and fetches the caller's
   `business_settings` (nullable).
4. `renderToBuffer(<QuotePdfDocument ... />)` produces the PDF bytes.
5. Response returned with `Content-Type: application/pdf` and
   `Content-Disposition: attachment; filename="angebot-<id>.pdf"`.

## Error handling

- Quote not found / not owned (RLS hides it): `404`.
- Line items query error: log server-side, treat as empty list (a genuinely empty
  line-items array is a fine, still-valid PDF — no reason to fail the whole download
  over a query error like `page.tsx` currently does).
- `business_settings` query error or missing row: log if error, otherwise silently treat
  as "no business settings," omit letterhead fields.

## Testing

- No pure-logic unit tests added — this is data fetch + presentational component,
  matching the precedent of not unit-testing `page.tsx`/`QuoteEditor.tsx`.
- Manual/automated verification: `npm run build` succeeding is the main signal that
  `@react-pdf/renderer` behaves in the Next.js build; manually download a PDF for a
  quote with and without `business_settings` filled in during review.
