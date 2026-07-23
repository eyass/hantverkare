// OAuth callback for Google Calendar (issue #166). Google redirects the
// browser here with either `code` (success) or `error` (user declined/other
// failure) plus the `state` we handed it in the connect route.

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrg } from "@/lib/organizations/getCurrentOrg";
import { canManageTeam } from "@/lib/organizations/permissions";
import { exchangeCodeForRefreshToken } from "@/lib/integrations/googleCalendar/client";
import { OAUTH_STATE_COOKIE } from "../connect/route";

function redirectToSettings(query: string) {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  return NextResponse.redirect(new URL(`/settings/integrations?${query}`, siteUrl));
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const cookieStore = await cookies();
  const expectedNonce = cookieStore.get(OAUTH_STATE_COOKIE)?.value;
  // Consume the state cookie either way -- it's single-use.
  cookieStore.delete(OAUTH_STATE_COOKIE);

  if (oauthError) {
    // The tradesperson declined consent, or Google returned some other
    // error -- not a bug, just a normal "didn't connect" outcome.
    return redirectToSettings("error=google_declined");
  }

  if (!code || !state) {
    return redirectToSettings("error=invalid_callback");
  }

  const [stateOrgId, stateNonce] = state.split(":");
  if (!stateOrgId || !stateNonce || !expectedNonce || stateNonce !== expectedNonce) {
    console.error("Google Calendar callback: state/nonce mismatch (possible CSRF attempt).");
    return redirectToSettings("error=invalid_state");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return redirectToSettings("error=not_signed_in");
  }

  const org = await getCurrentOrg(supabase);
  if (!org || !canManageTeam(org.role) || org.organizationId !== stateOrgId) {
    // The org the callback's state refers to no longer matches who's signed
    // in (e.g. they switched accounts mid-flow) -- refuse rather than link
    // the wrong org's Google account.
    return redirectToSettings("error=org_mismatch");
  }

  const tokenResult = await exchangeCodeForRefreshToken(code);
  if (!tokenResult) {
    return redirectToSettings("error=token_exchange_failed");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("organizations")
    .update({ google_calendar_refresh_token: tokenResult.refreshToken })
    .eq("id", org.organizationId);

  if (error) {
    console.error("Google Calendar callback: failed to save refresh token:", error);
    return redirectToSettings("error=save_failed");
  }

  return redirectToSettings("connected=1");
}
