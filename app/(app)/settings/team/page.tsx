import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrg } from "@/lib/organizations/getCurrentOrg";
import { getOrgSettings } from "@/lib/organizations/getOrgSettings";
import { getOrgMembers } from "@/lib/organizations/getOrgMembers";
import { canManageTeam } from "@/lib/organizations/permissions";
import { TeamSettingsForm, type TeamMember, type PendingInvite } from "./TeamSettingsForm";

export default async function TeamSettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const org = await getCurrentOrg(supabase);
  // Team management is owner-only. Members are bounced to plain settings rather
  // than shown a page they can't act on (the Server Actions also enforce this).
  if (!org || !canManageTeam(org.role)) {
    redirect("/settings");
  }

  // Emails live in auth.users, which is only reachable via the service-role
  // client -- so member/invite listing is read server-side via the admin client
  // (never exposed to the browser).
  const admin = createAdminClient();

  const members: TeamMember[] = await getOrgMembers(admin, org.organizationId);

  const { data: inviteRows, error: invitesError } = await admin
    .from("organization_invites")
    .select("id, email, created_at")
    .eq("organization_id", org.organizationId)
    .is("accepted_at", null)
    .order("created_at", { ascending: false });
  if (invitesError) {
    console.error("Failed to load pending invites:", invitesError);
  }

  const pendingInvites: PendingInvite[] = (inviteRows ?? []).map((row) => ({
    id: row.id,
    email: row.email,
  }));

  // Settings are read via the admin client here too -- the owner-gate above
  // already confirmed this caller is an owner, and using admin keeps this
  // page's data-loading consistent with the members/invites reads above.
  const settings = await getOrgSettings(admin, org.organizationId);

  return (
    <TeamSettingsForm
      members={members}
      pendingInvites={pendingInvites}
      currentUserId={user.id}
      permissions={
        settings ?? {
          membersCanDeleteCustomers: true,
          membersCanViewBilling: true,
          membersCanEditBusinessSettings: true,
          smsNotificationsEnabled: false,
          dunningEnabled: true,
          dunningReminderDays: 3,
          dunningMahnungDays: 10,
          dunningEscalationDays: 24,
          dunningTone: "neutral",
          inventoryDecrementEnabled: false,
        }
      }
    />
  );
}
