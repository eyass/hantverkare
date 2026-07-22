import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/logout/actions";
import { AppShell } from "@/components/AppShell";
import { ensureTrialStarted } from "@/lib/billing/ensureTrial";
import { shouldGateAccess } from "@/lib/billing/gating";
import { ensureOrganization } from "@/lib/organizations/ensureOrganization";

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

  // Optional TOTP 2FA step-up gate. If this user has a verified TOTP factor
  // enrolled, Supabase requires the session to reach aal2 (second factor)
  // before it's fully authenticated -- a magic-link sign-in only ever grants
  // aal1. `getAuthenticatorAssuranceLevel` reports both the session's
  // currentLevel and the nextLevel it could step up to; when they differ,
  // the user has an unmet step-up requirement and must be sent to the
  // dedicated /mfa-challenge page (outside this layout group, so it renders
  // without the app shell) before reaching ANY route under this layout --
  // this is the sole enforcement point for the second factor, so it must
  // run unconditionally here, before the billing gate below. Users with no
  // enrolled factor see currentLevel === nextLevel === 'aal1' and are
  // completely unaffected, per the feature being opt-in.
  const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalError) {
    console.error("Failed to get authenticator assurance level:", aalError);
  }
  if (aal && aal.nextLevel !== aal.currentLevel) {
    const pathnameForChallenge = (await headers()).get("x-pathname") ?? "/price-list";
    redirect(`/mfa-challenge?next=${encodeURIComponent(pathnameForChallenge)}`);
  }

  // Stripe subscription gate. /billing must always be reachable -- otherwise a
  // gated user could never reach the page that lets them subscribe -- so we
  // read the current pathname (forwarded by proxy.ts as `x-pathname`, since
  // Server Components have no direct pathname API) and skip the redirect
  // there.
  const pathname = (await headers()).get("x-pathname") ?? "";
  const isBillingRoute = pathname === "/billing" || pathname.startsWith("/billing/");

  // Resolve (or create, for a brand-new signup) the user's organization before
  // anything else -- it's the scoping key everything downstream relies on, and
  // billing is now per-organization.
  const org = await ensureOrganization(user.id);
  if (!org) {
    // Could not establish an org (e.g. transient DB error). Render without the
    // shell rather than crashing; the next request retries.
    return children;
  }

  const billingState = await ensureTrialStarted(org.organizationId);

  if (!isBillingRoute && shouldGateAccess({
    subscriptionStatus: billingState.subscriptionStatus,
    trialEndsAt: billingState.trialEndsAt,
  })) {
    redirect("/billing");
  }

  return (
    <AppShell email={user.email ?? ""} role={org.role} signOutAction={signOut}>
      {children}
    </AppShell>
  );
}
