# Plan: Multilanguage support for the authenticated app (issue #116)

Risk tier: **T3** (adds a `supabase/migrations/` file). Per the standing
full-autonomy override, SCOPE-phase plan approval and SHIP-phase auto-merge
are both suspended for this change — proceed straight through to a pushed PR
without merging it (a T3 DB migration needs a human to apply it against the
real Supabase project first).

Design spec: `docs/superpowers/specs/2026-07-22-app-multilanguage-design.md`.

No new tests are added: `vitest` (`npm run test`) exists but this repo has no
component/page-level UI-copy test coverage today (marketing i18n included).
Verification is the Core gates (lint/typecheck/build) plus manual browser
spot-checks, matching the design spec's Testing section.

## Task 1 — DB migration: `profiles.language`

File: `supabase/migrations/0020_profile_language.sql`

```sql
-- Per-user UI language preference for the authenticated app (issue #116).
-- Personal viewing preference, not organization data -- two members of the
-- same org may prefer different languages -- so this lives on `profiles`,
-- not `organizations`/`business_settings`. Default 'de' preserves current
-- behavior exactly for all existing rows (no backfill needed).
alter table public.profiles
  add column language text not null default 'de'
    check (language in ('de', 'en'));
```

## Task 2 — `lib/i18n/` shared module

- `lib/i18n/dictionary.ts` — `AppLanguage`, `Dictionary<T>`, `isAppLanguage`,
  `DEFAULT_APP_LANGUAGE`.
- `lib/i18n/getUserLanguage.ts` — server helper reading `profiles.language`
  for the authenticated user, fail-open to `'de'`.
- `lib/i18n/AppLanguageProvider.tsx` — client Context (`AppLanguageProvider`,
  `useAppLanguage`), seeded with a server-known `initialLanguage` (no
  flash-of-wrong-language, unlike marketing's localStorage approach).

## Task 3 — Wire into `app/(app)/layout.tsx`

Fetch `initialLanguage = await getUserLanguage(supabase)` and wrap the
`<AppShell>` return in `<AppLanguageProvider initialLanguage={initialLanguage}>`.

## Task 4 — Translate `AppShell` nav

`components/AppShell.dictionary.ts` + `useAppLanguage()` in `AppShell.tsx`
for nav labels and "Abmelden".

## Task 5 — Settings language selector

- `app/(app)/settings/actions.ts`: `updateLanguage(next)` server action,
  validated via `isAppLanguage`, updates own `profiles` row (RLS-scoped).
- `app/(app)/settings/page.tsx`: fetch current language, pass to form.
- `SettingsForm.tsx`: DE/EN select calling `updateLanguage`, then
  `router.refresh()`.
- `app/(app)/settings/settings.dictionary.ts`: colocated copy.

## Task 6 — Colocated dictionaries per section

`quotes`, `customers`, `price-list`, `quote-templates`, `billing`, `reports`:
each gets `<section>.dictionary.ts`; page Server Components call
`getUserLanguage(supabase)` and pass translated strings as props to their
client editors. Generated quote/invoice document content stays German-only
(out of scope).

## Task 7 — Core gates + PR

`npm run lint` / `npm run typecheck` / `npm run build` (fix-cycle cap 3).
Small atomic commits per task. Push branch, open PR noting T3 + manual
migration-apply step. Do not merge.
