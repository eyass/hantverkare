"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrg } from "@/lib/organizations/getCurrentOrg";
import { canManageTeam } from "@/lib/organizations/permissions";
import { sendInviteEmail } from "@/lib/notifications/sendInviteEmail";

type ActionResult = { error: string | null };

/**
 * Invites someone (by email) to the current user's organization.
 *
 * Owner-only, enforced server-side: we resolve the caller's role from their own
 * session (never trusting client input) and reject non-owners. All writes go
 * through the service-role admin client with organization_id computed
 * server-side, so a member cannot invite into (or otherwise touch) any org.
 */
export async function inviteMember(email: string): Promise<ActionResult> {
  const trimmed = email.trim().toLowerCase();
  if (trimmed.length === 0 || !trimmed.includes("@")) {
    return { error: "Bitte gib eine gültige E-Mail-Adresse ein." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Bitte melde dich an." };
  }

  const org = await getCurrentOrg(supabase);
  if (!org || !canManageTeam(org.role)) {
    return { error: "Nur der Inhaber kann Mitglieder einladen." };
  }

  const admin = createAdminClient();

  // Service-role write: organization_id and invited_by are server-computed; the
  // token defaults server-side. Nothing here is taken from client input except
  // the invitee email.
  const { data: invite, error: insertError } = await admin
    .from("organization_invites")
    .insert({
      organization_id: org.organizationId,
      email: trimmed,
      invited_by: user.id,
    })
    .select("token")
    .single();

  if (insertError || !invite) {
    console.error("Failed to create invite:", insertError);
    return { error: "Einladung konnte nicht erstellt werden." };
  }

  // Best-effort email; the invite row already exists so a mail failure is not
  // fatal (owner can resend). Look up the org name for a friendlier message.
  const { data: orgRow } = await admin
    .from("organizations")
    .select("name")
    .eq("id", org.organizationId)
    .maybeSingle();

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  await sendInviteEmail({
    toEmail: trimmed,
    inviteUrl: `${siteUrl}/invite/${invite.token}`,
    organizationName: orgRow?.name ?? null,
  });

  revalidatePath("/settings/team");
  return { error: null };
}

export type TeamPermissionsInput = {
  membersCanDeleteCustomers: boolean;
  membersCanViewBilling: boolean;
  membersCanEditBusinessSettings: boolean;
  smsNotificationsEnabled: boolean;
};

/**
 * Updates the owner-configurable member-restriction toggles (issue #52).
 * Owner-only, enforced server-side the same way as inviteMember/removeMember.
 * Uses the caller's own RLS-scoped client (not the admin client) as a second
 * layer of defense: the `organizations` table has no client UPDATE policy at
 * all, so even if the canManageTeam check below were somehow bypassed, this
 * update would still be rejected by RLS. We use the admin client instead so
 * the write actually succeeds, since intentionally there is no owner-write
 * policy on organizations (writes have been service-role-only since 0010).
 */
export async function updateTeamPermissions(
  input: TeamPermissionsInput,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Bitte melde dich an." };
  }

  const org = await getCurrentOrg(supabase);
  if (!org || !canManageTeam(org.role)) {
    return { error: "Nur der Inhaber kann die Berechtigungen ändern." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("organizations")
    .update({
      members_can_delete_customers: input.membersCanDeleteCustomers,
      members_can_view_billing: input.membersCanViewBilling,
      members_can_edit_business_settings: input.membersCanEditBusinessSettings,
      sms_notifications_enabled: input.smsNotificationsEnabled,
    })
    .eq("id", org.organizationId);

  if (error) {
    console.error("Failed to update team permissions:", error);
    return { error: "Berechtigungen konnten nicht gespeichert werden." };
  }

  revalidatePath("/settings/team");
  return { error: null };
}

/**
 * Removes a member from the organization. Owner-only. Owners cannot be removed
 * through this path (removing/transferring ownership is out of scope for v1),
 * and a caller cannot remove themselves.
 */
export async function removeMember(memberUserId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Bitte melde dich an." };
  }

  const org = await getCurrentOrg(supabase);
  if (!org || !canManageTeam(org.role)) {
    return { error: "Nur der Inhaber kann Mitglieder entfernen." };
  }

  if (memberUserId === user.id) {
    return { error: "Du kannst dich nicht selbst entfernen." };
  }

  const admin = createAdminClient();
  // Only 'member' rows are removable -- the role='member' guard means an owner
  // can never be deleted here, so ownership can't be stripped by accident.
  const { data, error } = await admin
    .from("organization_members")
    .delete()
    .eq("organization_id", org.organizationId)
    .eq("user_id", memberUserId)
    .eq("role", "member")
    .select("user_id");

  if (error) {
    console.error("Failed to remove member:", error);
    return { error: "Mitglied konnte nicht entfernt werden." };
  }
  if (!data || data.length === 0) {
    return { error: "Mitglied nicht gefunden." };
  }

  revalidatePath("/settings/team");
  return { error: null };
}
