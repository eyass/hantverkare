import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export type OrgRole = "owner" | "member";

export type CurrentOrg = {
  organizationId: string;
  role: OrgRole;
};

/**
 * Resolves the signed-in user's organization and role in a single query.
 *
 * This replaces `user.id` as the scoping key everywhere in the app: reads are
 * scoped by org-membership RLS (so a plain select needs no explicit filter),
 * but writes that set organization_id MUST use the value returned here --
 * computed server-side from the authenticated session -- never a client-
 * supplied organization_id, or a user could hijack another org's data.
 *
 * v1 has no multi-org-per-user case (YAGNI), so a single membership lookup by
 * user_id is sufficient; if a user somehow has more than one membership we take
 * the first deterministically (ordered by created_at) rather than guessing.
 *
 * Returns null when the user is unauthenticated or has no membership yet. The
 * (app) layout guarantees a membership exists for authenticated users via
 * ensureOrganization(), so callers past the layout can treat null as an error.
 *
 * Pass an existing server client to reuse the caller's session/getUser rather
 * than creating a second one; omit it and one is created.
 */
export async function getCurrentOrg(
  client?: SupabaseClient,
): Promise<CurrentOrg | null> {
  const supabase = client ?? (await createClient());

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  const { data, error } = await supabase
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", user.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Failed to resolve current organization:", error);
    return null;
  }
  if (!data) {
    return null;
  }

  return { organizationId: data.organization_id, role: data.role as OrgRole };
}
