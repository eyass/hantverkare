// Heuristic for distinguishing "this server action call failed because the
// device is offline / lost connectivity mid-request" from a genuine
// server/AI error.
//
// Server actions ("use server" functions called from a client component) are
// invoked over an RPC-style fetch under the hood. A *returned* `{ error }`
// value from the action means the request reached the server and the server
// told us something went wrong (bad description, AI provider error, DB
// error, etc.) -- that's a genuine error and must surface immediately.
// A *thrown* exception at the call site, on the other hand, generally means
// the request never completed a round trip at all (DNS/connection failure),
// which is exactly the offline case we want to queue-and-retry instead of
// showing as a hard failure.
//
// This is a heuristic, not a certainty -- browsers don't give us a typed
// "network error" the way Node does. We combine two signals: (1) the
// browser's own connectivity flag at the moment of failure, and (2) the
// well-known error message shapes browsers use for fetch/network failures.
// Requiring signal (1) OR a recognized message from (2) keeps this from
// swallowing unrelated bugs (e.g. a TypeError thrown by our own code) as
// silently-queued "offline" errors.

const NETWORK_ERROR_MESSAGE_PATTERNS = [
  /failed to fetch/i, // Chrome/Chromium
  /networkerror when attempting to fetch/i, // Firefox
  /load failed/i, // Safari
  /network request failed/i, // React Native / some polyfills
  /the internet connection appears to be offline/i, // Safari (alt wording)
];

/**
 * A well-formed Next.js `redirect()` call throws a special control-flow
 * error (digest starting with "NEXT_REDIRECT") that must always propagate
 * -- it's how a successful submission navigates to the new quote. Never
 * treat this as an offline/network error.
 */
export function isNextRedirectError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "digest" in err &&
    typeof (err as { digest: unknown }).digest === "string" &&
    (err as { digest: string }).digest.startsWith("NEXT_REDIRECT")
  );
}

export function isOfflineNetworkError(err: unknown, isOnline: boolean): boolean {
  if (isNextRedirectError(err)) return false;
  if (!(err instanceof Error)) return false;
  if (!isOnline) return true;
  return NETWORK_ERROR_MESSAGE_PATTERNS.some((pattern) => pattern.test(err.message));
}
