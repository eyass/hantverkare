// Initiates the Google Calendar OAuth flow (issue #166). Owner-only, same
// gate as the rest of team/integration management (canManageTeam).
//
// A random nonce is set as an httpOnly cookie and echoed back inside the
// OAuth `state` param; the callback route below compares the two as CSRF
// protection on the redirect-back leg of the flow (state alone, without
// something tying it to *this* browser, would let an attacker trick a
// signed-in owner into linking the attacker's own Google account).

import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/organizations/getCurrentOrg";
import { canManageTeam } from "@/lib/organizations/permissions";
import { buildGoogleAuthUrl, isGoogleCalendarConfigured } from "@/lib/integrations/googleCalendar/client";

export const OAUTH_STATE_COOKIE = "google_calendar_oauth_state";

export async function GET() {
  if (!isGoogleCalendarConfigured()) {
    return NextResponse.redirect(
      new URL(
        "/settings/integrations?error=not_configured",
        process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
      ),
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.redirect(
      new URL("/login", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
    );
  }

  const org = await getCurrentOrg(supabase);
  if (!org || !canManageTeam(org.role)) {
    return NextResponse.redirect(
      new URL("/settings", process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
    );
  }

  const nonce = crypto.randomUUID();
  const state = `${org.organizationId}:${nonce}`;

  const cookieStore = await cookies();
  cookieStore.set(OAUTH_STATE_COOKIE, nonce, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600, // 10 minutes -- plenty for a consent-screen round trip
    path: "/",
  });

  return NextResponse.redirect(buildGoogleAuthUrl(state));
}
