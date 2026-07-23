-- AI clarifying questions on quote generation (issue #194).
--
-- Extends generateQuoteDraft's structured output: instead of always
-- silently guessing at missing details (a critical dimension, quantity, or
-- scope detail), the AI can optionally return up to 3 clarifying questions.
-- When it does, the tradesperson sees them on the quote draft/review screen
-- and can either add more detail (voice note or text, appended to the
-- original description, then regenerate) or explicitly skip and keep the
-- already-generated best-guess draft.
--
-- Columns:
--   ai_clarifying_questions            -- jsonb array of question strings
--                                          returned by the AI alongside the
--                                          draft's line items. Null/absent
--                                          when the AI was confident enough
--                                          to skip asking (the common,
--                                          "under a minute" case). Never
--                                          more than 3 (enforced by the
--                                          prompt, not a DB constraint --
--                                          same trust boundary as the rest
--                                          of the AI-generated draft
--                                          content).
--   ai_clarifying_questions_resolved_at -- set at most once, either when the
--                                          tradesperson explicitly clicks
--                                          "Skip -- use my best guess", or
--                                          implicitly whenever the draft is
--                                          regenerated with additional
--                                          detail and the new AI response
--                                          comes back with no further
--                                          questions. Null means the
--                                          questions (if any) are still
--                                          open. Mirrors the set-once-never-
--                                          unset pattern used by
--                                          deposit_paid_at / paid_at /
--                                          review_request_sent_at elsewhere
--                                          on this table.
--
-- No new RLS policy needed: these are plain columns on `quotes`, which
-- already has owner/member-scoped RLS (is_org_member(organization_id)) from
-- 0001_init.sql. Writes happen via the owner-gated tradesperson actions
-- (generateQuoteDraft / regenerateQuoteDraft / resolveClarifyingQuestions),
-- same pattern as every other quote column.

alter table public.quotes
  add column ai_clarifying_questions jsonb,
  add column ai_clarifying_questions_resolved_at timestamptz;

comment on column public.quotes.ai_clarifying_questions is
  'Optional jsonb array (max 3) of clarifying question strings the AI returned instead of silently guessing at a missing critical detail when generating this quote''s draft. Null when the AI was confident enough to skip asking (issue #194).';
comment on column public.quotes.ai_clarifying_questions_resolved_at is
  'Timestamp the open clarifying questions were resolved -- either the tradesperson explicitly skipped them (kept the best-guess draft as-is) or a regeneration with added detail came back with no further questions. Null while questions (if any) are still open.';
