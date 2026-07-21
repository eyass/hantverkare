# Quotes List / Dashboard Page — Design Spec

## Context

Closes [issue #9](https://github.com/eyass/hantverkare/issues/9): there's currently no
way to see all of a signed-in user's quotes — only direct links to `/quotes/[id]` work.
Decisions below made autonomously per the project's standing full-autonomy override.

## Decisions made autonomously

- **Route: `/quotes`** (index page). Server component, RLS already scopes the query to
  the signed-in user — no explicit `user_id` filter needed in the query itself.
- **Filter by status via query param** (`?status=draft` / `?status=final`, no param =
  all), rendered as simple links/tabs — no client-side JS needed for this, matches the
  server-component-first pattern already used elsewhere in the app.
- **Columns shown**: truncated description, status badge, total (EUR), created date,
  link to `/quotes/[id]`.
- **Add navigation**: the root layout's header (currently just email + Abmelden) gains
  links to `/quotes` and `/price-list` when signed in — this is the first real nav the
  app has had, since every prior feature was a single standalone page.
- **`/quotes/new`'s "Neues Angebot" flow is unaffected** — this page is purely additive,
  a new entry point, not a replacement for anything.
- **Risk tier: T2** (new page + nav change, no schema/auth/payments).

## Out of scope

- Search/sort beyond the status filter (YAGNI for a first version)
- Pagination (no account will realistically have enough quotes yet to need it)
- Bulk actions (delete/archive multiple quotes)

## Architecture

- `app/quotes/page.tsx` — server component. Reads `searchParams` for `status`, queries
  `quotes` (RLS-scoped), renders a table + status filter links + a link to `/quotes/new`.
- `app/layout.tsx` — add nav links in the existing header, only when `user` is present.

## Data flow

1. Signed-in user visits `/quotes` (directly, or via new header nav link).
2. Server component queries `quotes` ordered by `created_at desc`, optionally filtered
   by `status` from the query string.
3. Renders a table; each row links to `/quotes/[id]`. Empty state (no quotes yet) shows
   a prompt to create one.

## Error handling

- Query failure: log server-side, render an empty table rather than crashing (matches
  the tolerant-empty-state pattern already used in `app/price-list/page.tsx`).
- Invalid `status` query param (anything other than `draft`/`final`): treated as "no
  filter" (show all), not an error.

## Testing

- No pure logic to unit test (a straight DB read + render).
- Manual QA: visit `/quotes` with existing quotes, confirm filter links work, confirm
  nav links appear in the header, confirm empty state renders for an account with none.
