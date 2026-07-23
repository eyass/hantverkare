# The Loop — Build Harness for hantverkare

Every change follows this loop. A fresh Claude Code session should be able to run a
full loop by reading this file plus `RISK-TIERS.md`.

Phases: ① SCOPE → ② BUILD → ③ VERIFY → ④ SHIP. Two human gates, both risk-tiered.

## ① SCOPE
1. For anything non-trivial, brainstorm the change (skill: `superpowers:brainstorming`), but
   **standing override (in effect until the human says otherwise): make every design/scope
   decision autonomously.** Don't use clarifying questions or an approval prompt — pick the
   most sensible default at each decision point, write the reasoning into the spec as you
   would a clarifying-question answer, and move straight to writing the plan. This applies
   to every choice during BUILD/VERIFY/SHIP too (execution mode, finishing option, merge —
   all already defaulted elsewhere in this file). The only things that still require the
   human's explicit go-ahead are the categories that can never be delegated regardless of
   this override: entering financial/account credentials, executing a real financial
   transaction or purchase, permanently deleting data, and anything else in the assistant's
   own hard-coded "prohibited" and "explicit permission required" action categories (sending
   messages/publishing on the human's behalf, changing external account settings, etc. —
   those still get a quick heads-up even under this override, per the assistant's own rules).
2. Assign a risk tier using `RISK-TIERS.md`.
3. For T2/T3, write a plan (skill: `superpowers:writing-plans`).
4. **GATE (T2/T3 only) — suspended under the standing override above.** As originally
   designed: present the plan and wait for the human's approval before coding. Revert the
   moment the human asks.

## ② BUILD
1. Before touching anything, confirm the working directory is on the branch you think it's on
   (`git branch --show-current` + `git status --short`) — a prior session's agent or worktree
   cleanup can leave the main checkout on a stray branch. Fix before proceeding, never force
   past unexplained local state without checking `git status` first.
2. Create a feature branch: `git checkout -b <type>/<slug>` (type = feat|fix|chore).
3. Execute the plan with **`superpowers:subagent-driven-development`** by default — don't ask which execution mode to use. Only fall back to `superpowers:executing-plans` if the human explicitly asks for a parallel/separate session instead.
4. Implement in small, atomic commits.
5. Push: `git push -u origin HEAD`.
6. CI runs the Core gates (lint · typecheck · build · secret scan). Vercel builds a preview.
7. If CI is red: fix and repush. Each red→fix cycle counts toward the retry cap (see below).

### Dispatching background/parallel subagents
When work is fanned out to multiple background subagents (e.g. `isolation: "worktree"`):
1. **Pre-assign sequential migration numbers** before dispatch if more than one agent may touch
   `supabase/migrations/` — tell each agent its exact filename up front. This avoids numbering
   collisions; it does not prevent unrelated same-directory add/add conflicts (see below), which
   still need manual resolution.
2. **Bake an explicit anti-pattern warning into every dispatch prompt**: the agent must do real
   work — create a branch, write real code, commit, push, open a real PR — and its final report
   must include a real, verifiable PR URL. A prior recurring failure mode was agents reporting
   "done" while only describing a plan, with no branch/commit/PR ever created.
3. **Never trust a subagent's completion report at face value.** After every "done" notification,
   independently verify with `gh pr view <url>` (or `git worktree list` / `gh pr list`) before
   telling the human anything succeeded. A report describing work is not evidence the work
   happened.
4. **When two parallel PRs touch overlapping files**, expect real merge conflicts on the later
   one once the first merges — this is normal, not a sign either agent did something wrong.
   Rebase the later branch onto the updated `main` in its own worktree, resolve conflicts by
   combining both features (never by discarding one side's work), re-run the full gate suite
   (lint · typecheck · test · build) after resolving, then `git push --force-with-lease` before
   re-merging. For a genuinely tangled multi-file merge, delegate the resolution itself to a
   fresh agent with full context on both features rather than hand-resolving truncated diffs.
5. After merging, clean up: remove the worktree (`git worktree remove <path> --force`) and
   delete both the remote-tracking and any local isolation branch, then confirm the primary
   checkout is back on `main` before starting the next item.

## ③ VERIFY
1. Run automated review on the diff (skill: `review`, or `superpowers:code-reviewer`).
2. Run browser QA against the Vercel preview URL (skill: `qa`).
3. Optionally get a second opinion (skill: `codex`) for T3 changes.
4. Fix what's found. **Retry cap = 3 fix cycles.** On the 4th failure, STOP and escalate:
   summarize what failed and hand back to the human.

## ④ SHIP
1. When implementation + QA are done, default to **push and open a PR** — don't ask which
   finishing option to use (skip the "merge locally / PR / keep as-is / discard" prompt).
   Only skip this default if the human explicitly says to keep the branch as-is or discard it.
2. Open a PR (skill: `ship`). The PR body must state the risk tier and check the gate list.
3. **GATE (tiered) — currently overridden, see below.** The tiered gate as originally
   designed:
   - **T1:** auto-merge once CI is green and the preview looks right.
   - **T2:** human async review + approve.
   - **T3:** explicit human approval, plus a separate deploy approval.

   **Standing override (in effect until the human says otherwise):** auto-merge
   T1, T2, and T3 alike once CI is green — do not stop and ask for merge approval
   at any tier. This does NOT relax the SCOPE-phase plan-approval gate for T2/T3
   (§SCOPE step 4 still applies), only the SHIP-phase merge gate. Revert to the
   tiered gate above the moment the human says to.
3. Merge and verify production (skill: `land-and-deploy`).
4. Watch the deploy (skill: `canary`) for console errors / regressions.

### Migrations: apply directly, don't hand off manual SQL
**Standing override (in effect until the human says otherwise): apply every Supabase
migration directly against the real database yourself**, via the Supabase MCP connection
(`apply_migration`), rather than leaving `supabase/migrations/*.sql` as a manual step for the
human to paste into the SQL editor. This replaced an earlier, much more error-prone process —
combined SQL scripts pasted into the Supabase SQL editor silently stopped at the first failing
statement, so everything after it never ran, which was a repeated, hard-to-diagnose root cause
of "missing" schema. After each PR with a migration merges:
1. Read the exact migration file from the merged branch/`main` — don't reconstruct it from
   memory of what an agent said it wrote.
2. Call `apply_migration` with that exact SQL, one migration per call (not bundled), so a
   failure in one can't silently block the rest.
3. Verify the real schema afterward (`execute_sql` against `information_schema.columns`/
   `information_schema.tables`) rather than trusting the tool's success response alone.
4. Run `get_advisors` (security type) and confirm no *new* findings were introduced beyond
   the pre-existing baseline.
5. If the migration was tracked by a manual "apply this migration" issue, close it.
Only fall back to generating SQL files for the human to run manually if the Supabase MCP
connection is genuinely unavailable in the session.

## Retry & escalation (the kill switch)
- Fix-loop retry cap: **3**. On the 4th failure, stop and escalate to the human.
- Escalation = stop work, write a short summary of what failed and what was tried.

### Secret-scan (gitleaks) false positives
Gitleaks scans the full commit-*range* diff, not just the final file state. If a flagged
string is fixed in a later commit, the original (still-flagged) commit remains in history and
CI stays red — a follow-up "fix" commit does **not** resolve it. To actually clear it:
`git reset --soft <merge-base-with-main>` on the branch, then recommit everything as one clean
commit that never contained the flagged text, then force-push. Don't disable or skip the
secret-scan gate to work around this.

## When in doubt
If a change touches something not clearly covered by a tier, treat it as **T3**.
