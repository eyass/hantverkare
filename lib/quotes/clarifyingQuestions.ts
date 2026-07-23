/**
 * Pure state-transition helpers for the AI clarifying-questions flow (issue
 * #194), factored out of app/(app)/quotes/[id]/actions.ts so the
 * resolve/append transitions can be unit tested without a live Supabase
 * client -- the actions themselves are thin wrappers that call these and
 * persist the result.
 */

export type ClarifyingQuestionsUpdate = {
  ai_clarifying_questions: string[] | null;
  ai_clarifying_questions_resolved_at: string | null;
};

/**
 * Called after a regeneration (append + re-run) comes back from the AI.
 * If the new response still has open questions, they replace the old set
 * and the resolution is cleared (a fresh, still-unresolved set). If it
 * comes back clean, the previous questions are implicitly resolved -- the
 * added detail was enough.
 */
export function buildClarifyingQuestionsUpdate(
  clarifyingQuestions: string[],
  now: Date = new Date(),
): ClarifyingQuestionsUpdate {
  if (clarifyingQuestions.length > 0) {
    return { ai_clarifying_questions: clarifyingQuestions, ai_clarifying_questions_resolved_at: null };
  }
  return { ai_clarifying_questions: null, ai_clarifying_questions_resolved_at: now.toISOString() };
}

/**
 * Called when the tradesperson explicitly clicks "Skip -- use my best
 * guess" -- stamps the resolution without touching the questions
 * themselves (they stay visible as historical context on the quote, just
 * no longer prompt for action).
 */
export function buildResolvedTimestamp(now: Date = new Date()): string {
  return now.toISOString();
}
