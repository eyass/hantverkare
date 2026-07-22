import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrg } from "@/lib/organizations/getCurrentOrg";
import { getOrgSettings } from "@/lib/organizations/getOrgSettings";
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

  const { data: memberRows, error: membersError } = await admin
    .from("organization_members")
    .select("user_id, role, created_at")
    .eq("organization_id", org.organizationId)
    .order("created_at", { ascending: true });
  if (membersError) {
    console.error("Failed to load organization members:", membersError);
  }

  const members: TeamMember[] = [];
  for (const row of memberRows ?? []) {
    const { data: memberUser } = await admin.auth.admin.getUserById(row.user_id);
    members.push({
      userId: row.user_id,
      email: memberUser?.user?.email ?? "(unbekannt)",
      role: row.role as "owner" | "member",
    });
  }

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
        }
      }
    />
  );
}
