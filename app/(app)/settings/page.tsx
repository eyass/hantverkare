import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/organizations/getCurrentOrg";
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

  // Referral link (issue #79). organizations has a member-visible SELECT
  // policy (see 0010/0019), so this plain request-scoped client (not the
  // admin client) can read the org's own referral_code -- no service-role
  // client needed here.
  const org = await getCurrentOrg(supabase);
  let referralCode: string | null = null;
  if (org) {
    const { data: orgRow, error: orgError } = await supabase
      .from("organizations")
      .select("referral_code")
      .eq("id", org.organizationId)
      .maybeSingle();
    if (orgError) {
      console.error("Failed to load referral code:", orgError);
    } else {
      referralCode = orgRow?.referral_code ?? null;
    }
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const referralUrl = referralCode ? `${siteUrl}/login?ref=${referralCode}` : null;

  return <SettingsForm initialSettings={settings ?? null} referralUrl={referralUrl} />;
}
