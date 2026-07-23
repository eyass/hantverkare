"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrg } from "@/lib/organizations/getCurrentOrg";
import { canManageTeam } from "@/lib/organizations/permissions";
import { getCompanyProfile, LexofficeApiError } from "@/lib/integrations/lexoffice/client";

type ActionResult = { error: string | null };

/**
 * Validates a lexoffice API key with a real test call (fetches the
 * company/profile endpoint) before saving it. Owner-only, mirroring
 * updateTeamPermissions in app/(app)/settings/team/actions.ts: the caller's
 * role is resolved server-side from their own session, never trusted from
 * client input.
 *
 * On success, saves the key and leaves lexoffice_sync_enabled untouched
 * (defaults to false from the migration) -- connecting a key and turning on
 * sync are two separate, deliberate steps.
 */
export async function connectLexoffice(apiKey: string): Promise<ActionResult> {
  const trimmed = apiKey.trim();
  if (trimmed.length === 0) {
    return { error: "Bitte gib einen API-Schlüssel ein." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Bitte melde dich an." };
  }

  const org = await getCurrentOrg(supabase);
  if (!org || !canManageTeam(org.role)) {
    return { error: "Nur der Inhaber kann Integrationen verwalten." };
  }

  try {
    // Test call: any successful response means the key is valid/live. We
    // don't need the returned profile for anything here, just the fact that
    // it didn't throw.
    await getCompanyProfile(trimmed);
  } catch (error) {
    if (error instanceof LexofficeApiError && (error.status === 401 || error.status === 403)) {
      return { error: "API-Schlüssel ungültig. Bitte überprüfe ihn in lexoffice." };
    }
    console.error("Failed to validate lexoffice API key:", error);
    return {
      error: "lexoffice konnte nicht erreicht werden. Bitte versuche es später erneut.",
    };
  }

  const admin = createAdminClient();
  const { error: updateError } = await admin
    .from("organizations")
    .update({ lexoffice_api_key: trimmed })
    .eq("id", org.organizationId);

  if (updateError) {
    console.error("Failed to save lexoffice API key:", updateError);
    return { error: "API-Schlüssel konnte nicht gespeichert werden." };
  }

  revalidatePath("/settings/integrations");
  return { error: null };
}

/** Disconnects lexoffice: clears the key and turns sync off. Owner-only. */
export async function disconnectLexoffice(): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Bitte melde dich an." };
  }

  const org = await getCurrentOrg(supabase);
  if (!org || !canManageTeam(org.role)) {
    return { error: "Nur der Inhaber kann Integrationen verwalten." };
  }

  const admin = createAdminClient();
  const { error: updateError } = await admin
    .from("organizations")
    .update({ lexoffice_api_key: null, lexoffice_sync_enabled: false })
    .eq("id", org.organizationId);

  if (updateError) {
    console.error("Failed to disconnect lexoffice:", updateError);
    return { error: "Verbindung konnte nicht getrennt werden." };
  }

  revalidatePath("/settings/integrations");
  return { error: null };
}

/**
 * Toggles automatic sync of new invoices to lexoffice. Requires a saved API
 * key -- an org can't enable sync without first connecting successfully.
 */
export async function setLexofficeSyncEnabled(enabled: boolean): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Bitte melde dich an." };
  }

  const org = await getCurrentOrg(supabase);
  if (!org || !canManageTeam(org.role)) {
    return { error: "Nur der Inhaber kann Integrationen verwalten." };
  }

  const admin = createAdminClient();

  if (enabled) {
    const { data: orgRow, error: fetchError } = await admin
      .from("organizations")
      .select("lexoffice_api_key")
      .eq("id", org.organizationId)
      .maybeSingle();
    if (fetchError || !orgRow?.lexoffice_api_key) {
      return { error: "Bitte verbinde zuerst einen gültigen API-Schlüssel." };
    }
  }

  const { error: updateError } = await admin
    .from("organizations")
    .update({ lexoffice_sync_enabled: enabled })
    .eq("id", org.organizationId);

  if (updateError) {
    console.error("Failed to update lexoffice sync setting:", updateError);
    return { error: "Einstellung konnte nicht gespeichert werden." };
  }

  revalidatePath("/settings/integrations");
  return { error: null };
}
