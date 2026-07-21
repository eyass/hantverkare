# Reporting/Analytics Dashboard — Design Spec

## Context

Closes GitHub issue #18: there's no way to see aggregate quote performance — conversion
rate and revenue from signed quotes are only computable by manually reading the
`/quotes` list. Decisions below made autonomously per the project's standing
full-autonomy override (`.harness/LOOP.md`).

## Decisions made autonomously

- **Route: `/reports`** — a new, standalone server component. No client-side JS needed;
  this is a pure read-only aggregation display, matching the server-component-first
  pattern used by `/quotes` and `/price-list`.
- **No new schema/migration.** Read-only aggregation over the existing `quotes` table,
  RLS-scoped to the signed-in user automatically — no explicit `user_id` filter needed,
  matching the pattern in `app/quotes/page.tsx`.
- **Metrics shown** (first version, kept simple):
  - Total quotes created (all statuses)
  - Count by status: draft / final / signed
  - Conversion rate: `signed / (final + signed)` as a percentage. Rationale: this
    answers "of quotes you finalized and sent, how many got signed" — a draft that
    never got finalized isn't a "lost" conversion, it's just unfinished work, so drafts
    are excluded from the denominator. Guard: if `final + signed === 0`, show "–"
    instead of dividing by zero.
  - Total revenue: sum of `total_cents` across `signed` quotes only (draft/final totals
    aren't realized revenue yet).
  - Average signed quote value: total revenue ÷ count of signed quotes. Guard: if there
    are zero signed quotes, show "–" instead of dividing by zero.
- **Computation approach**: one query fetching `status, total_cents` for all of the
  user's quotes, then compute every metric above in plain TypeScript in the page
  component. Simpler and more maintainable than several separate PostgREST
  aggregate queries (`count()`/`sum()`) for a first version — data volume per user is
  small (individual tradespeople, not enterprise scale), so server-component-side
  aggregation over the full row set is the right amount of engineering.
- **Presentation**: a responsive grid/flex of stat "tiles" (label + big number), similar
  visual weight to the totals block in `QuoteEditor.tsx` (`Zwischensumme` / `MwSt.` /
  `Gesamt`), using the same `formatEuros` euro-formatting helper pattern.
- **No date-range filtering, no charts/graphs** — YAGNI for a first version.
- **Risk tier: T2** (new page, no schema/auth/payments changes) per `.harness/RISK-TIERS.md`.

## Out of scope

- Date-range filters / historical trend charts.
- Per-status average or median (only average signed value is computed).
- Exporting the report (CSV/PDF).
- Nav link to `/reports` in `app/layout.tsx` — added centrally afterward by the
  controller to avoid merge conflicts with parallel in-flight work. This task does not
  touch `app/layout.tsx`.

## Architecture

- `app/reports/page.tsx` — server component. Queries `quotes` for `status, total_cents`
  only (RLS-scoped, no explicit filter/order needed since every row is aggregated),
  computes all metrics in TS, renders a grid of stat tiles.

## Data flow

1. Signed-in user visits `/reports` directly (nav link added later by controller).
2. Server component queries all of the user's `quotes` rows (`status`, `total_cents`).
3. In TypeScript: tally counts per status, compute conversion rate and revenue/average
   with divide-by-zero guards.
4. Render stat tiles: total quotes, draft count, final count, signed count, conversion
   rate, total revenue, average signed value.

## Error handling

- Query failure: log server-side (`console.error`), treat as zero quotes (render the
  empty/zero state) rather than crashing — matches the tolerant pattern in
  `app/quotes/page.tsx`.
- Zero quotes total: all counts show 0, conversion rate and average value show "–".

## Testing

- No pure logic worth extracting into a separately unit-tested module for a first
  version — the metric math is a few lines inline in the server component. Double-check
  by hand (and via manual QA) that:
  - Zero quotes → conversion "–", average "–", revenue €0,00.
  - Some drafts only, no final/signed → conversion "–" (denominator 0), revenue €0,00.
  - Mixed final + signed → conversion rate matches `signed / (final + signed)`.
  - Manual QA: visit `/reports` with a real account's data and confirm the numbers match
    what's visible on `/quotes`.
