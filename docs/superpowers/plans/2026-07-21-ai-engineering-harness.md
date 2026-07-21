# AI Engineering Harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a repeatable build harness for the `hantverkare` app — a Next.js scaffold plus a documented, risk-tiered scope→build→verify→ship loop wired to GitHub Actions, Vercel, and Supabase.

**Architecture:** A workflow + repo scaffold (no custom orchestration program). The `.harness/` directory holds the playbook that drives Claude Code through existing skills; GitHub Actions enforces Core gates on every PR; Vercel provides preview + production deploys; Supabase provides DB/Auth/Storage. Human gates are risk-tiered (T1 auto-merge, T2 async, T3 explicit).

**Tech Stack:** Next.js (App Router) · TypeScript · Tailwind CSS · shadcn/ui · Supabase · Vercel · GitHub Actions (ESLint, tsc, next build, gitleaks).

---

## File Structure

Created by this plan:

- `package.json`, `tsconfig.json`, `next.config.*`, `postcss.config.*`, `app/`, `public/` — Next.js app (from create-next-app)
- `components/ui/` — shadcn/ui components
- `lib/supabase/server.ts`, `lib/supabase/client.ts` — Supabase clients (server + browser)
- `supabase/config.toml`, `supabase/migrations/0001_init.sql` — Supabase config + example migration with RLS
- `.env.example` — required env var names
- `.harness/LOOP.md`, `.harness/RISK-TIERS.md`, `.harness/loop-template.md` — the harness
- `.github/workflows/ci.yml`, `.github/pull_request_template.md` — CI + PR gate
- `CLAUDE.md` — instructs Claude Code to follow the loop
- `README.md` — project + harness overview

Preserved (already in repo): `.git/`, `.gitignore`, `.claude/`, `docs/`.

---

## Task 1: Scaffold the Next.js app

**Files:**
- Create (via generator): `package.json`, `tsconfig.json`, `next.config.ts`, `app/`, `public/`, `eslint.config.mjs`, `postcss.config.mjs`, `package-lock.json`

