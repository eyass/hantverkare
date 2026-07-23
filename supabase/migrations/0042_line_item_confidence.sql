-- Per-line-item AI confidence (issue #202).
--
-- Problem this addresses: generateLineItems (lib/quotes/generateLineItems.ts)
-- already forces the model to justify each line item's quantity via
-- quantity_reasoning (issue #200/0041), but every line item still carries
-- the same implicit trust regardless of how confident the model actually
-- was. A tradesperson reviewing a 15-line draft has no signal for which
-- 2 lines are a rough guess vs. which 13 are solidly grounded in the job
-- description.
--
-- The fix: the AI tool schema now requires a "confidence" value
-- ("high" | "medium" | "low") per line item, alongside itemType and
-- quantityReasoning -- see resolveLineItem() in
-- lib/quotes/generateLineItems.ts. The review screen (QuoteEditor.tsx)
-- surfaces a small, unobtrusive indicator only for "medium"/"low" items so
-- the common (high-confidence) case stays visually quiet.
--
-- Columns:
--   confidence -- 'high' | 'medium' | 'low', set by the AI generation path
--                 per line item (issue #202). Nullable for the same
--                 backward-compat reason as item_type/quantity_reasoning
--                 (0041_smarter_line_items.sql): existing rows,
--                 manually-added items, and template-copied items
--                 (buildLineItemsFromTemplate,
--                 lib/quoteTemplates/templateBuilder.ts) don't set this,
--                 and the UI simply omits the indicator when null.
--
-- No new RLS policy needed: this is a plain column on quote_line_items,
-- which already has owner/member-scoped RLS (is_org_member(organization_id))
-- from 0001_init.sql / 0002_quotes.sql.

alter table public.quote_line_items
  add column confidence text check (confidence is null or confidence in ('high', 'medium', 'low'));

comment on column public.quote_line_items.confidence is
  'Optional AI-assessed confidence ("high" | "medium" | "low") for this line item''s quantity/price, set by the AI generation path (issue #202) so the tradesperson can spot genuinely uncertain items instead of every line carrying equal implicit trust. Null for pre-existing rows and non-AI-generated items.';
