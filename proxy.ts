import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  const sessionResponse = await updateSession(request);

  // If updateSession issued a redirect (e.g. unauthenticated -> /login),
  // pass it through unchanged.
  if (sessionResponse.headers.get("location")) {
    return sessionResponse;
  }

  // Forward the request pathname as a header so server components (notably
  // app/(app)/layout.tsx) can tell whether the current route is /billing
  // without needing a client-side pathname hook -- used by the Stripe
  // billing subscription gate so /billing itself is never redirected to
  // /billing.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", request.nextUrl.pathname);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  sessionResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
