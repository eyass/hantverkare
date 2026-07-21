# AI Engineering Harness — Design

**Date:** 2026-07-21
**Status:** Approved
**Project:** `hantverkare` — a home-services / tradesperson marketplace (a Bliqat-style clone). This spec covers **only the harness**, not the app itself.

## Purpose

Set up a repeatable, disciplined workflow ("the harness") that lets a solo builder develop the app in loops with Claude Code, with human gates on risky changes and automated gates on every change. It is a simplified version of a full agent-ops delivery pipeline: scope → build → verify → ship.

The harness is a **workflow + repo scaffold**, not standalone orchestration software. It drives Claude Code through workflow tools already installed in this environment (superpowers + gstack skills), plus GitHub Actions CI, Vercel preview deploys, and Supabase.

## Non-goals (YAGNI)

- No custom agent-orchestration program (no API-driven autonomous loop runner).
- No immutable audit logger, cost governor, or per-pipeline cloud-account isolation (those are the enterprise features of the reference diagram we are deliberately dropping).
- No E2E/Playwright or dependency-vulnerability CI gates in v1 (can be added later).

## Stack

- **App:** Next.js (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- **Backend:** Supabase (Postgres, Auth, Storage, RLS)
- **Hosting:** Vercel (preview deploy per PR, production on `main`)
- **VCS/CI:** GitHub + GitHub Actions

## The Loop (4 phases, 2 human gates)

| Phase | What happens | Backed by |
|---|---|---|
| **① SCOPE** | Brainstorm the change → write a plan → assign a risk tier. **Gate (tier-dependent):** human approves the plan. | `superpowers:brainstorming`, `superpowers:writing-plans` |
| **② BUILD** | Implement on a feature branch, commit atomically, push. CI runs Core gates; Vercel builds a preview. | `superpowers:executing-plans`, GitHub Actions, Vercel |
| **③ VERIFY** | Automated code review + browser QA against the live preview URL. Bounded fix-loop (retry ≤ 3, then escalate to human). | `review` / `superpowers:code-reviewer`, `qa`, optional `codex` |
| **④ SHIP** | Open PR → **Gate (tier-dependent):** human approves PR → merge → verify production → canary watch. | `ship`, `land-and-deploy`, `canary` |

The bounded retry + escalation in ③ is the harness's equivalent of the reference diagram's "Corrective Loop Governor / Kill Switch": cap fix attempts at 3, then hand back to the human rather than looping indefinitely.

## Risk tiers (routing rules)

| Tier | Triggers | Plan gate | PR gate |
|---|---|---|---|
| **T1 — Low** | Copy, styling, static UI, non-schema tweaks | Skip (lightweight note only) | Auto-merge once CI green + preview OK |
| **T2 — Medium** | New features / pages / components; API routes **not** touching auth or payments | Required | Async review — human glances & approves |
| **T3 — High** | Auth, DB schema / migrations, RLS policies, payments, secrets, env/config changes | Required + full plan | Explicit approval + separate deploy approval |

**Decided defaults (overridable):**
- T1 auto-merge is **enabled**.
- Fix-loop retry cap = **3** before escalation.

## Core CI gates (every PR)

Run by `.github/workflows/ci.yml`:
1. **ESLint** — lint
2. **tsc** — type-check
3. **next build** — production build must succeed
4. **gitleaks** — secret scanning

Vercel adds a preview deployment automatically per PR (not a GitHub Action). Browser-based QA in Phase ③ runs against that preview URL, not in CI.

## Repo scaffold

```
hantverkare/
  .harness/
    LOOP.md              # the playbook: phases, gates, retry/escalation rules
    RISK-TIERS.md        # tier definitions + routing
    loop-template.md     # per-loop checklist, copied for each change
  .github/
    workflows/ci.yml     # ESLint · tsc · next build · gitleaks
    pull_request_template.md   # risk-tier field + gate checklist
  app/                   # Next.js App Router
  components/ui/          # shadcn/ui components
  lib/supabase/           # server + browser Supabase clients
  supabase/               # config + migrations (example migration with RLS)
  docs/superpowers/specs/ # this spec + future specs
  CLAUDE.md               # instructs Claude Code to follow .harness/LOOP.md each loop
  .env.example            # NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
  README.md
  package.json, tsconfig.json, tailwind.config, next.config, etc.
```

## Responsibilities: automated vs. manual

**Claude Code does:**
- Scaffold the Next.js + TS + Tailwind + shadcn app.
- Write all `.harness/` docs, `ci.yml`, PR template, `CLAUDE.md`, `README.md`.
- Wire Supabase client code (server + browser) and an example migration with RLS.
- Initialize git and make the initial commit(s).

**Human does (with exact click-by-click instructions from Claude Code):**
- Create the GitHub repo (or authorize the `gh` CLI).
- Create the Supabase project; provide URL + anon key + service-role key.
- Link Vercel to the repo; confirm preview + production deploys.
- Paste the 3 environment variables into Vercel and `.env.local`.

Rationale: account creation, payment, secret entry, and settings changes are actions Claude Code will not perform on the user's behalf. Claude Code verifies each once the human completes it.

## Success criteria

1. Running the loop on a trivial change (T1) results in: branch → CI green → Vercel preview → auto-merge → production, with only awareness (no click) required.
2. Running the loop on a T2/T3 change stops at the correct human gate(s).
3. `.harness/LOOP.md` is self-contained enough that a fresh Claude Code session can execute a full loop by reading it.
4. CI fails the PR on a lint error, type error, build failure, or committed secret.
5. First real feature of the app can be built end-to-end through the loop.
