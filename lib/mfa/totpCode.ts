/**
 * Normalizes user input for a TOTP verification code before it is sent to
 * Supabase's MFA verify/challengeAndVerify APIs.
 *
 * Strips whitespace (authenticator apps and users often group digits, e.g.
 * "123 456") and validates that the result is exactly 6 digits. Returns null
 * for anything that isn't a valid 6-digit code so callers can show a
 * validation error without making a network request.
 */
export function normalizeTotpCode(input: string): string | null {
  const stripped = input.replace(/\s+/g, "");
  return /^\d{6}$/.test(stripped) ? stripped : null;
}
