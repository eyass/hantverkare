import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { MfaChallengeForm } from "./MfaChallengeForm";

function safeNextPath(next: string | undefined): string {
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    return next;
  }
  return "/price-list";
}

export default async function MfaChallengePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: aal, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (error) {
    console.error("Failed to get authenticator assurance level:", error);
  }

  // Nothing to challenge: either no factor is enrolled, or the session
  // already satisfies aal2 (e.g. the user reloads this page after
  // completing the challenge). Send them on rather than showing a dead end.
  if (!aal || aal.nextLevel === aal.currentLevel) {
    redirect(safeNextPath((await searchParams).next));
  }

  const { next } = await searchParams;
  return <MfaChallengeForm next={safeNextPath(next)} />;
}
