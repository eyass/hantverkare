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

/**
 * Issue #52: owners can restrict members from deleting customers, viewing
 * invoices, and editing business settings. Each of these is now gated by an
 * org-level boolean setting (see organizations.members_can_* columns from
 * 0014_team_permissions.sql), in addition to role.
 *
 * Owners can always perform these actions regardless of the org setting --
 * an owner can never lock themselves out. Members are allowed only when the
 * org setting explicitly permits it. Fails closed: any unrecognized/undefined
 * role, or a missing/non-true setting value, is treated as NOT allowed.
 */
export function canDeleteCustomers(
  role: OrgRole | null | undefined,
  membersCanDeleteCustomers: boolean,
): boolean {
  if (role === "owner") return true;
  return role === "member" && membersCanDeleteCustomers === true;
}

/**
 * Governs viewing of the organization's invoices (customer-facing invoice
 * documents) -- NOT the Stripe subscription/billing row, which stays
 * hardcoded owner-only via canViewBilling above regardless of this setting.
 */
export function canViewInvoices(
  role: OrgRole | null | undefined,
  membersCanViewInvoices: boolean,
): boolean {
  if (role === "owner") return true;
  return role === "member" && membersCanViewInvoices === true;
}

export function canEditBusinessSettings(
  role: OrgRole | null | undefined,
  membersCanEditBusinessSettings: boolean,
): boolean {
  if (role === "owner") return true;
  return role === "member" && membersCanEditBusinessSettings === true;
}
