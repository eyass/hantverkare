@AGENTS.md

# hantverkare — Claude Code guide

A home-services / tradesperson marketplace (Bliqat-style clone).

## How we work: the Loop
**Every change follows `.harness/LOOP.md`.** Assign a risk tier from
`.harness/RISK-TIERS.md`, respect the human gates for that tier, and never exceed
the fix-loop retry cap (3 → escalate). Copy `.harness/loop-template.md` per change.

## Stack
- Next.js (App Router) + TypeScript + Tailwind + shadcn/ui
- Supabase (Postgres/Auth/Storage/RLS) — clients in `lib/supabase/`
- Vercel (preview per PR, prod on `main`) · GitHub Actions CI

## Commands
- `npm run dev` — local dev server
- `npm run build` — production build (a Core gate)
- `npm run lint` — ESLint (a Core gate)
- `npm run typecheck` — `tsc --noEmit` (a Core gate)

## Conventions
- Branch names: `feat/…`, `fix/…`, `chore/…`.
- Every Supabase table has RLS enabled (see `supabase/migrations/0001_init.sql`).
- Never commit secrets; `.env.local` is gitignored. Secret scanning runs in CI.
- Any change under `supabase/migrations/`, auth, payments, or env is **T3**.
