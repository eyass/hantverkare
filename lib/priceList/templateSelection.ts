export type TemplateItemRow = {
  id: string;
  template_id: string;
  label: string;
  unit: string;
  category: string;
};

export type Selection = {
  templateItemId: string;
  unitPriceCents: number;
};

export type PriceListItemRowToInsert = {
  label: string;
  unit: string;
  unit_price_cents: number;
  category: string;
};

type BuildResult =
  | { error: null; rows: PriceListItemRowToInsert[] }
  | { error: string; rows?: never };

/**
 * Turns a client-supplied template selection into rows ready to insert into
 * price_list_items. Only the templateItemId and the (user-editable) price
 * come from the client -- label/unit/category are always re-read from the
 * server-trusted templateItems array, never from client input.
 */
export function buildRowsToInsert(
  templateId: string,
  templateItems: TemplateItemRow[],
  selections: Selection[],
): BuildResult {
  const rows: PriceListItemRowToInsert[] = [];

  for (const selection of selections) {
    const item = templateItems.find((candidate) => candidate.id === selection.templateItemId);
    if (!item || item.template_id !== templateId) {
      return { error: "Ungültige Auswahl." };
    }
    if (!Number.isInteger(selection.unitPriceCents) || selection.unitPriceCents <= 0) {
      return { error: "Preis muss größer als 0 sein." };
    }
    rows.push({
      label: item.label,
      unit: item.unit,
      unit_price_cents: selection.unitPriceCents,
      category: item.category,
    });
  }

  return { error: null, rows };
}
