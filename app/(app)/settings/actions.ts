"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/organizations/getCurrentOrg";
import { getOrgSettings } from "@/lib/organizations/getOrgSettings";
import { canEditBusinessSettings } from "@/lib/organizations/permissions";
import { isAppLanguage, type AppLanguage } from "@/lib/i18n/dictionary";

export type BusinessSettingsInput = {
  companyName: string;
  address: string;
  vatId: string;
  taxNumber: string;
};

type ActionResult = { error: string | null };

const MAX_FIELD_LENGTH = 500;

function normalize(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}

export async function saveBusinessSettings(
  input: BusinessSettingsInput,
): Promise<ActionResult> {
  const fields = [input.companyName, input.address, input.vatId, input.taxNumber];
  if (fields.some((field) => field.length > MAX_FIELD_LENGTH)) {
    return { error: `Eingabe zu lang (max. ${MAX_FIELD_LENGTH} Zeichen pro Feld).` };
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

  // Owners can always restrict members from editing business settings (issue
  // #52). Checked server-side in addition to RLS for a clear German error.
  const settings = await getOrgSettings(supabase, org.organizationId);
  if (
    !settings ||
    !canEditBusinessSettings(org.role, settings.membersCanEditBusinessSettings)
  ) {
    return { error: "Nur der Inhaber kann die Unternehmenseinstellungen bearbeiten." };
  }

  // business_settings is now one row per organization (PK organization_id).
  // user_id is retained only as an audit "last editor" column.
  const { error } = await supabase.from("business_settings").upsert(
    {
      organization_id: org.organizationId,
      user_id: user.id,
      company_name: normalize(input.companyName),
      address: normalize(input.address),
      vat_id: normalize(input.vatId),
      tax_number: normalize(input.taxNumber),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "organization_id" },
  );
  if (error) {
    console.error("Failed to save business settings:", error);
    return { error: "Einstellungen konnten nicht gespeichert werden." };
  }

  return { error: null };
}

/**
 * Updates the signed-in user's UI language preference (issue #116).
 *
 * Server-side validated regardless of what the client sends -- `next` must
 * be exactly "de" or "en" -- rejecting anything else with an error rather
 * than trusting the client-supplied value, same discipline as
 * saveBusinessSettings above. RLS's existing "Users can update their own
 * profile" policy (0001_init.sql) scopes the write to `auth.uid() = id`, so
 * no explicit org/role check is needed here -- this is a personal
 * preference, not organization data.
 */
export async function updateLanguage(next: AppLanguage): Promise<ActionResult> {
  if (!isAppLanguage(next)) {
    return { error: "Ungültige Sprache." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Bitte melde dich an." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ language: next })
    .eq("id", user.id);

  if (error) {
    console.error("Failed to update language preference:", error);
    return { error: "Sprache konnte nicht gespeichert werden." };
  }

  return { error: null };
}
