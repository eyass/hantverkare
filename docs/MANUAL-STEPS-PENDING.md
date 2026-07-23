# Manual steps pending (for the human)

Tracked as GitHub issues labeled [`manual-step`](https://github.com/eyass/hantverkare/issues?q=is%3Aissue+is%3Aopen+label%3Amanual-step), not here — better visibility, and they close themselves out. This file is intentionally kept empty of task content; it only ever holds a pointer.

Open manual steps, in the order to work through them:

1. [#65 — Confirm quote-expiry cron is live](https://github.com/eyass/hantverkare/issues/65)
2. [#66 — QA team permission toggles](https://github.com/eyass/hantverkare/issues/66)
3. [#67 — Real-device QA for 2FA](https://github.com/eyass/hantverkare/issues/67)
4. [#68 — Go live with real Stripe](https://github.com/eyass/hantverkare/issues/68) (independent of 1-3, sequenced last only because it's the highest-stakes one)
5. [#188 — Apply migration 0032 + configure Stripe Connect](https://github.com/eyass/hantverkare/issues/188) (issue #131, online payment collection on invoices -- sequence after #68)

Historical migration SQL lives in `supabase/migrations/`, not duplicated here.
