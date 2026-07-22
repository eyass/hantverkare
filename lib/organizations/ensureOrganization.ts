import { createAdminClient } from "@/lib/supabase/admin";
import type { OrgRole } from "./permissions";
import { generateReferralCode } from "@/lib/referrals/code";
import { recordReferralIfPresent } from "@/lib/referrals/recordReferral";

export type EnsuredOrg = {
  organizationId: string;
  role: OrgRole;
};

/**
 * Ensures the signed-in user belongs to an organization, creating a fresh
 * 1-person org (with the user as owner) on first touch. This is the new-user
 * analog of the 0010 backfill: existing users already have an org from the
 * migration, brand-new signups get one here.
 *
 * Hooked into the authenticated (app) layout (like ensureTrialStarted) because
 * that's the one place guaranteed to run right after a new user's first login,
 * before any page needs an org to scope by.
 *
 * organization_members / organizations have NO client-writable RLS policy at
 * all -- membership and role are only ever written here (and in the invite
 * flow), server-side, via the service-role client, with role computed in code
 * ('owner' for the creator). `userId` always comes from the caller's verified
 * session, never client input, so bypassing RLS is safe: a user can only ever
 * create/own their own org.
 *
 * Idempotent: if the user already has a membership it is returned unchanged.
 *
 * `referralCode`, if provided, is the (unvalidated, possibly garbage) value
 * of the `referral_code` cookie set by the login form (see
 * app/login/actions.ts). It is only ever consulted on the NEW-org branch
 * below -- an existing user (who already has a membership) never reaches
 * that branch, so revisiting `?ref=` with a cookie still set from a stale
 * link can never record a referral for them. This is also what makes
 * self-referral structurally impossible: recording a referral requires a
 * brand-new organization_id that, by definition, cannot equal the referrer's
 * existing organization_id.
 */
export async function ensureOrganization(
  userId: string,
  referralCode?: string | null,
): Promise<EnsuredOrg | null> {
  const admin = createAdminClient();

  const { data: existing, error: fetchError } = await admin
    .from("organization_members")
    .select("organization_id, role")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (fetchError) {
    console.error("Failed to load organization membership:", fetchError);
    return null;
  }

  if (existing) {
    return {
      organizationId: existing.organization_id,
      role: existing.role as OrgRole,
    };
  }

  // No membership yet -- create a fresh org and make this user its owner.
  // referral_code must be unique (0019); collisions are astronomically
  // unlikely for an 8-char code, but retry a few times on a 23505 conflict
  // rather than fail signup outright, mirroring the retry-on-23505 pattern
  // used below for the membership insert.
  let org: { id: string } | null = null;
  let orgError: { code?: string; message?: string } | null = null;
  for (let attempt = 0; attempt < 5 && !org; attempt += 1) {
    const { data, error } = await admin
      .from("organizations")
      .insert({ name: "Mein Unternehmen", referral_code: generateReferralCode() })
      .select("id")
      .single();
    if (data) {
      org = data;
      orgError = null;
      break;
    }
    orgError = error;
    if (error?.code !== "23505") {
      break;
    }
  }

  if (orgError || !org) {
    console.error("Failed to create organization:", orgError);
    return null;
  }

  const { error: memberError } = await admin
    .from("organization_members")
    .insert({ organization_id: org.id, user_id: userId, role: "owner" });

  if (memberError) {
    // Benign race: a concurrent first request already created a membership.
    if (memberError.code === "23505") {
      const { data: winner } = await admin
        .from("organization_members")
        .select("organization_id, role")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (winner) {
        return {
          organizationId: winner.organization_id,
          role: winner.role as OrgRole,
        };
      }
    }
    console.error("Failed to create organization membership:", memberError);
    return null;
  }

  // Best-effort; never blocks or fails signup (see recordReferralIfPresent's
  // doc comment). Only reachable here, on the brand-new-org path.
  await recordReferralIfPresent(admin, org.id, referralCode);

  return { organizationId: org.id, role: "owner" };
}
