import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/logout/actions";
import { AppShell } from "@/components/AppShell";

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

  return (
    <AppShell email={user.email ?? ""} signOutAction={signOut}>
      {children}
    </AppShell>
  );
}
