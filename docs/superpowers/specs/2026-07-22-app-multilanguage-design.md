# Design: Multilanguage support for the authenticated app (issue #116)

## Context

The marketing site (logged-out pages) already supports DE/EN via a custom
`dictionary.ts` + `LanguageProvider` React Context pattern
(`components/marketing/site/`), toggled client-side and persisted to
`localStorage`. It explicitly documents that the authenticated app
(`app/(app)/**`: customers, quotes, quote-templates, price-list, billing,
reports, settings) is German-only today, with no shared i18n infra and no
persisted language preference anywhere (no `language`/`locale` column on
`profiles` or `organizations`).

Issue #116 asks to extend multilanguage support into the logged-in app.

## Decisions (made autonomously, per standing override)

1. **Scope of translation**: translate all `app/(app)/**` pages and their
   components (customers, quotes, quote-templates, price-list, billing,
   reports, settings, plus the shared `AppShell`/nav). Generated quote/invoice
   *content itself* (line items, AI-generated descriptions) is out of scope —
   this is about UI chrome/labels, not customer-facing document language,
   which is a separate, larger product decision not raised by this issue.
2. **Preference storage**: per-user, not per-organization. UI language is a
   personal viewing preference (two people in the same org may prefer
   different languages), unlike business data. Add `language text not null
   default 'de' check (language in ('de','en'))` to `public.profiles`. This
   touches `supabase/migrations/`, so **this bumps the whole change to T3**
   per `CLAUDE.md`.
3. **Mechanism**: generalize the existing marketing pattern rather than
   adopting a new library (`next-intl` etc.) — keeps the change additive and
   consistent with established repo conventions, avoids a heavy dependency
   for two languages.
   - New shared module `lib/i18n/` with a generic `createDictionary`-style
     type helper (`Dictionary<T>` keyed by `"de" | "en"`) and an
     `AppLanguageProvider` (client Context), mounted in `app/(app)/layout.tsx`
     inside `AuthenticatedLayout`, initialized from the signed-in user's
     `profiles.language` (fetched server-side alongside the existing
     auth/AAL/billing checks, passed down as an initial value — no
     flash-of-wrong-language on first paint, unlike marketing's
     localStorage/`useEffect` approach, since this is server-known once
     authenticated).
   - Each `app/(app)/**` route/section gets its own colocated
     `dictionary.ts` (mirrors the marketing pattern, keeps translation
     strings near the components using them rather than one giant file).
4. **Where to change it**: `/settings` gets a new "Sprache / Language"
   selector (a simple `<select>` or segmented control, DE/EN) that calls a
   server action updating `profiles.language`, then triggers a router
   refresh so server components re-render with the new language immediately
   (no full page reload required beyond Next's own refresh).
5. **Fallback/default**: unset or unrecognized values default to `de`,
   matching current behavior exactly — existing users see zero change until
   they explicitly opt into English.

## Architecture

```
profiles.language (db, default 'de')
        │
        ▼
AuthenticatedLayout (server) — reads profile, passes initialLanguage
        │
        ▼
AppLanguageProvider (client context, lib/i18n/)
        │
        ├── useAppLanguage() hook — consumed by client components
        └── each app/(app)/<section>/dictionary.ts — DE/EN strings for that section
```

- Server components that render translated text read the language via a
  small server-side helper (read `profiles.language` directly, since RSC
  can't use the client Context) — pass strings/dictionary down as props to
  children, same as the section already fetches other per-request data.
- Client components (forms, interactive widgets) use `useAppLanguage()` from
  the Context for immediate re-render on toggle without a full page reload.

## Data flow / error handling

- Migration `NNNN_profile_language.sql`: adds the column with a safe default,
  no backfill needed (default applies to existing rows automatically).
- Language-select server action: validates the value is `'de' | 'en'`
  server-side before writing (reject anything else, same validation
  discipline as other settings actions in this repo) — RLS already scopes
  `profiles` updates to `auth.uid() = id` per existing policies.
- If the fetch of `profiles.language` fails for any reason, default to
  `'de'` rather than blocking the page (fail open, matches existing
  German-only behavior).

## Testing

- Unit/component tests aren't heavily used elsewhere in this repo for UI
  copy; rely on `npm run typecheck`/`npm run lint`/`npm run build` (Core
  gates) plus browser QA per `.harness/LOOP.md` VERIFY phase: toggle the
  setting, spot-check each translated section renders correctly in both
  languages, confirm RLS still restricts the update to the owning user.

## Risk tier

**T3** — the migration adding `profiles.language` triggers CLAUDE.md's
"any change under `supabase/migrations/` ... is T3" rule, even though the
column itself is low-risk (additive, defaulted, RLS-covered by existing
policy). Per the standing full-autonomy override, the SCOPE-phase plan
approval gate is suspended; SHIP-phase auto-merges once CI is green.
