import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: settings, error } = await supabase
    .from("business_settings")
    .select("company_name, address, vat_id, tax_number")
    .maybeSingle();

  if (error) {
    console.error("Failed to load business settings:", error);
  }

  return <SettingsForm initialSettings={settings ?? null} />;
}
