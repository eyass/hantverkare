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
- [ ] Working directory confirmed on the expected branch (`git status --short`)
- [ ] Feature branch created
- [ ] Implemented in atomic commits
- [ ] Pushed; CI green; preview built
- [ ] (parallel/background subagents only) migration numbers pre-assigned; each subagent's
      completion report independently verified (`gh pr view`) before trusting it

## ③ VERIFY
- [ ] Automated review run
- [ ] Browser QA against preview
- [ ] Issues fixed (retry count: _/3)

## ④ SHIP
- [ ] PR opened with tier + gate checklist
- [ ] PR gate satisfied for tier
- [ ] Merged + production verified
- [ ] Migration(s), if any, applied directly via Supabase MCP + schema verified + advisors
      checked (see LOOP.md)
- [ ] Related manual-step issue closed, if the migration was the only blocker on it
- [ ] Canary watch done
