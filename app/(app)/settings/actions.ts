"use server";

import { createClient } from "@/lib/supabase/server";

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

  const { error } = await supabase.from("business_settings").upsert(
    {
      user_id: user.id,
      company_name: normalize(input.companyName),
      address: normalize(input.address),
      vat_id: normalize(input.vatId),
      tax_number: normalize(input.taxNumber),
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) {
    console.error("Failed to save business settings:", error);
    return { error: "Einstellungen konnten nicht gespeichert werden." };
  }

  return { error: null };
}
