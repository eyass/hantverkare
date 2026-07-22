import type { SupabaseClient } from "@supabase/supabase-js";

export type OrgPermissionSettings = {
  membersCanDeleteCustomers: boolean;
  membersCanViewBilling: boolean;
  membersCanEditBusinessSettings: boolean;
  smsNotificationsEnabled: boolean;
};

/**
 * Reads the owner-configurable member-restriction settings for an org (issue
 * #52). Kept separate from getCurrentOrg() so callers that don't need these
 * three booleans (the majority of the app) don't pay for the extra columns.
 *
 * Returns null if the org row can't be found (shouldn't happen for a caller
 * that already resolved a valid organizationId via getCurrentOrg, but we
 * fail closed rather than assume permissive defaults if it does).
 */
export async function getOrgSettings(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<OrgPermissionSettings | null> {
  const { data, error } = await supabase
    .from("organizations")
    .select(
      "members_can_delete_customers, members_can_view_billing, members_can_edit_business_settings, sms_notifications_enabled",
    )
    .eq("id", organizationId)
    .maybeSingle();

  if (error || !data) {
    console.error("Failed to load organization permission settings:", error);
    return null;
  }

  return {
    membersCanDeleteCustomers: data.members_can_delete_customers,
    membersCanViewBilling: data.members_can_view_billing,
    membersCanEditBusinessSettings: data.members_can_edit_business_settings,
    smsNotificationsEnabled: data.sms_notifications_enabled,
  };
}
