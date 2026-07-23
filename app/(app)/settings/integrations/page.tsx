import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrg } from "@/lib/organizations/getCurrentOrg";
import { canManageTeam } from "@/lib/organizations/permissions";
import { isGoogleCalendarConfigured } from "@/lib/integrations/googleCalendar/client";
import { LexofficeSection } from "./LexofficeSection";
import { GoogleCalendarSection } from "./GoogleCalendarSection";

export default async function IntegrationsSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const org = await getCurrentOrg(supabase);
  // Owner-only, same gate as /settings/team and /settings/danger-zone: both
  // integrations below store/manage credentials, and the connect/disconnect
  // Server Actions enforce owner-only server-side regardless of this redirect.
  if (!org || !canManageTeam(org.role)) {
    redirect("/settings");
  }

  // Neither lexoffice_api_key nor google_calendar_refresh_token has a
  // client-readable RLS-scoped select path (see 0036_lexoffice_integration.sql
  // / 0037_google_calendar_sync.sql), so this reads via the admin client, same
  // pattern as the owner-gated reads on /settings/team.
  const admin = createAdminClient();
  const { data: orgRow, error } = await admin
    .from("organizations")
    .select(
      "lexoffice_api_key, lexoffice_sync_enabled, google_calendar_refresh_token, google_calendar_id",
    )
    .eq("id", org.organizationId)
    .maybeSingle();
  if (error) {
    console.error("Failed to load integration settings:", error);
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 p-6 sm:p-8">
      <div>
        <h1 className="text-2xl font-semibold text-[#0f172a]">Integrationen</h1>
        <p className="mt-1 text-sm text-[#64748b]">
          Verbinde externe Dienste, um Rechnungen und Termine automatisch zu übertragen.
        </p>
      </div>

      <LexofficeSection
        isConnected={Boolean(orgRow?.lexoffice_api_key)}
        syncEnabled={orgRow?.lexoffice_sync_enabled ?? false}
      />

      <GoogleCalendarSection
        isConfigured={isGoogleCalendarConfigured()}
        isConnected={Boolean(orgRow?.google_calendar_refresh_token)}
        calendarId={orgRow?.google_calendar_id ?? "primary"}
      />
    </div>
  );
}
