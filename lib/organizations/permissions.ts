// Pure role-based permission logic, kept separate from DB/action code so it's
// trivially unit-testable (same pattern as lib/billing/gating.ts). Server
// Actions call these to enforce owner-only operations server-side -- never rely
// on merely hiding UI, since a client can invoke a Server Action directly.

export type OrgRole = "owner" | "member";

/**
 * Only owners may invite/remove members and view billing (per the v1 role
 * model). Everything else (quotes, customers, price list) is allowed for any
 * member and is not gated by this function.
 *
 * Fails closed: any unrecognized/undefined role is treated as NOT an owner.
 */
export function canManageTeam(role: OrgRole | null | undefined): boolean {
  return role === "owner";
}

/** Alias for the billing-visibility gate -- same rule as team management. */
export function canViewBilling(role: OrgRole | null | undefined): boolean {
  return role === "owner";
}
