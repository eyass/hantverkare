# Real Authentication — Design Spec

## Context

Closes [issue #14](https://github.com/eyass/hantverkare/issues/14). The AI quote generation feature (shipped) was built as a single-tenant, no-auth prototype — `quotes`, `quote_line_items`, and `price_list_items` all have fully open RLS policies, documented as a known, accepted gap ("no auth yet") in `supabase/migrations/0002_quotes.sql`. This closes that gap and, by decision during brainstorming, folds in [issue #16](https://github.com/eyass/hantverkare/issues/16) (per-tradesperson price lists) rather than leaving `price_list_items` shared/global — the two are naturally the same migration, and doing them separately would touch the same table twice.

## Goal

Real Supabase Auth (magic link, open signup). Every tradesperson gets their own account, their own price list, and their own quotes — fully isolated from other accounts via RLS.

## Out of scope

- Email/password login (magic link only, per decision during brainstorming)
- Invite/allowlist gating (open signup)
- Multi-user/team accounts (separate backlog item, [#15](https://github.com/eyass/hantverkare/issues/15))
- Preserving existing prototype data (explicitly wiped, see Data Model)
- A DB-level trigger enforcing finalized-quote immutability (pre-existing, documented, unrelated gap — not fixed by this feature)

## Architecture

- **Supabase Auth, magic link only.** `/login` page: an email input, calling `supabase.auth.signInWithOtp({ email })` on submit. Supabase emails a magic link.
- **`middleware.ts`** (new, at the project root): refreshes the Supabase session on every request per Supabase's standard Next.js SSR pattern. This resolves the existing TODO in `lib/supabase/server.ts` ("add middleware.ts to refresh sessions before real auth ships"). It also enforces route protection — unauthenticated requests to `/quotes/*` or `/price-list/*` are redirected to `/login`, carrying the original path as a `next` query param.
- **`/auth/callback`** (new route handler): exchanges the magic link's code for a session via `supabase.auth.exchangeCodeForSession`, then redirects to the `next` param if present, otherwise to `/price-list`.
- **Sign-out**: a Server Action calling `supabase.auth.signOut()`, redirecting to `/login`. Exposed as a small header/logout link added to the existing quote pages (no dedicated dashboard/nav exists yet — that's issue #9, not part of this feature).
- **Ownership model**: `quotes`, `quote_line_items`, and `price_list_items` each gain a `user_id uuid not null references auth.users(id) on delete cascade`. `quote_line_items.user_id` is denormalized (copied from its parent quote at insert time) rather than enforced via a subquery join in RLS — cheaper policy checks, minor redundancy accepted as a worthwhile tradeoff.
- **New `/price-list` page** + Server Actions (`createPriceListItem`, `updatePriceListItem`, `deletePriceListItem`): a basic CRUD table. Required because new accounts start with an empty price list (see below) and can't generate any quote without at least one item.
- **`generateQuoteDraft`** (existing Server Action, modified): its price-list read and `quotes`/`quote_line_items` inserts are now implicitly scoped to `auth.uid()` via RLS (the Supabase server client is already session-aware — no manual `.eq("user_id", ...)` filtering needed for reads, though inserts must explicitly set `user_id: user.id`). It also gains an empty-price-list guard (see Error Handling).

## Data model

Migration `supabase/migrations/0003_auth.sql`:

- Add `user_id uuid not null references auth.users(id) on delete cascade` to `quotes`, `quote_line_items`, and `price_list_items`.
- Drop the existing open policies on all three tables (`"... are viewable by everyone"`, `"Anyone can insert/update ..."`).
- Add owner-scoped replacements on all three: `select`/`insert`/`update` gated by `using (auth.uid() = user_id)` (and matching `with check` on insert/update). `price_list_items` gains `insert`/`update`/`delete` policies for the first time — previously read-only and unowned, now each account manages its own.
- `truncate table quote_line_items, quotes, price_list_items` (in that FK-safe order) — existing prototype data (the one QA test quote, the shared seed price list) is wiped. No replacement seed data is inserted; new accounts start with an empty price list.
- The existing "known gap: RLS does not enforce finalized-quote immutability" comments on `quotes`/`quote_line_items` are preserved as-is — unrelated to auth, still accurate, still deferred.

No changes to `quotes`/`quote_line_items`'s status/pricing columns.

## Data flow

**Sign-up/sign-in** (magic link doesn't distinguish new vs. returning users — Supabase creates the account on first verification):
1. Unauthenticated visitor hits a protected route → `middleware.ts` redirects to `/login?next=<original-path>`.
2. On `/login`, enters email → `signInWithOtp`. Supabase emails a magic link.
3. Clicking the link hits `/auth/callback?code=...` → code exchanged for a session, cookies set, redirect to `next` (if present) or `/price-list`.

**Price list management:**
4. `/price-list` lists the signed-in user's own items (empty for a new account). Add/edit/delete via Server Actions; RLS is the actual enforcement — the Server Action code doesn't need manual ownership checks beyond what RLS already guarantees, only input validation (positive integer prices, matching the existing quote line-item validation pattern).

**Quote generation** (existing flow, now scoped):
5. `generateQuoteDraft` reads `price_list_items` (RLS auto-scopes to `auth.uid()`), calls Claude, inserts `quotes`/`quote_line_items` with `user_id: user.id` set explicitly.
6. Empty price list → error returned before calling Claude (see Error Handling).

**Sign-out:**
7. Server Action calls `signOut()`, redirects to `/login`.

## Error handling

- **Empty price list at generation time**: `generateQuoteDraft` checks the fetched price list is non-empty before calling Claude, returning a German error ("Bitte lege zuerst Preislistenpositionen an.") rather than wasting an API call. No link/redirect logic needed beyond the inline message — the user is one click away from `/price-list` regardless.
- **Magic link expired/invalid**: `exchangeCodeForSession` errors are caught in `/auth/callback`, redirecting to `/login` with an inline error ("Link abgelaufen oder ungültig, bitte erneut anfordern.").
- **Middleware session refresh failure**: treated as unauthenticated (redirect to `/login`), not a hard error — matches Supabase's documented middleware pattern.
- **Price list CRUD validation**: same shape as existing quote line-item validation — reject non-positive/non-integer prices server-side, inline error on the offending row.
- **Cross-account access attempts** (guessing another user's quote ID): RLS returns zero rows; the existing `page.tsx`'s `notFound()` handling covers this for free, no new code needed.

## Testing

- Unit tests for the empty-price-list guard in `generateQuoteDraft` (pure logic, no DB/network — following the existing vitest setup).
- Existing `generateLineItems`/`pricing` unit tests are unaffected (no auth/DB dependency).
- Manual end-to-end QA via the browser skill: sign up with a real email (magic link), confirm logged-out visitors get redirected from `/quotes/*` and `/price-list/*` to `/login`, add price list items, generate a quote, then confirm a second test account cannot see the first account's quotes or price list — the core security property this feature exists to deliver.
