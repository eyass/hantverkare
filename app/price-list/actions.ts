"use server";

import { createClient } from "@/lib/supabase/server";

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

  const { data, error } = await supabase
    .from("price_list_items")
    .insert({
      label: input.label,
      unit: input.unit,
      unit_price_cents: input.unitPriceCents,
      category: input.category,
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
