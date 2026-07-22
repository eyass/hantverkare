"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/organizations/getCurrentOrg";
import { buildTemplateFromLineItems } from "@/lib/quoteTemplates/templateBuilder";

type ActionResult = { error: string | null };

export async function deleteQuoteTemplate(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("quote_templates").delete().eq("id", id);
  if (error) {
    console.error("Failed to delete quote template:", error);
    return { error: "Vorlage konnte nicht gelöscht werden." };
  }
  return { error: null };
}

type CreateTemplateResult = { error: string | null };

/**
 * Saves a quote's current line items as a new, reusable quote template. The
 * quote's line items are re-read here (RLS-scoped to the caller's org), never
 * trusted from client input -- only the template name comes from the client.
 */
export async function createTemplateFromQuote(
  quoteId: string,
  name: string,
): Promise<CreateTemplateResult> {
  const supabase = await createClient();
  const org = await getCurrentOrg(supabase);
  if (!org) {
    return { error: "Keine Organisation gefunden." };
  }

  const { data: lineItems, error: fetchError } = await supabase
    .from("quote_line_items")
    .select("description, quantity, unit, unit_price_cents")
    .eq("quote_id", quoteId)
    .order("position");
  if (fetchError || !lineItems) {
    console.error("Failed to load line items for template:", fetchError);
    return { error: "Positionen konnten nicht geladen werden." };
  }

  const result = buildTemplateFromLineItems(name, lineItems);
  if (result.error !== null) {
    return { error: result.error };
  }

  const { data: template, error: templateError } = await supabase
    .from("quote_templates")
    .insert({ organization_id: org.organizationId, name: result.name })
    .select("id")
    .single();
  if (templateError || !template) {
    console.error("Failed to create quote template:", templateError);
    return { error: "Vorlage konnte nicht angelegt werden." };
  }

  const { error: itemsError } = await supabase.from("quote_template_items").insert(
    result.items.map((item) => ({
      ...item,
      organization_id: org.organizationId,
      template_id: template.id,
    })),
  );
  if (itemsError) {
    console.error("Failed to insert quote template items:", itemsError);
    await supabase.from("quote_templates").delete().eq("id", template.id);
    return { error: "Vorlage konnte nicht angelegt werden." };
  }

  return { error: null };
}
