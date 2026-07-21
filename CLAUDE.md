@AGENTS.md

# hantverkare — Claude Code guide

A clone of [Bliqat](https://bliqat.com/) for the German market: an AI-powered quoting
tool for Handwerker (tradespeople) — describe a job, get a priced quote in under a
minute, customer signs, invoice follows. Not a marketplace — no browsing/matching of
providers, it's a solo-operator/small-business admin tool.

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
