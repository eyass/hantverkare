# hantverkare

A home-services / tradesperson marketplace, built in disciplined loops with an
AI engineering harness.

## The harness
Changes flow through a 4-phase loop — **SCOPE → BUILD → VERIFY → SHIP** — with
risk-tiered human gates. See `.harness/LOOP.md` and `.harness/RISK-TIERS.md`.

## Stack
Next.js · TypeScript · Tailwind · shadcn/ui · Supabase · Vercel · GitHub Actions.

## Local setup
1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in Supabase values.
3. `npm run dev` → http://localhost:3000

## Deployment
Vercel builds a preview per PR and deploys `main` to production. See
`docs/superpowers/specs/2026-07-21-ai-engineering-harness-design.md` for the full design.
