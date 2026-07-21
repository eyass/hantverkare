# Business Settings Page — Design Spec

## Context

Closes [issue #11](https://github.com/eyass/hantverkare/issues/11): the tradesperson has
no place to enter their business info (company name, address, VAT ID). This data will be
used later for quote/invoice branding (a future feature, not part of this task). Decisions
below made autonomously per the project's standing full-autonomy override.

## Decisions made autonomously

- **One `business_settings` row per user (not per-quote), upserted.** Business info
  doesn't vary per quote, so a single row scoped by `user_id` (also the primary key)
  matches the account, not a list of records like price list items.
- **Fields**: `company_name text`, `address text`, `vat_id text` (USt-IdNr),
  `tax_number text` (Steuernummer). All nullable — a business might not have all of
  these on hand yet (e.g. VAT ID pending registration), so no NOT NULL constraints
  beyond the primary key/user_id.
- **No logo upload.** Supabase Storage setup is out of scope — YAGNI for a first
  version. No logo field at all, not even a URL, to keep this table lean and avoid
  a half-finished column with no writer.
- **Migration file: `supabase/migrations/0004_business_settings.sql`** — this exact
  number, reserved to avoid colliding with parallel work using 0005/0006.
- **Primary key = `user_id` directly** (not a separate `id` + unique constraint on
  `user_id`). Since it's a strict one-row-per-user table, `user_id uuid primary key
  references auth.users(id)` is simpler than the `id`+FK+unique pattern other tables
  use, and it makes the upsert target unambiguous (`on conflict (user_id)`).
- **RLS**: standard owner-scoped select/insert/update policies (`auth.uid() = user_id`),
  matching `0003_auth.sql`'s style exactly (policy names, comment style). No delete
  policy — there's no user-facing "delete my business settings" action in this task;
  can be added later if needed (YAGNI).
- **Route: `/settings`** (not `/business-settings`) — kept short since there's only one
  settings concept in the app right now.
- **Form pattern**: a normal controlled form with a single "Speichern" submit button,
  not price list's inline save-on-blur pattern — this is a single record, not a list of
  independently-editable rows, so blur-per-field would just be more code for no benefit.
- **Server Action**: single `saveBusinessSettings` upsert action (insert if no row
  exists for this user, else update), returning the same discriminated-union
  `{error: string} | {error: null}` shape as price-list's `ActionResult`.
- **Risk tier: T3** — new file under `supabase/migrations/`, per `RISK-TIERS.md`'s
  routing rule ("Any file under `supabase/migrations/` changed → T3"), even though the
  table itself is low-risk (no auth/payments logic beyond the standard owner-scoped
  RLS pattern already used elsewhere).

## Out of scope

- Logo upload / Supabase Storage (YAGNI, no writer for it yet).
- Quote/invoice branding UI that consumes this data (future feature, tracked separately).
- Deleting the settings row (no delete policy, no delete action/button).
- Validation beyond "not required" — e.g. no VAT ID format checking, since Handwerker
  in different legal forms (Kleinunternehmer, etc.) may legitimately have empty fields.

## Architecture

- `supabase/migrations/0004_business_settings.sql` — `business_settings` table +
  owner-scoped RLS policies.
- `app/settings/actions.ts` — `saveBusinessSettings` Server Action performing the
  upsert.
- `app/settings/page.tsx` — server component, fetches the signed-in user's existing
  row (or `null` if none exists yet).
- `app/settings/SettingsForm.tsx` — client component, controlled form with a
  "Speichern" button, mirroring the input styling used in `PriceListEditor.tsx`.

## Data flow

1. Signed-in user visits `/settings`.
2. Server component queries `business_settings` for the current row (RLS-scoped,
   `.maybeSingle()` since a fresh account has no row yet).
3. `SettingsForm` renders the (possibly empty) fields in a controlled form.
4. On submit, `saveBusinessSettings` upserts the row (`on conflict (user_id) do
   update`) with the current user's `user_id`.
5. Success clears any prior error and shows a brief "Gespeichert." confirmation;
   failure shows a German error message and leaves the form values as typed (no
   revert-to-last-saved, since unlike price list rows a failed save doesn't corrupt a
   list — the user just retries the same form).

## Error handling

- Query failure on load: log server-side (`console.error`), render the form with all
  fields empty rather than crashing (matches the tolerant-empty-state pattern in
  `app/price-list/page.tsx`).
- Not signed in: action returns `{ error: "Bitte melde dich an." }`, matching
  price-list's convention.
- Upsert failure: log server-side, return
  `{ error: "Einstellungen konnten nicht gespeichert werden." }`.

## Testing

- No pure logic worth a unit test (a straight upsert + render, no numeric
  parsing/validation like price list's cents conversion).
- Manual QA: visit `/settings` with no existing row (fields empty, save creates a row),
  then revisit and edit (save updates the same row, doesn't create a duplicate).
