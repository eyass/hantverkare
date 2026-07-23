# Multi-room / multi-phase line-item grouping design

> Decided autonomously (standing full-autonomy directive for this project). Follow-up from the quote-generation intelligence work (#200/#201/#202/#203): a job description spanning multiple rooms or phases (e.g. "Küche und Bad renovieren", or a job with clear prep/execution/cleanup phases) currently produces one flat, undifferentiated line-item list. Nothing in the schema or UI has any concept of grouping today (verified: `quote_line_items` has no group/section/phase column, `QuoteEditor.tsx` renders a flat ordered list by `position`).

**Goal:** Let a quote's line items be organized into named groups (rooms, trades, or phases — the tradesperson's own vocabulary, not a fixed taxonomy) both when the AI generates a multi-area job and when a tradesperson manually reorganizes a quote. Groups are a display/organization concern only — they never affect pricing, VAT, or invoice creation, which continue to operate on the flat total exactly as today.

## Data model

Add one nullable column, no new table: `quote_line_items.group_label` (text, nullable). Rejected alternative: a separate `quote_line_item_groups` table with its own id/order — unnecessary normalization for something that's just a shared label with no independent metadata (no per-group description, no per-group discount). This mirrors this repo's existing preference for plain additive columns over new join tables when the "entity" has no independent identity (see `item_type`/`quantity_reasoning`/`confidence` from #200-#202, all plain columns on the same row rather than side tables).

**Ordering:** `position` remains the single global sort key across the whole quote, exactly as today — this spec does not introduce a second per-group ordering column. Group boundaries are derived at render time: cluster items by `group_label`, order each cluster by the minimum `position` among its members (first-appearance order), and within a cluster sort by `position`. This is robust to future manual reordering without ever needing a renumbering migration, and it means a quote with no grouped items renders byte-identical to today (empty/absent `group_label` on every row is exactly the current flat-list behavior — full backward compatibility, zero visual change for the common case).

**Migration:** `supabase/migrations/0043_line_item_grouping.sql` — `alter table quote_line_items add column group_label text;`. No RLS changes (plain column on an already-scoped table). No check constraint on content (free text, tradesperson's own naming — "Küche", "Vorbereitung", whatever fits the job); only constrain length if needed for UI sanity (e.g. `check (group_label is null or char_length(group_label) <= 60)`).

## AI generation

Extend the `submit_line_items` tool schema (`lib/quotes/generateLineItems.ts`) with an optional `groupLabel` string per line item, alongside the existing `itemType`/`quantityReasoning`/`confidence` fields. Prompt instruction: only assign a `groupLabel` when the job description clearly spans multiple distinct rooms/areas/phases (e.g. "Küche" and "Bad" as two areas, or "Vorbereitung"/"Ausführung" as two phases) — for a single-room, single-phase job (the common case), leave every item's `groupLabel` unset, so most quotes stay ungrouped and visually simple. This is the same "don't manufacture structure where none is needed" principle already used for `clarifyingQuestions` (#194) and `riskFlags` (#193) — additive signal only when it's genuinely warranted, never forced.

## UI

**`QuoteEditor.tsx`:** if no line item on the quote has a `group_label`, render exactly as today (flat list, no behavior change). If at least one item has a `group_label`, render clustered sections: each distinct label as its own section (ordered by first appearance) with a small subtotal line (sum of that cluster's `line_total_cents`), and any remaining ungrouped items collected into a final untitled/"Weitere Positionen" section so nothing silently disappears from view. Each line item gets an editable group-assignment control (a combobox: pick an existing label already used on this quote, or type a new one) so a tradesperson can regroup, rename, or ungroup items after the fact — renaming a group is just relabeling every item that shares the old label to the new one in a single update, not a separate rename operation on a group entity (there is no group entity to rename).

**Customer-facing surfaces** (`app/q/[token]/page.tsx`, `app/(app)/quotes/[id]/pdf/route.tsx` / `QuotePdfDocument.tsx`): apply the same clustered rendering with subtotals, since a grouped breakdown is exactly the kind of readability improvement a customer benefits from on a multi-room job, and this repo's `QuotePdfDocument` already computes line totals it can reuse the same clustering helper for. Reuse one shared pure function (e.g. `lib/quotes/groupLineItems.ts`) for the clustering logic across editor, PDF, and customer page rather than reimplementing it three times.

## Explicitly out of scope for v1

- No group-level pricing (discounts, markups) — a group is purely organizational; totals still sum the flat line items exactly as today.
- No drag-and-drop cross-group reordering UI beyond the combobox reassignment — if that turns out to feel clunky in practice, a follow-up can add drag-and-drop, but it's not justified up front.
- No AI re-grouping of an already-generated draft (e.g. "split this into rooms after the fact") — `regenerateQuoteDraft` (#194) already re-runs generation from scratch when more detail is added, which naturally re-evaluates grouping; a dedicated "re-group my existing items" action is a separate, smaller feature that can be added later if wanted.

## Testing

Unit test `lib/quotes/groupLineItems.ts` (the pure clustering function) directly: ungrouped input returns one implicit cluster (or the existing flat shape, whichever the editor/PDF components expect — decide based on what's least invasive to their current rendering code), mixed grouped/ungrouped input produces clusters in first-appearance order with correct subtotals, and a cluster order test proving stability against out-of-order `position` values within a group. Extend `generateLineItems.test.ts` for the new optional `groupLabel` field (valid string accepted, absent field defaults to ungrouped, and — mirroring the existing malformed-field tests — a non-string value is rejected).
