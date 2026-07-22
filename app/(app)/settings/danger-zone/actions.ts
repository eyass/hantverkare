"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrg } from "@/lib/organizations/getCurrentOrg";
import { canManageTeam } from "@/lib/organizations/permissions";
import { confirmationMatches } from "@/lib/gdpr/confirmDeletion";

type ActionResult = { error: string | null };

/**
 * Permanently deletes the caller's organization and every row it owns (GDPR
 * Art. 17 -- Recht auf Löschung). This is the single most dangerous action in
 * the app, so it is layered with safeguards:
 *
 *  1. Owner-only: resolved from the caller's own session via getCurrentOrg /
 *     canManageTeam, never from client input. A member cannot trigger this.
 *  2. Explicit confirmation: the caller must type the exact organization name;
 *     re-verified here server-side (the client-side disabled button is only a
 *     UX nicety, not the actual gate).
 *  3. The org id being deleted is ALWAYS the id resolved by getCurrentOrg for
 *     the authenticated caller -- there is no org id parameter accepted from
 *     the client, so this can never be pointed at an arbitrary organization.
 *  4. The delete itself is a single `delete from organizations where id = $1`.
 *     Every owned table (quotes, quote_line_items, customers,
 *     price_list_items, business_settings, invoices, invoice_counters,
 *     billing) plus organization_members and organization_invites all carry
 *     `organization_id ... references organizations(id) on delete cascade`
 *     (see supabase/migrations/0010_organizations.sql), so deleting the one
 *     `organizations` row cascades through everything automatically -- no
 *     manual per-table deletes needed and nothing can be missed.
 *  5. Post-delete account/session handling: if the caller has no remaining
 *     organization membership (the v1-common case -- one org per user), we
 *     also delete their auth.users row (full Art. 17 account erasure) via the
 *     service-role admin client. Either way we sign them out so their session
 *     cookie is invalidated immediately. The caller redirects to
 *     /account-deleted, a route OUTSIDE the (app) layout group -- this matters
 *     because (app)/layout.tsx calls ensureOrganization(), which would
 *     otherwise silently enroll the now-orgless user into a brand new empty
 *     org the moment they were routed back into the app. What actually
 *     prevents that: (app)/layout.tsx calls `supabase.auth.getUser()` itself
 *     and returns early (`if (!user) return children;`) BEFORE it ever calls
 *     ensureOrganization(). Signing out here means that check fails on any
 *     subsequent (app) request, so ensureOrganization() never runs for the
 *     deleted user. (lib/supabase/middleware.ts's proxy only gates
 *     `/quotes` and `/price-list`, not `/settings` or the (app) group in
 *     general, so it is not what protects this path.)
 */
export async function deleteOrganization(
  confirmationText: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Bitte melde dich an." };
  }

  const org = await getCurrentOrg(supabase);
  if (!org) {
    return { error: "Keine Organisation gefunden." };
  }
  if (!canManageTeam(org.role)) {
    return { error: "Nur der Inhaber kann die Organisation löschen." };
  }

  const admin = createAdminClient();

  const { data: orgRow, error: orgFetchError } = await admin
    .from("organizations")
    .select("name")
    .eq("id", org.organizationId)
    .maybeSingle();
  if (orgFetchError || !orgRow) {
    console.error("Failed to load organization for deletion:", orgFetchError);
    return { error: "Organisation konnte nicht geladen werden." };
  }

  if (!confirmationMatches(orgRow.name, confirmationText)) {
    return { error: "Der eingegebene Name stimmt nicht überein." };
  }

  // The actual destructive step: cascades to every owned table (see docstring).
  const { error: deleteError } = await admin
    .from("organizations")
    .delete()
    .eq("id", org.organizationId);
  if (deleteError) {
    console.error("Failed to delete organization:", deleteError);
    return { error: "Organisation konnte nicht gelöscht werden." };
  }

  // Determine whether the caller belongs to any other organization. v1 has no
  // real multi-org-per-user flow (see getCurrentOrg's docstring), so this is
  // normally empty -- but we check rather than assume, since deleting the
  // wrong auth user would be irreversible and far worse than leaving one behind.
  const { data: remainingMemberships, error: membershipError } = await admin
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", user.id)
    .limit(1);

  if (membershipError) {
    console.error("Failed to check remaining memberships:", membershipError);
    // Non-fatal: the org itself is already gone. Fall through to sign-out.
  }

  if (!membershipError && (remainingMemberships ?? []).length === 0) {
    // No other org left -- this is a full account deletion (Art. 17).
    const { error: deleteUserError } = await admin.auth.admin.deleteUser(user.id);
    if (deleteUserError) {
      console.error("Failed to delete auth user after org deletion:", deleteUserError);
      // Not fatal for the caller-facing outcome: their data and org are
      // already gone. We still sign them out below so the stale session
      // cannot be used to re-enter the app.
    }
  }

  // Always invalidate the current session so the next (app) request fails
  // (app)/layout.tsx's own `getUser()` check and returns early, before
  // ensureOrganization() can auto-create a new org. (Not proxy.ts -- its
  // PROTECTED_PREFIXES only cover /quotes and /price-list.)
  await supabase.auth.signOut();

  redirect("/account-deleted");
}
