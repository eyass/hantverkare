"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/organizations/getCurrentOrg";
import { buildTemplateFromLineItems } from "@/lib/quoteTemplates/templateBuilder";
import {
  buildVersionSnapshot,
  nextVersionNumber,
  validateTemplateEdit,
  type TemplateEditInput,
} from "@/lib/quoteTemplates/versionSnapshot";

type ActionResult = { error: string | null };

/**
 * Loads a template's current name + items and its stored version numbers,
 * scoped to the caller's org (RLS also enforces this, this is just so we
 * can fail with a clean error instead of a null-deref below).
 */
async function loadTemplateForSnapshot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  templateId: string,
) {
  const { data: template, error: templateError } = await supabase
    .from("quote_templates")
    .select("id, organization_id, name")
    .eq("id", templateId)
    .single();
  if (templateError || !template) {
    return { error: "Vorlage nicht gefunden." as const };
  }

  const { data: items, error: itemsError } = await supabase
    .from("quote_template_items")
    .select("label, unit, quantity, unit_price_cents, sort_order")
    .eq("template_id", templateId)
    .order("sort_order");
  if (itemsError || !items) {
    return { error: "Positionen konnten nicht geladen werden." as const };
  }

  const { data: versions, error: versionsError } = await supabase
    .from("quote_template_versions")
    .select("version_number")
    .eq("template_id", templateId);
  if (versionsError) {
    return { error: "Versionen konnten nicht geladen werden." as const };
  }

  return {
    error: null,
    template,
    items,
    nextVersionNumber: nextVersionNumber((versions ?? []).map((v) => v.version_number)),
  };
}

/**
 * Snapshots a template's CURRENT (about-to-be-overwritten) state into
 * quote_template_versions, then overwrites its name + items with the given
 * new state. Used both for a plain edit and for "restore an old version"
 * (which just supplies that version's name/items as the new state) --
 * restoring is itself an edit, so it also gets captured in the trail,
 * meaning nothing is ever silently lost.
 */
async function snapshotThenOverwrite(
  templateId: string,
  newName: string,
  newItems: { label: string; unit: string; quantity: number; unit_price_cents: number; sort_order: number }[],
): Promise<ActionResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const loaded = await loadTemplateForSnapshot(supabase, templateId);
  if (loaded.error !== null) {
    return { error: loaded.error };
  }
  const { template, items, nextVersionNumber: versionNumber } = loaded;

  const versionRow = buildVersionSnapshot(
    template.organization_id,
    templateId,
    versionNumber,
    template.name,
    items,
    user?.id ?? null,
  );

  const { error: versionError } = await supabase.from("quote_template_versions").insert(versionRow);
  if (versionError) {
    console.error("Failed to snapshot quote template version:", versionError);
    return { error: "Version konnte nicht gespeichert werden." };
  }

  const { error: updateNameError } = await supabase
    .from("quote_templates")
    .update({ name: newName })
    .eq("id", templateId);
  if (updateNameError) {
    console.error("Failed to update quote template name:", updateNameError);
    return { error: "Vorlage konnte nicht aktualisiert werden." };
  }

  const { error: deleteItemsError } = await supabase
    .from("quote_template_items")
    .delete()
    .eq("template_id", templateId);
  if (deleteItemsError) {
    console.error("Failed to clear quote template items:", deleteItemsError);
    return { error: "Vorlage konnte nicht aktualisiert werden." };
  }

  const { error: insertItemsError } = await supabase.from("quote_template_items").insert(
    newItems.map((item) => ({
      ...item,
      organization_id: template.organization_id,
      template_id: templateId,
    })),
  );
  if (insertItemsError) {
    console.error("Failed to insert updated quote template items:", insertItemsError);
    return { error: "Vorlage konnte nicht aktualisiert werden." };
  }

  return { error: null };
}

/**
 * Applies an edit submitted from the template detail page: validates the
 * new name/items, snapshots the prior state, then overwrites.
 */
export async function updateQuoteTemplate(
  templateId: string,
  input: TemplateEditInput,
): Promise<ActionResult> {
  const validated = validateTemplateEdit(input);
  if (validated.error !== null) {
    return { error: validated.error };
  }
  return snapshotThenOverwrite(templateId, validated.name, validated.items);
}

/**
 * Restores a template to an old version: snapshots the current state (so
 * the edit being reverted is itself preserved in the trail), then applies
 * the target version's name/items as the new current state.
 */
export async function restoreQuoteTemplateVersion(
  templateId: string,
  versionId: string,
): Promise<ActionResult> {
  const supabase = await createClient();

  const { data: version, error: versionError } = await supabase
    .from("quote_template_versions")
    .select("template_id, name_snapshot, items_snapshot")
    .eq("id", versionId)
    .single();
  if (versionError || !version || version.template_id !== templateId) {
    return { error: "Version nicht gefunden." };
  }

  const items = (
    version.items_snapshot as {
      label: string;
      unit: string;
      quantity: number;
      unit_price_cents: number;
      sort_order: number;
    }[]
  ).map((item, index) => ({ ...item, sort_order: index }));

  return snapshotThenOverwrite(templateId, version.name_snapshot, items);
}

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
