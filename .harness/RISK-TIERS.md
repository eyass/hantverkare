# Risk Tiers

Assign a tier during SCOPE. It decides which gates apply. When unsure, pick the higher tier.

| Tier | Triggers | Plan gate | PR gate |
|---|---|---|---|
| **T1 — Low** | Copy, styling, static UI, non-schema tweaks | Skip (one-line note) | Auto-merge once CI green + preview OK |
| **T2 — Medium** | New features / pages / components; API routes NOT touching auth or payments | Required | Async review — human glances & approves |
| **T3 — High** | Auth, DB schema/migrations, RLS policies, payments, secrets, env/config | Required + full plan | Explicit approval + separate deploy approval |

## Routing rules
- Any file under `supabase/migrations/` changed → **T3**.
- Any auth, session, or RLS logic → **T3**.
- Any payment / billing code → **T3**.
- New env var or change to `.env.example` / CI secrets → **T3**.
- New page, component, or non-sensitive API route → **T2**.
- Text, Tailwind classes, static assets only → **T1**.

## Defaults (change here if you want different behavior)
- T1 auto-merge: **ON**.
- Fix-loop retry cap: **3**.
- **PR-gate override (in effect until the human says otherwise):** auto-merge T1, T2, and
  T3 alike once CI is green — the "PR gate" column above is currently not enforced at any
  tier. This does NOT affect the plan gate (T2/T3 still require plan approval during
  SCOPE). See `.harness/LOOP.md`'s SHIP phase for the full note. Revert the moment the
  human asks.
- **Migration-apply override (in effect until the human says otherwise):** every
  `supabase/migrations/*.sql` file gets applied directly to the real database via the
  Supabase MCP connection as part of SHIP, not left as a manual step. See
  `.harness/LOOP.md`'s "Migrations: apply directly" note for the full checklist.

## Manual-step issues still apply
The migration-apply override above only covers running the SQL. It does **not** cover other
manual setup a T3 change might still need — third-party account provisioning (Stripe Connect
webhook registration, Google Cloud OAuth consent screen, DNS, real Stripe go-live), or
legal/compliance sign-off (e.g. GoBD/Steuerberater review). Keep filing those as tracked
"manual-step" issues; only close the migration-tracking half once the schema is actually
verified live.
