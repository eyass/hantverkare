"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/organizations/getCurrentOrg";
import { buildRowsToInsert, type Selection } from "@/lib/priceList/templateSelection";

export type PriceListItemInput = {
  label: string;
  unit: string;
  unitPriceCents: number;
  category: string;
};

type PriceListItemRow = {
  id: string;
  label: string;
  unit: string;
  unit_price_cents: number;
  category: string;
};

type CreateResult = { error: string; item?: never } | { error: null; item: PriceListItemRow };

type ActionResult = { error: string | null };

function validateInput(input: PriceListItemInput): string | null {
  if (input.label.trim().length === 0 || input.unit.trim().length === 0) {
    return "Bezeichnung und Einheit dürfen nicht leer sein.";
  }
  if (!Number.isInteger(input.unitPriceCents) || input.unitPriceCents <= 0) {
    return "Preis muss größer als 0 sein.";
  }
  return null;
}

export async function createPriceListItem(input: PriceListItemInput): Promise<CreateResult> {
  const validationError = validateInput(input);
  if (validationError) {
    return { error: validationError };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Bitte melde dich an." };
  }

  const org = await getCurrentOrg(supabase);
  if (!org) {
    return { error: "Keine Organisation gefunden." };
  }

  const { data, error } = await supabase
    .from("price_list_items")
    .insert({
      label: input.label,
      unit: input.unit,
      unit_price_cents: input.unitPriceCents,
      category: input.category,
      organization_id: org.organizationId,
      user_id: user.id,
    })
    .select("id, label, unit, unit_price_cents, category")
    .single();
  if (error || !data) {
    console.error("Failed to create price list item:", error);
    return { error: "Position konnte nicht angelegt werden." };
  }

  return { error: null, item: data };
}

export async function updatePriceListItem(
  id: string,
  input: PriceListItemInput,
): Promise<ActionResult> {
  const validationError = validateInput(input);
  if (validationError) {
    return { error: validationError };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("price_list_items")
    .update({
      label: input.label,
      unit: input.unit,
      unit_price_cents: input.unitPriceCents,
      category: input.category,
    })
    .eq("id", id);
  if (error) {
    console.error("Failed to update price list item:", error);
    return { error: "Position konnte nicht gespeichert werden." };
  }

  return { error: null };
}

export async function deletePriceListItem(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("price_list_items").delete().eq("id", id);
  if (error) {
    console.error("Failed to delete price list item:", error);
    return { error: "Position konnte nicht gelöscht werden." };
  }

  return { error: null };
}

export async function createPriceListItemsFromTemplate(
  templateId: string,
  selections: Selection[],
): Promise<{ error: string | null }> {
  if (selections.length === 0) {
    return { error: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Bitte melde dich an." };
  }

  const org = await getCurrentOrg(supabase);
  if (!org) {
    return { error: "Keine Organisation gefunden." };
  }

  const { data: templateItems, error: fetchError } = await supabase
    .from("price_list_template_items")
    .select("id, template_id, label, unit, category")
    .eq("template_id", templateId);
  if (fetchError || !templateItems) {
    console.error("Failed to load price list template items:", fetchError);
    return { error: "Vorlage konnte nicht geladen werden." };
  }

  const result = buildRowsToInsert(templateId, templateItems, selections);
  if (result.error !== null) {
    return { error: result.error };
  }

  const rowsWithOwner = result.rows.map((row) => ({
    ...row,
    organization_id: org.organizationId,
    user_id: user.id,
  }));

  const { error: insertError } = await supabase.from("price_list_items").insert(rowsWithOwner);
  if (insertError) {
    console.error("Failed to bulk-insert price list items from template:", insertError);
    return { error: "Positionen konnten nicht angelegt werden." };
  }

  return { error: null };
}
