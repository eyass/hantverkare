export type QuoteTemplateItemRow = {
  id: string;
  template_id: string;
  label: string;
  unit: string;
  quantity: number;
  unit_price_cents: number;
};

export type QuoteLineItemRowToInsert = {
  description: string;
  quantity: number;
  unit: string;
  unit_price_cents: number;
  line_total_cents: number;
  position: number;
};

type BuildLineItemsResult =
  | { error: null; rows: QuoteLineItemRowToInsert[] }
  | { error: string; rows?: never };

/**
 * Turns a template's saved items into quote_line_items rows ready to insert
 * into a (new or existing) quote, starting at `startPosition`. Mirrors
 * lib/priceList/templateSelection.ts: the templateId is re-checked against
 * every item's template_id so a caller can never smuggle in items from a
 * template belonging to a different organization by passing a mismatched id.
 */
export function buildLineItemsFromTemplate(
  templateId: string,
  templateItems: QuoteTemplateItemRow[],
  startPosition = 0,
): BuildLineItemsResult {
  const rows: QuoteLineItemRowToInsert[] = [];

  for (const item of templateItems) {
    if (item.template_id !== templateId) {
      return { error: "Ungültige Vorlage." };
    }
    rows.push({
      description: item.label,
      quantity: item.quantity,
      unit: item.unit,
      unit_price_cents: item.unit_price_cents,
      line_total_cents: Math.round(item.quantity * item.unit_price_cents),
      position: startPosition + rows.length,
    });
  }

  return { error: null, rows };
}

export type QuoteLineItemSource = {
  description: string;
  quantity: number;
  unit: string;
  unit_price_cents: number;
};

export type QuoteTemplateItemToInsert = {
  label: string;
  unit: string;
  quantity: number;
  unit_price_cents: number;
  sort_order: number;
};

type BuildTemplateResult =
  | { error: null; name: string; items: QuoteTemplateItemToInsert[] }
  | { error: string; name?: never; items?: never };

/**
 * Validates a "save this quote's line items as a template" request and turns
 * the quote's (server-trusted, already-persisted) line items into
 * quote_template_items rows. The line items themselves are never taken from
 * client input -- only the template name is user-supplied here.
 */
export function buildTemplateFromLineItems(
  rawName: string,
  lineItems: QuoteLineItemSource[],
): BuildTemplateResult {
  const name = rawName.trim();
  if (name.length === 0) {
    return { error: "Bitte gib einen Namen für die Vorlage an." };
  }
  if (name.length > 200) {
    return { error: "Der Name ist zu lang (max. 200 Zeichen)." };
  }
  if (lineItems.length === 0) {
    return { error: "Das Angebot hat keine Positionen, die gespeichert werden können." };
  }

  const items: QuoteTemplateItemToInsert[] = lineItems.map((item, index) => ({
    label: item.description,
    unit: item.unit,
    quantity: item.quantity,
    unit_price_cents: item.unit_price_cents,
    sort_order: index,
  }));

  return { error: null, name, items };
}
