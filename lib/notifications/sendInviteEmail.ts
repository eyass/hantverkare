// Sends a team-invite email via Resend's REST API (plain fetch, no SDK -- same
// pattern as lib/notifications/sendSignedEmail.ts). Best-effort: it must NEVER
// throw, so a mail failure can't break the invite Server Action that calls it.
// The invite row is already persisted before this runs, so a failed send just
// means the owner can re-copy/resend the link, never a lost invite.
type SendInviteEmailInput = {
  toEmail: string;
  inviteUrl: string;
  organizationName: string | null;
};

export async function sendInviteEmail({
  toEmail,
  inviteUrl,
  organizationName,
}: SendInviteEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("Failed to send invite email: RESEND_API_KEY is not set");
    return;
  }

  const orgLabel = organizationName?.trim() ? organizationName.trim() : "einem Team";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "Hantverkare <onboarding@resend.dev>",
        to: [toEmail],
        subject: "Sie wurden zu hantverkare eingeladen",
        text: `Sie wurden eingeladen, ${orgLabel} bei hantverkare beizutreten.\n\nEinladung annehmen: ${inviteUrl}\n\nWenn Sie noch kein Konto haben, führt Sie der Link durch die Anmeldung.`,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error("Failed to send invite email:", response.status, body);
    }
  } catch (err) {
    console.error("Failed to send invite email:", err);
  }
}
