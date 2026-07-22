import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/logout/actions";
import { AppShell } from "@/components/AppShell";
import { ensureTrialStarted } from "@/lib/billing/ensureTrial";
import { shouldGateAccess } from "@/lib/billing/gating";
import { ensureOrganization } from "@/lib/organizations/ensureOrganization";
import { getUserLanguage } from "@/lib/i18n/getUserLanguage";
import { AppLanguageProvider } from "@/lib/i18n/AppLanguageProvider";

export default async function AuthenticatedLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // This layout does its own auth check rather than relying on middleware --
  // lib/supabase/middleware.ts's proxy only gates /quotes and /price-list
  // (its PROTECTED_PREFIXES), not the (app) group in general. This check, and
  // the early return below, are what actually keep an unauthenticated or
  // just-signed-out user from reaching ensureOrganization() below (see e.g.
  // the post-delete flow in settings/danger-zone/actions.ts, which relies on
  // this early return, not on proxy.ts, to prevent org re-creation).
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
  //
  // This check must fail CLOSED: if the AAL lookup itself errors out (network
  // blip, transient Supabase issue, rate limit, etc.) we cannot conclude the
  // user has satisfied any step-up requirement, so we treat that the same as
  // "must step up" rather than silently letting the request through. This is
  // safe for users with no enrolled factor too: /mfa-challenge performs its
  // own AAL check and immediately redirects them on to `next` when there's
  // nothing to challenge (including on its own transient errors), so routing
  // everyone through it here does not risk locking out non-MFA users.
  const { data: aal, error: aalError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aalError || !aal || aal.nextLevel !== aal.currentLevel) {
    if (aalError) {
      console.error("Failed to get authenticator assurance level:", aalError);
    }
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
  // billing is now per-organization. The referral_code cookie (issue #79,
  // set by app/login/actions.ts when the magic link was requested via
  // /login?ref=CODE) is only ever consulted by ensureOrganization on its
  // brand-new-org path -- it's a no-op for every existing user. We
  // deliberately do not clear the cookie here: Server Components cannot set
  // cookies (only Server Actions/Route Handlers can), and there is no
  // correctness need to -- ensureOrganization only records a referral once,
  // the very first time an org is created for this user, ever.
  const referralCode = (await cookies()).get("referral_code")?.value ?? null;
  const org = await ensureOrganization(user.id, referralCode);
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

  // Issue #116: resolve the signed-in user's UI language preference here
  // (server-side, alongside the auth/AAL/billing checks above) and seed the
  // client AppLanguageProvider with it -- avoids a flash-of-wrong-language
  // that a client-only localStorage approach (like the marketing site's)
  // would have on first paint for a signed-in user.
  const initialLanguage = await getUserLanguage(supabase);

  return (
    <AppLanguageProvider initialLanguage={initialLanguage}>
      <AppShell email={user.email ?? ""} role={org.role} signOutAction={signOut}>
        {children}
      </AppShell>
    </AppLanguageProvider>
  );
}
