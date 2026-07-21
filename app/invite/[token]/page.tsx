import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0f172a] p-6">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl">
        {children}
      </div>
    </div>
  );
}

/**
 * Accept-invite landing page.
 *
 * The token is the unguessable capability, looked up via the service-role admin
 * client (same model as quotes' share_token). Access-control decisions are made
 * entirely server-side here:
 *   - the org to join comes from the invite row (never from client input),
 *   - the role is hardcoded 'member' (an invitee can never become an owner),
 *   - the invitee's identity must match the invited email.
 *
 * Auth reuses the existing magic-link flow: a logged-out visitor is sent to
 * /login?next=/invite/[token], so after signing in they land right back here.
 */
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: invite } = await admin
    .from("organization_invites")
    .select("id, organization_id, email, accepted_at")
    .eq("token", token)
    .maybeSingle();

  if (!invite) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold text-[#0f172a]">Einladung ungültig</h1>
        <p className="mt-4 text-sm text-[#64748b]">
          Diese Einladung existiert nicht oder wurde zurückgezogen.
        </p>
      </Shell>
    );
  }

  // Not logged in yet -> send through the existing magic-link login, returning
  // here afterwards. No separate signup form.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  }

  // The signed-in account must match the invited email, otherwise a leaked link
  // could add the wrong person.
  const invitedEmail = invite.email.trim().toLowerCase();
  const userEmail = (user.email ?? "").trim().toLowerCase();
  if (userEmail !== invitedEmail) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold text-[#0f172a]">Falsches Konto</h1>
        <p className="mt-4 text-sm text-[#64748b]">
          Diese Einladung wurde an {invite.email} gesendet, du bist aber als{" "}
          {user.email} angemeldet. Bitte melde dich mit der eingeladenen
          E-Mail-Adresse an.
        </p>
      </Shell>
    );
  }

  // Idempotent: if already a member of this org, just go into the app.
  const { data: existingMembership } = await admin
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", invite.organization_id)
    .eq("user_id", user.id)
    .maybeSingle();

  // This app assumes exactly one organization per user (no org switcher, no
  // multi-org UI -- see docs/superpowers/specs/2026-07-22-multi-user-teams-design.md).
  // Accepting a second invite while already belonging to a different org would
  // silently create an inconsistent multi-membership state (e.g. getCurrentOrg()
  // and next_invoice_number() could then resolve to different orgs for the same
  // user). Block it here rather than allowing that state to exist at all.
  if (!existingMembership) {
    const { data: anyMembership } = await admin
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (anyMembership && anyMembership.organization_id !== invite.organization_id) {
      return (
        <Shell>
          <h1 className="text-xl font-semibold text-[#0f172a]">Bereits in einem Unternehmen</h1>
          <p className="mt-4 text-sm text-[#64748b]">
            Dein Konto ({user.email}) gehört bereits zu einem anderen Unternehmen.
            Ein Konto kann derzeit nur einem Unternehmen angehören. Bitte melde
            dich mit einer anderen E-Mail-Adresse an, um dieser Einladung zu
            folgen.
          </p>
        </Shell>
      );
    }
  }

  if (!existingMembership) {
    const { error: memberError } = await admin
      .from("organization_members")
      .insert({
        organization_id: invite.organization_id,
        user_id: user.id,
        role: "member",
      });
    // Ignore a unique-violation race (already added by a concurrent request);
    // surface anything else.
    if (memberError && memberError.code !== "23505") {
      console.error("Failed to accept invite:", memberError);
      return (
        <Shell>
          <h1 className="text-xl font-semibold text-[#0f172a]">Etwas ist schiefgelaufen</h1>
          <p className="mt-4 text-sm text-[#64748b]">
            Die Einladung konnte nicht angenommen werden. Bitte versuche es
            erneut.
          </p>
          <Link href={`/invite/${token}`} className="mt-6 inline-block text-sm text-[#2563eb] underline">
            Erneut versuchen
          </Link>
        </Shell>
      );
    }
  }

  if (!invite.accepted_at) {
    await admin
      .from("organization_invites")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invite.id);
  }

  redirect("/quotes");
}
