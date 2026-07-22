import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/organizations/getCurrentOrg";
import { canManageTeam } from "@/lib/organizations/permissions";
import { createAdminClient } from "@/lib/supabase/admin";
import { DangerZoneForm } from "./DangerZoneForm";

export default async function DangerZonePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const org = await getCurrentOrg(supabase);
  // Deletion is owner-only. Members are bounced to plain settings rather than
  // shown a page they can't act on (the Server Action also enforces this).
  if (!org || !canManageTeam(org.role)) {
    redirect("/settings");
  }

  const admin = createAdminClient();
  const { data: orgRow, error } = await admin
    .from("organizations")
    .select("name")
    .eq("id", org.organizationId)
    .maybeSingle();
  if (error) {
    console.error("Failed to load organization name:", error);
  }

  return <DangerZoneForm organizationName={orgRow?.name ?? ""} />;
}
