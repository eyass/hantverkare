# Loop: Shared multi-trade job timeline view (#161)

- **Risk tier:** T2 (read-only view over existing scheduling/assignment data, no schema changes)
- **Branch:** feat/multi-trade-job-timeline
- **Preview URL:** filled by CI on push

## ① SCOPE
- [x] Tier assigned (T2, per issue #161)
- [x] Plan: extend existing `/schedule` page with a customer-grouping mode
      (`?customer=<id>`) rather than a new route -- reuses the day-grouping
      list UI from #124, adds an assigned-tradesperson label per job (from
      #128's `quotes.assigned_to`) and overlap/conflict detection.
- [x] Full-autonomy override in effect for this task -- no human plan-approval gate.

## ② BUILD
- [x] Feature branch created
- [ ] Implemented in atomic commits
- [ ] Pushed; CI green

## ③ VERIFY
- [ ] npm run lint / typecheck / build / test
- [ ] Manual verification via production build

## ④ SHIP
- [ ] PR opened, Closes #161
