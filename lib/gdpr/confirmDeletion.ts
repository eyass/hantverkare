// Pure validation for the "type the organization name to confirm" destructive
// delete pattern -- kept separate from the Server Action so it's trivially
// unit-testable (same pattern as lib/organizations/permissions.ts).
//
// Exact match (trimmed) is intentional: the point of this control is to force
// the user to consciously read and retype the org name, not to be lenient.
export function confirmationMatches(orgName: string, typedValue: string): boolean {
  return typedValue.trim() === orgName.trim() && orgName.trim().length > 0;
}
