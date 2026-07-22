import type { SupabaseClient } from "@supabase/supabase-js";

export type OrgPermissionSettings = {
  membersCanDeleteCustomers: boolean;
  membersCanViewBilling: boolean;
  membersCanEditBusinessSettings: boolean;
  smsNotificationsEnabled: boolean;
  dunningEnabled: boolean;
  dunningReminderDays: number;
  dunningMahnungDays: number;
  dunningEscalationDays: number;
  dunningTone: "freundlich" | "neutral" | "streng";
  inventoryDecrementEnabled: boolean;
  reviewRequestEnabled: boolean;
  reviewRequestDays: number;
  reviewPlatformUrl: string | null;
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
      "members_can_delete_customers, members_can_view_billing, members_can_edit_business_settings, sms_notifications_enabled, dunning_enabled, dunning_reminder_days, dunning_mahnung_days, dunning_escalation_days, dunning_tone, inventory_decrement_enabled, review_request_enabled, review_request_days, review_platform_url",
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
    dunningEnabled: data.dunning_enabled,
    dunningReminderDays: data.dunning_reminder_days,
    dunningMahnungDays: data.dunning_mahnung_days,
    dunningEscalationDays: data.dunning_escalation_days,
    dunningTone: data.dunning_tone,
    inventoryDecrementEnabled: data.inventory_decrement_enabled,
    reviewRequestEnabled: data.review_request_enabled,
    reviewRequestDays: data.review_request_days,
    reviewPlatformUrl: data.review_platform_url,
  };
}