Scaffold into a temp dir, then copy in (avoids create-next-app's "directory not empty" error and preserves our `docs/`, `.harness/`, `.gitignore`).

- [ ] **Step 1: Generate the app in the scratchpad**

Run:
```bash
SCRATCH="/private/tmp/claude-501/-Users-eyass-Documents-hantverkare/6916cbad-1d30-48d4-bca5-04f4712d4ab1/scratchpad"
rm -rf "$SCRATCH/app-scaffold"
npx --yes create-next-app@latest "$SCRATCH/app-scaffold" \
  --ts --tailwind --eslint --app --no-src-dir \
  --import-alias "@/*" --use-npm --yes
```
Expected: completes with "Success! Created app-scaffold". If it prompts about Turbopack, accept the default.

- [ ] **Step 2: Copy app files into the repo root (excluding .git, .gitignore, README)**

Run:
```bash
SCRATCH="/private/tmp/claude-501/-Users-eyass-Documents-hantverkare/6916cbad-1d30-48d4-bca5-04f4712d4ab1/scratchpad"
rsync -a \
  --exclude='.git' --exclude='.gitignore' --exclude='README.md' \
  "$SCRATCH/app-scaffold/" /Users/eyass/Documents/hantverkare/
```
Expected: no errors. `package.json`, `app/`, `next.config.ts` now exist in the repo root.

- [ ] **Step 3: Install dependencies**

Run: `cd /Users/eyass/Documents/hantverkare && npm install`
Expected: completes, `node_modules/` present (already gitignored).

- [ ] **Step 4: Verify the build passes**

Run: `npm run build`
Expected: "Compiled successfully" / build completes with exit code 0.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js app (TS, Tailwind, App Router, ESLint)"
```

---

## Task 2: Add shadcn/ui

**Files:**
- Create: `components.json`, `components/ui/button.tsx`, `lib/utils.ts` (generated)

- [ ] **Step 1: Initialize shadcn with defaults**

Run: `cd /Users/eyass/Documents/hantverkare && npx --yes shadcn@latest init -d`
Expected: creates `components.json` and `lib/utils.ts`. If it asks about overwriting the global CSS or base color, accept defaults (neutral).

- [ ] **Step 2: Add one component to prove wiring works**

Run: `npx --yes shadcn@latest add button`
Expected: creates `components/ui/button.tsx`.

- [ ] **Step 3: Verify build still passes**

Run: `npm run build`
Expected: build succeeds, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat: add shadcn/ui with button component"
```

---

## Task 3: Add a typecheck script

**Files:**
- Modify: `package.json` (scripts block)

- [ ] **Step 1: Add the typecheck script**

In `package.json`, add to `"scripts"`:
```json
"typecheck": "tsc --noEmit"
```

- [ ] **Step 2: Verify it passes**

Run: `npm run typecheck`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "chore: add typecheck script"
```

---

## Task 4: Supabase client wiring + example migration

**Files:**
- Create: `lib/supabase/server.ts`, `lib/supabase/client.ts`, `.env.example`, `supabase/migrations/0001_init.sql`

- [ ] **Step 1: Install the Supabase SSR package**

Run: `cd /Users/eyass/Documents/hantverkare && npm install @supabase/supabase-js @supabase/ssr`
Expected: added to `dependencies`.

- [ ] **Step 2: Create the browser client**

Create `lib/supabase/client.ts`:
```ts
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 3: Create the server client**

Create `lib/supabase/server.ts`:
```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // called from a Server Component — safe to ignore when middleware refreshes sessions
          }
        },
      },
    },
  );
}
```

- [ ] **Step 4: Create `.env.example`**

Create `.env.example`:
```
# Supabase — from Project Settings → API
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
# Server-only. NEVER expose to the client. From Project Settings → API → service_role
SUPABASE_SERVICE_ROLE_KEY=
```

- [ ] **Step 5: Create an example migration with RLS**

Create `supabase/migrations/0001_init.sql`:
```sql
-- Example table demonstrating the RLS pattern every table should follow.
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Profiles are viewable by everyone"
  on public.profiles for select
  using (true);

create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update
  using (auth.uid() = id);
```

- [ ] **Step 6: Verify build + typecheck (with dummy env so client modules resolve)**

Run:
```bash
NEXT_PUBLIC_SUPABASE_URL="https://example.supabase.co" \
NEXT_PUBLIC_SUPABASE_ANON_KEY="dummy" \
npm run build && npm run typecheck
```
Expected: both succeed, exit code 0.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: wire Supabase clients, env example, and example RLS migration"
```

---

## Task 5: Write the harness docs

**Files:**
- Create: `.harness/LOOP.md`, `.harness/RISK-TIERS.md`, `.harness/loop-template.md`

- [ ] **Step 1: Create `.harness/LOOP.md`**

Create `.harness/LOOP.md`:
```markdown
# The Loop — Build Harness for hantverkare

Every change follows this loop. A fresh Claude Code session should be able to run a
full loop by reading this file plus `RISK-TIERS.md`.

Phases: ① SCOPE → ② BUILD → ③ VERIFY → ④ SHIP. Two human gates, both risk-tiered.

## ① SCOPE
1. For anything non-trivial, brainstorm the change (skill: `superpowers:brainstorming`).
2. Assign a risk tier using `RISK-TIERS.md`.
3. For T2/T3, write a plan (skill: `superpowers:writing-plans`).
4. **GATE (T2/T3 only):** present the plan and wait for the human's approval before coding.

## ② BUILD
1. Create a feature branch: `git checkout -b <type>/<slug>` (type = feat|fix|chore).
2. Implement in small, atomic commits.
3. Push: `git push -u origin HEAD`.
4. CI runs the Core gates (lint · typecheck · build · secret scan). Vercel builds a preview.
5. If CI is red: fix and repush. Each red→fix cycle counts toward the retry cap (see below).

## ③ VERIFY
1. Run automated review on the diff (skill: `review`, or `superpowers:code-reviewer`).
2. Run browser QA against the Vercel preview URL (skill: `qa`).
3. Optionally get a second opinion (skill: `codex`) for T3 changes.
4. Fix what's found. **Retry cap = 3 fix cycles.** On the 4th failure, STOP and escalate:
   summarize what failed and hand back to the human.

## ④ SHIP
1. Open a PR (skill: `ship`). The PR body must state the risk tier and check the gate list.
2. **GATE (tiered):**
   - **T1:** auto-merge once CI is green and the preview looks right.
   - **T2:** human async review + approve.
   - **T3:** explicit human approval, plus a separate deploy approval.
3. Merge and verify production (skill: `land-and-deploy`).
4. Watch the deploy (skill: `canary`) for console errors / regressions.

## Retry & escalation (the kill switch)
- Fix-loop retry cap: **3**. On the 4th failure, stop and escalate to the human.
- Escalation = stop work, write a short summary of what failed and what was tried.

## When in doubt
If a change touches something not clearly covered by a tier, treat it as **T3**.
```

- [ ] **Step 2: Create `.harness/RISK-TIERS.md`**

Create `.harness/RISK-TIERS.md`:
```markdown
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
```

- [ ] **Step 3: Create `.harness/loop-template.md`**

Create `.harness/loop-template.md`:
```markdown
# Loop: <short title>

- **Risk tier:** T?  (see RISK-TIERS.md)
- **Branch:** <type>/<slug>
- **Preview URL:** <filled after first push>

## ① SCOPE
- [ ] Brainstormed (if non-trivial)
- [ ] Tier assigned
- [ ] Plan written (T2/T3)
- [ ] Plan approved by human (T2/T3)

## ② BUILD
- [ ] Feature branch created
- [ ] Implemented in atomic commits
- [ ] Pushed; CI green; preview built

## ③ VERIFY
- [ ] Automated review run
- [ ] Browser QA against preview
- [ ] Issues fixed (retry count: _/3)

## ④ SHIP
- [ ] PR opened with tier + gate checklist
- [ ] PR gate satisfied for tier
- [ ] Merged + production verified
- [ ] Canary watch done
```

- [ ] **Step 4: Commit**

```bash
git add .harness
git commit -m "docs: add the build harness (LOOP, RISK-TIERS, loop-template)"
```

---

## Task 6: GitHub Actions CI + PR template

**Files:**
- Create: `.github/workflows/ci.yml`, `.github/pull_request_template.md`

- [ ] **Step 1: Create the CI workflow**

Create `.github/workflows/ci.yml`:
```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  quality:
    name: Lint · Typecheck · Build
    runs-on: ubuntu-latest
    env:
      NEXT_PUBLIC_SUPABASE_URL: https://example.supabase.co
      NEXT_PUBLIC_SUPABASE_ANON_KEY: dummy-anon-key-for-ci-build
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run build

  secret-scan:
    name: Secret scan (gitleaks)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

- [ ] **Step 2: Create the PR template**

Create `.github/pull_request_template.md`:
```markdown
## What & why

<!-- one or two sentences -->

## Risk tier

- [ ] T1 — Low (copy/styling/static UI)
- [ ] T2 — Medium (feature/page/component/non-sensitive API)
- [ ] T3 — High (auth / schema / RLS / payments / secrets / env)

## Gate checklist

- [ ] SCOPE: tier assigned; plan approved (T2/T3)
- [ ] BUILD: CI green; preview built
- [ ] VERIFY: automated review + browser QA done
- [ ] SHIP: tier's PR gate satisfied
```

- [ ] **Step 3: Validate the workflow YAML parses**

Run: `node -e "const fs=require('fs');const s=fs.readFileSync('.github/workflows/ci.yml','utf8');if(!s.includes('jobs:'))process.exit(1);console.log('ci.yml present and has jobs')"`
Expected: prints "ci.yml present and has jobs".

- [ ] **Step 4: Commit**

```bash
git add .github
git commit -m "ci: add Core gates workflow (lint, typecheck, build, gitleaks) + PR template"
```

---

## Task 7: CLAUDE.md + README

**Files:**
- Create: `CLAUDE.md`, `README.md`

- [ ] **Step 1: Create `CLAUDE.md`**

Create `CLAUDE.md`:
```markdown
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
```

- [ ] **Step 2: Create `README.md`**

Create `README.md`:
```markdown
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
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md README.md
git commit -m "docs: add CLAUDE.md guide and README"
```

---

## Task 8: Verify the Core gates actually catch problems

Proves success criterion #4 (CI fails on type error / secret). We test the gate commands locally, since CI runs the same commands.

- [ ] **Step 1: Prove the typecheck gate fails on a type error**

Create a temp file `app/__gatecheck.ts` with:
```ts
const n: number = "this is not a number";
export default n;
```
Run: `npm run typecheck`
Expected: FAILS with a TS2322 type error mentioning `__gatecheck.ts`.

- [ ] **Step 2: Remove the temp file and confirm typecheck passes**

Run: `rm app/__gatecheck.ts && npm run typecheck`
Expected: PASSES, exit code 0. (Do not commit the temp file.)

- [ ] **Step 3: Prove the secret-scan gate would fire (local gitleaks check, if installed)**

Run:
```bash
if command -v gitleaks >/dev/null; then
  printf 'aws_secret_access_key = "AKIAIOSFODNN7EXAMPLE1234567890abcdEXAMPLEKEY"\n' > /tmp/leak.txt
  gitleaks detect --no-git --source /tmp/leak.txt && echo "UNEXPECTED: no leak found" || echo "OK: gitleaks flags secrets"
  rm -f /tmp/leak.txt
else
  echo "gitleaks not installed locally — the CI job (gitleaks-action) covers this gate"
fi
```
Expected: either "OK: gitleaks flags secrets" or the not-installed note. No commit.

- [ ] **Step 4: Confirm the tree is clean**

Run: `git status -s`
Expected: empty (no leftover gatecheck/leak files).

---

## Task 9: Human infra wiring (guided, verified)

These steps require the human (account creation, secret entry, settings). Claude Code
provides exact instructions and verifies each result. **Do not attempt to perform
these on the human's behalf.**

- [ ] **Step 1: Create the GitHub repo and push**

Ask the human to either authorize the `gh` CLI (`gh auth login`) or create an empty
repo named `hantverkare` at https://github.com/new (no README/gitignore/license).

If `gh` is available and authorized, run:
```bash
gh repo create hantverkare --private --source=. --remote=origin --push
```
Otherwise, after the human creates the empty repo, run:
```bash
git remote add origin https://github.com/<user>/hantverkare.git
git push -u origin main
```
Verify: `git ls-remote origin` lists `refs/heads/main`.

- [ ] **Step 2: Enable branch protection on `main`**

Ask the human to set, in GitHub → Settings → Branches → Add rule for `main`:
require a PR before merging, and require the status checks `Lint · Typecheck · Build`
and `Secret scan (gitleaks)` to pass. (These names appear after the first CI run.)
Verify: open a throwaway branch + PR and confirm the checks are listed as required.

- [ ] **Step 3: Create the Supabase project**

Ask the human to create a project at https://supabase.com/dashboard, then copy from
Project Settings → API: the Project URL, the `anon` public key, and the `service_role`
key. The human pastes these into a local `.env.local` (copied from `.env.example`).
Verify: `npm run dev` starts and the app loads at http://localhost:3000 without
Supabase env errors.

- [ ] **Step 4: Apply the example migration**

Ask the human to run the SQL in `supabase/migrations/0001_init.sql` via the Supabase
SQL editor (or `supabase db push` if they install the Supabase CLI and run
`supabase link`).
Verify: the `profiles` table exists with RLS enabled (Supabase → Table editor).

- [ ] **Step 5: Link Vercel**

Ask the human to import the GitHub repo at https://vercel.com/new, and add the three
env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
`SUPABASE_SERVICE_ROLE_KEY`) in Vercel → Project → Settings → Environment Variables
for Production, Preview, and Development.
Verify: the first production deploy succeeds and the app loads at the Vercel URL.

- [ ] **Step 6: End-to-end loop smoke test (success criterion #1 & #2)**

Run one trivial T1 change through the full loop (e.g. edit copy on the home page):
branch → push → CI green → Vercel preview → PR → auto-merge → production. Confirm the
T1 change required no plan gate and auto-merged. Then confirm a change under
`supabase/migrations/` is correctly flagged **T3** and stops at the plan gate.
Verify: both behaviors observed; note the results in the loop template.

---

## Notes on adapting during execution

- `create-next-app` and `shadcn` occasionally change prompts/flags between versions. If a
  flag is rejected, drop to the interactive prompt and choose: TypeScript **yes**, Tailwind
  **yes**, App Router **yes**, `src/` dir **no**, import alias `@/*`, ESLint **yes**.
- If Next's generated `.gitignore` was skipped by the rsync exclude, confirm our root
  `.gitignore` still ignores `.next/`, `node_modules/`, and `.env*.local` (it does).
