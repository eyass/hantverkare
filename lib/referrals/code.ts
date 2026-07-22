// Referral code generation + validation. Pure/testable: no DB access here --
// callers (ensureOrganization, the login form) own the uniqueness retry loop
// and the cookie plumbing.

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I -- avoids
// visually-ambiguous characters in a code people will read aloud or type by
// hand off a shared link.
const CODE_LENGTH = 8;

/**
 * Generates a random referral code. Not guaranteed globally unique on its
 * own -- the caller (ensureOrganization's org-creation path) must insert with
 * the unique constraint from 0019 and retry on a 23505 conflict, the same
 * pattern already used for the 23505 races in ensureOrganization/ensureTrial.
 */
export function generateReferralCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

// Accepts what generateReferralCode() produces, but validation is
// deliberately a bit looser (length 4-32, alphanumeric only) so we don't
// reject a legitimately-issued code just because the alphabet policy above
// changes later, while still rejecting obviously-garbage/hostile query-param
// input (e.g. SQL-ish strings, whitespace, path traversal attempts) before it
// ever reaches a query.
const VALID_CODE_PATTERN = /^[A-Z0-9]{4,32}$/i;

/**
 * True if `value` is well-formed enough to be looked up as a referral code.
 * Does NOT check whether the code actually exists -- that's a DB lookup left
 * to the caller. Used to sanitize the `?ref=` query param / cookie value
 * before it's ever used in a query.
 */
export function isValidReferralCodeFormat(value: string | null | undefined): value is string {
  if (!value) return false;
  return VALID_CODE_PATTERN.test(value);
}

/** Normalizes a referral code for storage/lookup (uppercase, trimmed). */
export function normalizeReferralCode(value: string): string {
  return value.trim().toUpperCase();
}
