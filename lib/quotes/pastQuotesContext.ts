// Few-shot calibration from the organization's own quoting history (issue
// #202). This module only formats already-fetched rows into a condensed
// prompt block -- it does NOT touch Supabase itself, so it stays a pure,
// easily-unit-testable function, matching generateLineItems.ts's own
// Supabase-free design. The two call sites (app/(app)/quotes/new/actions.ts
// and regenerateQuoteDraft in app/(app)/quotes/[id]/actions.ts) run the
// actual query and pass the rows in here.
//
// Query shape used by both call sites (simple recency, no embeddings/
// semantic search -- out of scope for v1):
//
//   supabase
//     .from("quotes")
//     .select("customer_description, quote_line_items(description, quantity, unit, unit_price_cents)")
//     .eq("organization_id", organizationId)
//     .eq("status", "final")
//     .order("created_at", { ascending: false })
//     .limit(MAX_PAST_QUOTES)

export type PastQuoteLineItem = {
  description: string;
  quantity: number;
  unit: string;
  unit_price_cents: number;
};

export type PastQuote = {
  customer_description: string;
  quote_line_items: PastQuoteLineItem[] | null;
};

// Recency-only, top-3 -- enough to calibrate wording/quantities/margins
// without turning this into a full retrieval system (out of scope for v1).
export const MAX_PAST_QUOTES = 3;
// A single past quote with an unusually large number of line items (e.g. a
// big renovation) shouldn't blow up the prompt -- cap how many of its items
// get echoed into the few-shot block.
const MAX_LINE_ITEMS_PER_QUOTE = 8;
// Past job descriptions can be long free text; keep the few-shot block
// condensed to just enough context to identify the kind of job.
const MAX_DESCRIPTION_CHARS = 200;

/**
 * Formats up to MAX_PAST_QUOTES recent finalized quotes (each with their
 * line items) into a condensed "here's how this org has priced similar work
 * before" block for injection into the generation prompt.
 *
 * Returns undefined when there's nothing usable yet (fewer than 1 final
 * quote) so callers/buildPrompt can omit the section entirely -- this is
 * the graceful cold-start degradation to today's behavior, not an error.
 */
export function buildPastQuotesContext(pastQuotes: PastQuote[] | null | undefined): string | undefined {
  if (!pastQuotes || pastQuotes.length === 0) {
    return undefined;
  }

  const blocks = pastQuotes.slice(0, MAX_PAST_QUOTES).map((quote, index) => {
    const description = (quote.customer_description ?? "").trim().slice(0, MAX_DESCRIPTION_CHARS);
    const items = (quote.quote_line_items ?? []).slice(0, MAX_LINE_ITEMS_PER_QUOTE);
    const itemLines =
      items.length > 0
        ? items
            .map(
              (item) =>
                `  - ${item.description}: ${item.quantity} ${item.unit} à ${(item.unit_price_cents / 100).toFixed(2)} EUR`,
            )
            .join("\n")
        : "  (keine Positionen)";
    return `Beispiel ${index + 1} (Auftrag: "${description}"):\n${itemLines}`;
  });

  return blocks.join("\n\n");
}
