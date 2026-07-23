// Thin Google Calendar API client (issue #166). Deliberately hand-rolled
// against the plain REST/OAuth endpoints via fetch rather than pulling in the
// `googleapis` package -- we only need three calls (token exchange, token
// refresh, and event create/update/delete), and that's a lot smaller than a
// full SDK dependency for a v1 one-way sync.
//
// Required env vars (see .env.example for the human setup steps):
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
//
// Server-only. Never import from a client component -- GOOGLE_CLIENT_SECRET
// and refresh tokens must never reach the browser bundle.

const GOOGLE_OAUTH_AUTHORIZE_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_OAUTH_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API_BASE = "https://www.googleapis.com/calendar/v3";

// calendar.events is the narrowest scope that lets us create/update/delete
// events without also granting read/write on the rest of the user's Calendar
// settings -- least-privilege for what a one-way job sync actually needs.
const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.events";

function getOAuthCredentials(): { clientId: string; clientSecret: string } | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return null;
  }
  return { clientId, clientSecret };
}

/** Whether the Google Calendar integration is configured at all (env vars set). */
export function isGoogleCalendarConfigured(): boolean {
  return getOAuthCredentials() !== null;
}

function getRedirectUri(): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return `${siteUrl}/api/integrations/google-calendar/callback`;
}

/**
 * Builds the URL to send the browser to for the Google OAuth consent screen.
 * `state` should be an unguessable value tying the callback back to the
 * initiating organization (see the connect route) -- Google echoes it back
 * verbatim on the callback redirect.
 */
export function buildGoogleAuthUrl(state: string): string {
  const credentials = getOAuthCredentials();
  if (!credentials) {
    throw new Error("GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET are not set.");
  }

  const params = new URLSearchParams({
    client_id: credentials.clientId,
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: GOOGLE_CALENDAR_SCOPE,
    access_type: "offline", // required to get a refresh_token back
    prompt: "consent", // forces a refresh_token on every connect, even re-connects
    state,
  });
  return `${GOOGLE_OAUTH_AUTHORIZE_URL}?${params.toString()}`;
}

/** Exchanges an OAuth authorization code for tokens. Returns null on failure. */
export async function exchangeCodeForRefreshToken(
  code: string,
): Promise<{ refreshToken: string } | null> {
  const credentials = getOAuthCredentials();
  if (!credentials) {
    console.error("Google Calendar: OAuth credentials are not configured.");
    return null;
  }

  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      redirect_uri: getRedirectUri(),
      grant_type: "authorization_code",
    }),
  });

  if (!response.ok) {
    console.error("Google Calendar: token exchange failed:", await response.text());
    return null;
  }

  const data = (await response.json()) as { refresh_token?: string };
  if (!data.refresh_token) {
    // Google only returns a refresh_token the first time a user consents (or
    // when prompt=consent forces re-consent, which buildGoogleAuthUrl above
    // always sets) -- if it's still missing here something is wrong upstream.
    console.error("Google Calendar: token exchange response had no refresh_token.");
    return null;
  }

  return { refreshToken: data.refresh_token };
}

/**
 * Exchanges a stored refresh token for a fresh, short-lived access token.
 * Called on every sync -- access tokens are not persisted anywhere, only the
 * long-lived refresh token is, so there's no expiry bookkeeping to get wrong.
 */
async function getAccessToken(refreshToken: string): Promise<string | null> {
  const credentials = getOAuthCredentials();
  if (!credentials) {
    console.error("Google Calendar: OAuth credentials are not configured.");
    return null;
  }

  const response = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
      client_id: credentials.clientId,
      client_secret: credentials.clientSecret,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    console.error("Google Calendar: access token refresh failed:", await response.text());
    return null;
  }

  const data = (await response.json()) as { access_token?: string };
  return data.access_token ?? null;
}

export type GoogleCalendarEventInput = {
  summary: string;
  description?: string | null;
  startIso: string;
  endIso: string;
};

/**
 * Creates or updates (if `existingEventId` is given) an event on the given
 * calendar. Returns the Google event id on success, null on any failure --
 * callers treat this as best-effort and must never let a Google API outage
 * block the app's own scheduling action.
 */
export async function upsertGoogleCalendarEvent(
  refreshToken: string,
  calendarId: string,
  event: GoogleCalendarEventInput,
  existingEventId?: string | null,
): Promise<string | null> {
  const accessToken = await getAccessToken(refreshToken);
  if (!accessToken) {
    return null;
  }

  const isUpdate = Boolean(existingEventId);
  const url = isUpdate
    ? `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(existingEventId!)}`
    : `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events`;

  const response = await fetch(url, {
    method: isUpdate ? "PATCH" : "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      summary: event.summary,
      description: event.description ?? undefined,
      start: { dateTime: event.startIso },
      end: { dateTime: event.endIso },
    }),
  });

  if (!response.ok) {
    console.error(
      `Google Calendar: event ${isUpdate ? "update" : "create"} failed:`,
      await response.text(),
    );
    // If the event we tried to PATCH no longer exists on the Google side
    // (deleted by hand in Google Calendar), fall through to creating a fresh
    // one instead of leaving the job permanently unsynced.
    if (isUpdate && response.status === 404) {
      return upsertGoogleCalendarEvent(refreshToken, calendarId, event, null);
    }
    return null;
  }

  const data = (await response.json()) as { id?: string };
  return data.id ?? null;
}

/** Deletes an event. Best-effort: a 404 (already gone) is treated as success. */
export async function deleteGoogleCalendarEvent(
  refreshToken: string,
  calendarId: string,
  eventId: string,
): Promise<boolean> {
  const accessToken = await getAccessToken(refreshToken);
  if (!accessToken) {
    return false;
  }

  const response = await fetch(
    `${GOOGLE_CALENDAR_API_BASE}/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!response.ok && response.status !== 404 && response.status !== 410) {
    console.error("Google Calendar: event delete failed:", await response.text());
    return false;
  }
  return true;
}
