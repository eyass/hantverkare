# AI Quote Generation — Design Spec

## Context and scope pivot

This project (`hantverkare`) is pivoting from a generic "tradesperson marketplace" to
a clone of [Bliqat](https://bliqat.com/): a B2B SaaS tool for tradespeople
(Handwerker) that turns a spoken/typed job description into a priced, signable
quote in under a minute. Unlike a marketplace, there's no browsing or matching of
providers — it's a solo-operator admin tool.

Key differences from Bliqat for our version:
- **Market: Germany**, not Sweden. No ROT tax deduction (that's Swedish-specific).
  German VAT (Mehrwertsteuer, 19%) applies instead.
- **UI and quote output language: German.**

Bliqat's full product has four largely independent subsystems: voice-to-text
capture, AI quote generation (pricing), e-signature (BankID-equivalent), and
auto-invoicing. This spec covers only the first real feature: **AI quote
generation from a typed job description**, as an editable draft the tradesperson
finalizes. Voice capture, e-signature, and invoicing are separate future features.

## Goal

A tradesperson types a free-text description of a job. AI generates a structured,
priced quote (line items against a seeded price list) as an editable draft. The
tradesperson can adjust line items and then finalize the quote.

## Out of scope for this feature

- Authentication / user accounts (single-tenant prototype — no auth yet, added later)
- Voice input (typed text only for now)
- E-signature / BankID-equivalent customer signing flow
- Auto-invoicing from a finalized quote
- Editing the underlying price list via UI (seeded via migration only)
- ROT-equivalent tax deductions (not applicable to the German market)

## Architecture

- Next.js App Router, single new page: `/quotes/new` — a free-text textarea form.
- Server Action `generateQuoteDraft(description: string)`:
  1. Sends the description plus the full seeded price list (as context) to Claude
     via the Anthropic API, using tool-use to force a structured JSON response:
     an array of line items (`description`, `quantity`, `unit`, `unit_price_cents`).
  2. Validates the returned JSON against the expected schema server-side.
  3. Computes `line_total_cents` per item, `subtotal_cents`, `vat_cents` (19% of
     subtotal), `total_cents`.
  4. Inserts one `quotes` row (`status = 'draft'`) and its `quote_line_items` rows
     in a single transaction.
  5. Returns the new quote id.
- Redirect to `/quotes/[id]` — an edit view rendering an editable line-item table
  (description, quantity, unit price editable inline) with a live running total.
- A second Server Action `updateLineItem` persists edits, recalculating all totals
  server-side on every save (client-side total display is optimistic only).
- A `finalizeQuote` Server Action sets `status = 'final'`, `finalized_at = now()`.
  Once final, the page renders read-only.
- No auth: quotes are not scoped to a user in this feature.

## Data model

Money is stored as integer cents throughout to avoid floating-point rounding
issues. Totals are always recalculated server-side from line items — never
trusted from the client. Both new tables have RLS enabled with open policies for
now (no auth yet), matching the project's "every table has RLS" convention from
`supabase/migrations/0001_init.sql`.

### `price_list_items` (seeded via migration, read-only in this feature's UI)
| column | type | notes |
|---|---|---|
| `id` | uuid, PK | |
| `label` | text | e.g. "Sanitärinstallation, Stunde" |
| `unit` | text | e.g. `Stunde`, `Stück`, `m²` |
| `unit_price_cents` | integer | |
| `category` | text | e.g. `Sanitär`, `Elektro`, `Bodenbelag` |

Seeded with a small sample German Handwerker price list (plumbing/Sanitär-focused,
matching Bliqat's own initial focus) — enough categories/items for the AI to have
real pricing context to match against, not an exhaustive catalog.

### `quotes`
| column | type | notes |
|---|---|---|
| `id` | uuid, PK | |
| `customer_description` | text | raw job description as typed |
| `status` | text | `draft` \| `final` |
| `subtotal_cents` | integer | |
| `vat_cents` | integer | 19% of subtotal |
| `total_cents` | integer | |
| `created_at` | timestamptz | default `now()` |
| `finalized_at` | timestamptz | nullable |

### `quote_line_items`
| column | type | notes |
|---|---|---|
| `id` | uuid, PK | |
| `quote_id` | uuid, FK → `quotes.id` | `on delete cascade` |
| `description` | text | |
| `quantity` | numeric | |
| `unit` | text | |
| `unit_price_cents` | integer | |
| `line_total_cents` | integer | `quantity * unit_price_cents`, recomputed on save |
| `position` | integer | for stable ordering in the UI |

## Data flow (happy path)

1. User lands on `/quotes/new`, types a job description (e.g. "Küchenspüle
   austauschen, neuen Wasserhahn montieren, 2 Stunden Arbeit"), submits.
2. `generateQuoteDraft` calls Claude with the description + seeded price list,
   gets back structured line items, computes totals, inserts `quotes` (draft) +
   `quote_line_items`.
3. Redirect to `/quotes/[id]`.
4. Tradesperson reviews/edits line items inline; each edit calls `updateLineItem`,
   which recalculates and persists all totals.
5. Tradesperson clicks "Finalize" → `finalizeQuote` sets status to `final`; page
   becomes read-only.

## Error handling

- **Claude call fails or times out**: inline error on `/quotes/new` with a retry
  button. Nothing is persisted until generation succeeds — no partial/empty quote
  rows are ever created.
- **Claude returns malformed or empty line items**: treated as a generation
  failure (same as above); the tool-use JSON response is schema-validated
  server-side before any DB insert is attempted.
- **Edits on a finalized quote**: `updateLineItem` and `finalizeQuote` both check
  `status = 'draft'` server-side and reject the action if the quote is already
  final — client-side disabled UI state is not trusted alone.
- **Invalid edit values** (negative/zero quantity or price): rejected server-side
  with an inline validation error on that row; not persisted.

## Testing

- Unit tests for the pure pricing math (subtotal/VAT/total from a set of line
  items) — deterministic, no AI involved.
- A stubbed/fixture Claude response to test the parse-validate-persist path
  (structured JSON → DB rows) without hitting the real API in CI.
- Manual end-to-end QA via the browser skill against the live Claude API for the
  full flow: generate → edit → finalize.
