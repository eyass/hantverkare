export type QuoteTemplateItemSnapshot = {
  label: string;
  unit: string;
  quantity: number;
  unit_price_cents: number;
  sort_order: number;
};

export type QuoteTemplateVersionRowToInsert = {
  organization_id: string;
  template_id: string;
  version_number: number;
  name_snapshot: string;
  items_snapshot: QuoteTemplateItemSnapshot[];
  edited_by: string | null;
};

export type QuoteTemplateItemForSnapshot = {
  label: string;
  unit: string;
  quantity: number;
  unit_price_cents: number;
  sort_order: number;
};

/**
 * Builds the append-only version row capturing a template's state as it
 * existed BEFORE an edit is applied (see 0027_quote_template_versions.sql).
 * Pure/testable: the caller is responsible for fetching the template's
 * current name/items and the next version_number (max + 1, defaulting to 1
 * for a template's first-ever edit) from the database.
 */
export function buildVersionSnapshot(
  organizationId: string,
  templateId: string,
  nextVersionNumber: number,
  currentName: string,
  currentItems: QuoteTemplateItemForSnapshot[],
  editedBy: string | null,
): QuoteTemplateVersionRowToInsert {
  return {
    organization_id: organizationId,
    template_id: templateId,
    version_number: nextVersionNumber,
    name_snapshot: currentName,
    items_snapshot: currentItems
      .slice()
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((item) => ({
        label: item.label,
        unit: item.unit,
        quantity: item.quantity,
        unit_price_cents: item.unit_price_cents,
        sort_order: item.sort_order,
      })),
    edited_by: editedBy,
  };
}

/**
 * Given the version rows already stored for a template, returns the
 * version_number to use for the NEXT snapshot (1 for a template with no
 * prior versions yet).
 */
export function nextVersionNumber(existingVersionNumbers: number[]): number {
  if (existingVersionNumbers.length === 0) {
    return 1;
  }
  return Math.max(...existingVersionNumbers) + 1;
}

export type TemplateEditInput = {
  name: string;
  items: { label: string; unit: string; quantity: number; unit_price_cents: number }[];
};

type ValidateEditResult =
  | { error: null; name: string; items: QuoteTemplateItemForSnapshot[] }
  | { error: string; name?: never; items?: never };

/**
 * Validates a template edit (new name + new items) submitted from the
 * detail page, mirroring the validation rules already used when a template
 * is first created from a quote (see buildTemplateFromLineItems).
 */
export function validateTemplateEdit(input: TemplateEditInput): ValidateEditResult {
  const name = input.name.trim();
  if (name.length === 0) {
    return { error: "Bitte gib einen Namen für die Vorlage an." };
  }
  if (name.length > 200) {
    return { error: "Der Name ist zu lang (max. 200 Zeichen)." };
  }
  if (input.items.length === 0) {
    return { error: "Die Vorlage muss mindestens eine Position enthalten." };
  }
  for (const item of input.items) {
    if (item.label.trim().length === 0) {
      return { error: "Jede Position benötigt eine Bezeichnung." };
    }
    if (!(item.quantity > 0)) {
      return { error: "Die Menge muss größer als 0 sein." };
    }
    if (!(item.unit_price_cents > 0)) {
      return { error: "Der Preis muss größer als 0 sein." };
    }
  }

  return {
    error: null,
    name,
    items: input.items.map((item, index) => ({
      label: item.label.trim(),
      unit: item.unit,
      quantity: item.quantity,
      unit_price_cents: item.unit_price_cents,
      sort_order: index,
    })),
  };
}
