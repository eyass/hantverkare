import type { SupabaseClient } from "@supabase/supabase-js";

export type OrgMemberSummary = {
  userId: string;
  email: string;
  role: "owner" | "member";
};

/**
 * Lists every member of an organization with their email, for UI that needs
 * to let a caller pick a teammate (e.g. the team settings page, and the job
 * "assign to" selector from issue #128).
 *
 * Emails live in auth.users, only reachable via the service-role client, so
 * this always requires an admin client -- same reasoning as
 * settings/team/page.tsx, which this helper was factored out of.
 */
export async function getOrgMembers(
  admin: SupabaseClient,
  organizationId: string,
): Promise<OrgMemberSummary[]> {
  const { data: memberRows, error } = await admin
    .from("organization_members")
    .select("user_id, role, created_at")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true });
  if (error) {
    console.error("Failed to load organization members:", error);
    return [];
  }

  const members: OrgMemberSummary[] = [];
  for (const row of memberRows ?? []) {
    const { data: memberUser } = await admin.auth.admin.getUserById(row.user_id);
    members.push({
      userId: row.user_id,
      email: memberUser?.user?.email ?? "(unbekannt)",
      role: row.role as "owner" | "member",
    });
  }
  return members;
}
