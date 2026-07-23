import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrg } from "@/lib/organizations/getCurrentOrg";
import { canManageTeam } from "@/lib/organizations/permissions";
import { IntegrationsForm } from "./IntegrationsForm";

export default async function IntegrationsSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const org = await getCurrentOrg(supabase);
  // Owner-only, same gate as /settings/team and /settings/danger-zone: the
  // API key is a sensitive credential, and the connect/disconnect Server
  // Actions enforce owner-only server-side regardless of this redirect.
  if (!org || !canManageTeam(org.role)) {
    redirect("/settings");
  }

  // The API key itself is never sent to the client -- only whether one is
  // connected. Read via the service-role admin client since
  // organizations.lexoffice_api_key has no client-readable RLS-scoped select
  // path (see 0036_lexoffice_integration.sql).
  const admin = createAdminClient();
  const { data: orgRow, error } = await admin
    .from("organizations")
    .select("lexoffice_api_key, lexoffice_sync_enabled")
    .eq("id", org.organizationId)
    .maybeSingle();
  if (error) {
    console.error("Failed to load lexoffice settings:", error);
  }

  return (
    <IntegrationsForm
      isConnected={Boolean(orgRow?.lexoffice_api_key)}
      syncEnabled={orgRow?.lexoffice_sync_enabled ?? false}
    />
  );
}
