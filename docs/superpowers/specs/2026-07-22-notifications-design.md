# Email Notification on Quote Signed — Design Spec

## Context

Closes issue #17: notify the tradesperson by email when a customer signs their quote.
Decisions below made autonomously per the project's standing full-autonomy override
(`.harness/LOOP.md`).

## Decisions made autonomously

- **Scope: signed-only, not "viewed".** The original backlog issue mentioned both
  "viewed" and "signed" events. "Viewed" would require a side-effecting mutation during
  a page render (`app/q/[token]/page.tsx` is a Server Component render, not an action),
  which is an anti-pattern in Next.js and would double-fire on every reload without
  careful once-only tracking/dedup. Signed-only is a clean, single, natural event
  already gated by an atomic status transition (`status = 'final' -> 'signed'`) in
  `signQuote`. This spec explicitly narrows scope to signed-only.
- **Provider: Resend**, called via plain `fetch` POST to `https://api.resend.com/emails`
  with an API key, no SDK. Matches this codebase's existing pattern of calling external
  APIs via raw `fetch` (see `transcribeAudio`'s Whisper call in
  `app/quotes/new/actions.ts`) rather than always reaching for an SDK (contrast
  `generateLineItems`, which does use the Anthropic SDK). New env var: `RESEND_API_KEY`.
- **No new schema/migration.** `signed_at` / `signer_name` already exist on `quotes`
  from the e-signature migration. The notification is a pure side effect of `signQuote`
  succeeding, not a new stored fact. `quotes.user_id` already exists from the auth
  migration, so no schema change is needed to know who owns the quote.
- **Recipient: the tradesperson's own account email.** After a successful sign, look up
  the quote's `user_id` (and `customer_description` for the email body), then call the
  admin client's `auth.admin.getUserById(user_id)` to get the owner's email. This reuses
  the existing `createAdminClient()` (already used in this file) rather than adding a
  new client.
- **Failure handling: never blocks the sign flow.** If email lookup or send fails for
  any reason (missing/invalid `RESEND_API_KEY`, network error, Resend API error, no user
  found), it is caught, `console.error`-logged, and `signQuote` still returns
  `{ error: null }` to the customer. Sending the notification is a nice-to-have, not a
  core-flow blocker. The email side effect is fired only after the DB update already
  succeeded, and is wrapped in its own try/catch so it cannot throw into the caller.
- **Email content**: plain and simple. Subject "Ihr Angebot wurde signiert". Body
  includes the signer's name, a short snippet of `customer_description`, and a link to
  `/quotes/{quote_id}` built from `process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"`
  (same fallback pattern as `app/login/actions.ts`).
- **New file**: `lib/notifications/sendSignedEmail.ts` exporting
  `sendSignedNotification({ toEmail, signerName, quoteDescription, quoteId }): Promise<void>`.
  It never throws — all failure paths are caught internally and logged.
- **Risk tier: T3** (new env var / secret, per `.harness/RISK-TIERS.md`: "New env var...
  → T3"). Per the standing override this does not block auto-merge but is noted in the
  PR body. A human must supply a real `RESEND_API_KEY` (the agent cannot obtain one) —
  this is reported to the controller for the manual-steps tracker; `docs/MANUAL-STEPS-PENDING.md`
  is not edited directly by this task.

## Out of scope

- "Viewed" notifications (see reasoning above).
- Any UI to configure notification preferences.
- Retrying failed sends, or a queue/outbox table.
- Changes to `app/quotes/[id]/*`, `app/customers/*`, `app/price-list/*`,
  `app/settings/*`, `app/layout.tsx`, `app/quotes/new/*`, `lib/supabase/admin.ts`.

## Architecture

- `lib/notifications/sendSignedEmail.ts` — `sendSignedNotification(...)`, plain `fetch`
  POST to Resend, catches and logs all failures, returns `Promise<void>`.
- `app/q/[token]/actions.ts` — `signQuote` selects `user_id, customer_description` in
  addition to `id` on the update, then (after the update succeeds) looks up the owner's
  email via `supabase.auth.admin.getUserById(user_id)` and calls
  `sendSignedNotification`, all inside a try/catch that only logs on failure.
- `.env.example` — adds `RESEND_API_KEY=` with a comment.
- `.github/workflows/ci.yml` — adds `RESEND_API_KEY: dummy-key-for-ci` to the `quality`
  job env block (build/typecheck don't call Resend, but keeps parity with other keys and
  guards against future code that reads it at module scope).

## Data flow

1. Customer submits the sign form on `/q/[token]`, calling `signQuote(token, signerName)`.
2. `signQuote` validates the name, then performs the atomic `UPDATE ... WHERE
   share_token = ? AND status = 'final'` as before — this is unchanged and remains the
   sole gate on success/failure returned to the customer.
3. If the update affected zero rows, return the existing error as before — no email
   attempted.
4. If it succeeded, in a separate try/catch: fetch `user_id` for the signed quote
   (already returned by the `.select()`), call `auth.admin.getUserById(user_id)`, and
   call `sendSignedNotification` with the owner's email, signer name, description
   snippet, and quote id.
5. Any error in step 4 is logged via `console.error` and swallowed. `signQuote` returns
   `{ error: null }` regardless.

## Error handling

- Update fails / zero rows: unchanged existing behavior, error returned to customer.
- Owner lookup fails (no user, `getUserById` error): logged, no email sent, sign still
  succeeds.
- Resend API call fails (bad key, network, non-2xx): logged inside
  `sendSignedNotification`, no exception propagates, sign still succeeds.
- Missing `RESEND_API_KEY`: `sendSignedNotification` checks for it up front, logs, and
  returns without attempting the fetch.
