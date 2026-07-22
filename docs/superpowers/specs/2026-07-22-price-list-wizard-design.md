# Price list creation wizard — design

## Problem

`/price-list` only supports adding items one at a time via a manual form
(label, unit, price, category typed by hand). A new user starting from zero
has to know their own price structure and type every row before they can
generate their first quote. This is friction with no payoff — most trades
share a recognizable set of common line items.

## Goal

When a user's price list is empty, offer a wizard: pick your trade, review a
pre-filled starter list of common line items for that trade (with realistic
default prices), uncheck anything that doesn't apply, adjust prices, and
bulk-insert the rest in one action.

## Non-goals

- Not a general-purpose "insert template into existing list" tool. If the
  user already has items, they get the current manual editor, unchanged.
  Revisit as a follow-up if users ask to add a second trade's template later.
- Not an admin UI for managing templates. Templates are seeded by migration
  and edited directly in the Supabase SQL editor, same as any other static
  reference data in this app.
- Not AI-generated. Templates are a small curated, hardcoded catalog.

## Schema (new migration `0011_price_list_templates.sql`)

Two new tables, **global reference data** — not `organization_id`-scoped,
every user reads the same catalog:

```sql
create table public.price_list_templates (
  id uuid primary key default gen_random_uuid(),
  trade_key text not null unique,
  trade_label text not null,
  sort_order integer not null default 0
);
alter table public.price_list_templates enable row level security;
create policy "Authenticated users can view price list templates"
  on public.price_list_templates for select
  to authenticated using (true);

create table public.price_list_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.price_list_templates(id) on delete cascade,
  label text not null,
  unit text not null,
  default_unit_price_cents integer not null,
  category text not null,
  sort_order integer not null default 0
);
alter table public.price_list_template_items enable row level security;
create policy "Authenticated users can view price list template items"
  on public.price_list_template_items for select
  to authenticated using (true);
```

No insert/update/delete policy for any client role on either table — the
catalog is read-only from the app. Editing means running SQL directly, same
pattern as any other reference data in this codebase.

**Seed data** (same migration): 4 trades to start — Maler (painter),
Elektriker (electrician), Sanitär & Heizung (plumbing & heating), Bodenleger
(flooring) — each with 6-10 line items and realistic German-market default
prices sourced from public trade price guides. Comment in the migration
flagging these as starting estimates the user should sanity-check against
their own market, not verified quotes.

Risk tier: **T3** (new migration).

## UI / flow

`app/(app)/price-list/page.tsx`: fetch the user's `price_list_items` as
today. If (and only if) that list is empty, also fetch the full template
catalog (`price_list_templates` joined to `price_list_template_items`,
ordered by `sort_order`) and render `PriceListWizard` instead of
`PriceListEditor`. If the user has any items, behavior is unchanged — the
existing editor renders, no wizard, no persistent "use template" button in
this iteration.

**`PriceListWizard.tsx`** (new client component), two internal steps:

1. **Trade picker.** A row of cards, one per `trade_key`, plus a "Leer
   starten" (start blank) card that switches straight to
   `PriceListEditor`. Selecting a trade card moves to step 2.
2. **Review checklist.** Every template item for the chosen trade, each row:
   checkbox (checked by default), label, unit, and an editable price input
   pre-filled from `default_unit_price_cents` (same euro-input styling and
   cents-conversion pattern already used in `PriceListEditor`). A single
   "Übernehmen" button at the bottom. A "Zurück" link returns to step 1.

## Server action

New `createPriceListItemsFromTemplate` in `app/(app)/price-list/actions.ts`:

```ts
type TemplateSelection = { templateItemId: string; unitPriceCents: number };

async function createPriceListItemsFromTemplate(
  templateId: string,
  selections: TemplateSelection[],
): Promise<{ error: string | null }>
```

- Requires an authenticated user and resolves their org via
  `getCurrentOrg`, same as the existing actions.
- Re-reads the chosen template items **from the database** by
  `templateItemId` (never trusts client-sent label/unit/category) — only
  the checked-item id list and the user-edited price come from the client.
  Validates every id belongs to `templateId` and that price is a positive
  integer (reuses `validateInput`'s price rule).
- Performs one bulk `insert` into `price_list_items` (rows tagged with the
  resolved `organization_id` and `user_id`, same as `createPriceListItem`).
- Returns `{ error: null }` on success; the page revalidates and the newly
  inserted rows appear in the normal editor. On any row failing validation,
  the whole action fails with an error and nothing is inserted (atomic — no
  partially-applied list).

## Testing

- Migration: RLS smoke test — confirm `authenticated` can `select` from both
  tables and cannot `insert`/`update`/`delete` (mirrors the pattern from
  prior migrations' verification notes).
- `createPriceListItemsFromTemplate`: unit tests for — happy path bulk
  insert, rejection when a `templateItemId` doesn't belong to the given
  `templateId`, rejection on a non-positive edited price, empty-selection
  no-op.
- Manual QA: empty price list shows wizard; non-empty shows existing editor
  unchanged; unchecking items excludes them from the bulk insert; editing a
  price in the review step is reflected in the inserted row.
