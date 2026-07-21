"use server";

import { createClient } from "@/lib/supabase/server";

export type BusinessSettingsInput = {
  companyName: string;
  address: string;
  vatId: string;
  taxNumber: string;
};

type ActionResult = { error: string | null };

export async function saveBusinessSettings(
  input: BusinessSettingsInput,
): Promise<ActionResult> {
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
      company_name: input.companyName || null,
      address: input.address || null,
      vat_id: input.vatId || null,
      tax_number: input.taxNumber || null,
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
