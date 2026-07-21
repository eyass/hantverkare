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
