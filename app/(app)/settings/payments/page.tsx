import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/organizations/getCurrentOrg";
import { canViewBilling } from "@/lib/organizations/permissions";
import { PaymentsSettingsForm } from "./PaymentsSettingsForm";

export default async function PaymentsSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const org = await getCurrentOrg(supabase);
  // Same owner-only gate as /billing (canViewBilling) -- connecting/managing
  // the org's own Stripe account for collecting customer payments is a
  // money-related setting, not a day-to-day operation any member should touch.
  if (!org || !canViewBilling(org.role)) {
    redirect("/settings");
  }

  const { data: orgRow, error } = await supabase
    .from("organizations")
    .select("stripe_connect_account_id, stripe_connect_onboarded")
    .eq("id", org.organizationId)
    .maybeSingle();
  if (error) {
    console.error("Failed to load Connect status:", error);
  }

  return (
    <PaymentsSettingsForm
      hasAccount={Boolean(orgRow?.stripe_connect_account_id)}
      onboarded={Boolean(orgRow?.stripe_connect_onboarded)}
    />
  );
}
