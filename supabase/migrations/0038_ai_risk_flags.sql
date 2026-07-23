-- AI proactive risk-flagging (issue #193).
--
-- See docs/superpowers/specs/2026-07-23-ai-risk-flagging-design.md for the
-- full design reasoning. Competitor gap analysis: Bliqat's AI persona flags
-- known building risks (asbestos, housing-association rules) from the job
-- description before the tradesperson finalizes a quote -- this adapts that
-- to German-market equivalents (Asbest, WEG-Beschluss, Denkmalschutz).
--
-- Columns:
--   ai_risk_flags                 -- jsonb array of { type, message }
--                                     returned by the same LLM call that
--                                     already extracts line items
--                                     (generateLineItems in
--                                     lib/quotes/generateLineItems.ts), set
--                                     once at quote-creation time. Null/empty
--                                     when the model found nothing to flag --
--                                     the UI renders nothing in that case.
--   ai_risk_flags_acknowledged_at -- set once the tradesperson dismisses all
--                                     flags on the quote draft/review screen
--                                     (see acknowledgeRiskFlags in
--                                     app/(app)/quotes/[id]/actions.ts).
--                                     Acknowledging never deletes
--                                     ai_risk_flags -- it's a timestamp, not
--                                     a clear, so the flags stay visible in
--                                     the underlying data for audit/review
--                                     even after the tradesperson has hidden
--                                     them from the UI.
--
-- These are heuristic/LLM-assisted flags, not a certified compliance check
-- (see the in-app disclaimer copy shipped alongside this migration in
-- app/(app)/quotes/[id]/RiskFlagsNotice.tsx) -- explicitly non-authoritative,
-- mirroring this repo's existing GoBD compliance notice pattern
-- (0034_gobd_invoice_compliance.sql).
--
-- No new RLS policy needed: these are plain columns on `quotes`, which
-- already has owner/member-scoped RLS (is_org_member(organization_id)) from
-- 0001_init.sql.

alter table public.quotes
  add column ai_risk_flags jsonb,
  add column ai_risk_flags_acknowledged_at timestamptz;

comment on column public.quotes.ai_risk_flags is
  'Array of { type: "asbestos" | "weg_approval" | "denkmalschutz", message: string } risk flags returned by the AI quote-generation call alongside line items. Null/empty when nothing was flagged (issue #193).';
comment on column public.quotes.ai_risk_flags_acknowledged_at is
  'Timestamp the tradesperson dismissed all risk flags on the quote review screen. Does not clear ai_risk_flags -- acknowledgement only hides the notice in the UI, the underlying flags remain for audit/review.';
