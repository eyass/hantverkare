import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/logout/actions";
import { AppShell } from "@/components/AppShell";
import { ensureTrialStarted } from "@/lib/billing/ensureTrial";
import { shouldGateAccess } from "@/lib/billing/gating";

export default async function AuthenticatedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // proxy.ts already redirects unauthenticated requests to /login for every route
  // under this group, so `user` is expected to exist here. If it's somehow absent
  // (e.g. a race with an expired session), render children without the shell rather
  // than crashing -- the page itself will redirect via its own auth check on the
  // next request.
  if (!user) {
    return children;
  }

  // Stripe subscription gate. /billing must always be reachable -- otherwise a
  // gated user could never reach the page that lets them subscribe -- so we
  // read the current pathname (forwarded by proxy.ts as `x-pathname`, since
  // Server Components have no direct pathname API) and skip the redirect
  // there.
  const pathname = (await headers()).get("x-pathname") ?? "";
  const isBillingRoute = pathname === "/billing" || pathname.startsWith("/billing/");

  const billingState = await ensureTrialStarted(user.id);

  if (!isBillingRoute && shouldGateAccess({
    subscriptionStatus: billingState.subscriptionStatus,
    trialEndsAt: billingState.trialEndsAt,
  })) {
    redirect("/billing");
  }

  return (
    <AppShell email={user.email ?? ""} signOutAction={signOut}>
      {children}
    </AppShell>
  );
}
