# Customer-Facing Quote Review + E-Signature — Design Spec

## Context

Closes issue #7: tradespeople need a shareable, unauthenticated link their customer can
open to review a finalized quote and give a lightweight click-to-sign consent, without
creating a customer account. Decisions below made autonomously per the project's
standing full-autonomy override (`.harness/LOOP.md`).

## Decisions made autonomously

- **Share token, not the raw quote UUID.** `quotes.share_token uuid not null default
  gen_random_uuid() unique`. Public route is `/q/[token]`, looked up by `share_token`.
  The authenticated `/quotes/[id]` route is unchanged and still keyed by the real `id`.
- **Public access via a server-only admin (service-role) client**, not broadened RLS.
  RLS on `quotes`/`quote_line_items` stays exactly as shipped in `0003_auth.sql`
  (owner-scoped via `auth.uid()`). A new `lib/supabase/admin.ts` exports
  `createAdminClient()` using `SUPABASE_SERVICE_ROLE_KEY`, used ONLY by `/q/[token]`'s
  page and its `signQuote` Server Action. The unguessable token is the access control,
  not a database policy — deliberately narrower than rewriting RLS to add a public
  by-token `select` policy, which would apply too broadly and be harder to reason about.
- **Status gains a third value: `signed`.** Check constraint updated to `status in
  ('draft', 'final', 'signed')`. Only `final -> signed` is allowed (never `draft ->
  signed`); `signQuote` enforces this with a `.eq("status", "final")` guard in the
  update, mirroring the existing `finalizeQuote` pattern of gating on the current status
  in the `update().eq()` chain rather than a separate check-then-write.
- **Click-to-sign, explicitly NOT a qualified electronic signature.** Customer types
  full name, checks an agreement checkbox, clicks "Verbindlich bestätigen". This is a
  basic consent-and-audit-trail mechanism — no cryptographic signing, no identity
  verification, no eIDAS "qualifizierte elektronische Signatur". UI copy avoids
  "rechtsverbindliche Unterschrift" or similar language implying full legal signature
  weight. New columns `signed_at timestamptz`, `signer_name text`, `signer_ip text`
  (all nullable). IP is captured on a best-effort basis (`x-forwarded-for` header via
  Next.js `headers()`) and never blocks signing if unavailable.
- **Migration file: `supabase/migrations/0006_esignature.sql`** — 0004/0005 reserved for
  other parallel work per the task brief.
- **Tradesperson-side share link**: shown as a read-only `<input readOnly>` on
  `/quotes/[id]` (via `QuoteEditor.tsx`) once `status` is `final` or `signed`. Plain
  input with the full URL as its value — no clipboard API, no "copied!" toast (YAGNI,
  matches the project's existing preference for the simplest working UI).
- **Status label becomes three-way**: "(Entwurf)" / "(final)" / "(signiert)".

## Out of scope

- Any notification (email/SMS) to the tradesperson when a customer signs — a future
  feature, not required to close #7.
- PDF export / download of the signed quote.
- Revoking or regenerating a `share_token`.
- Any legally-binding signature technology (certificates, timestamping authorities,
  identity verification) — explicitly rejected; this is a consent click, not a
  qualified electronic signature.

## Architecture

- `supabase/migrations/0006_esignature.sql` — adds `share_token`, `signed_at`,
  `signer_name`, `signer_ip` to `quotes`; updates the status check constraint.
- `lib/supabase/admin.ts` — service-role client factory, server-only.
- `app/q/[token]/page.tsx` — public server component. Looks up the quote (+ line items)
  by `share_token` via the admin client. `notFound()` on no match. Renders:
  - `status === "final"`: read-only quote + `<SignForm>`.
  - `status === "signed"`: read-only quote + "Signiert am {date} von {signer_name}".
  - `status === "draft"` (defensive; normally unreachable since the tradesperson only
    shares the link after finalizing): "Dieses Angebot ist noch nicht bereit" message.
- `app/q/[token]/SignForm.tsx` — client component: name input, agreement checkbox,
  submit button; calls `signQuote` Server Action, shows German error strings on failure.
- `app/q/[token]/actions.ts` — `signQuote(token, signerName)` Server Action, admin
  client, no auth check (token is the auth). Validates non-empty trimmed name, looks up
  quote by token, updates only if current status is `final`.
- `app/quotes/[id]/page.tsx` — add `share_token` to the `.select(...)` list.
- `app/quotes/[id]/QuoteEditor.tsx` — accept `share_token` in `Quote` type; render share
  link input when `final`/`signed`; three-way status label.

## Data flow

1. Tradesperson finalizes a quote (existing `finalizeQuote` flow, unchanged).
2. `/quotes/[id]` now shows the public URL `{NEXT_PUBLIC_SITE_URL}/q/{share_token}` in a
   read-only input for the tradesperson to copy and send to their customer.
3. Customer opens `/q/[token]` (no login). Server component fetches the quote by token
   via the admin client and renders it read-only, plus the sign form if `final`.
4. Customer fills in name, checks the agreement box, submits. `signQuote` Server Action
   validates via admin client, flips `final -> signed` with `signed_at`/`signer_name`/
   `signer_ip`, and the page re-renders showing the signed confirmation.

## Risk

T3 per `.harness/RISK-TIERS.md` (new public unauthenticated route + service-role client
+ schema/status-machine change). Per the project's standing auto-merge override, no
human plan approval is required, but the migration itself must be applied to the live
Supabase database by a human — this is reported back, not applied by the agent.
