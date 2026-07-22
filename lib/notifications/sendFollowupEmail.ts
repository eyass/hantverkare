// Sends the AI-drafted (and tradesperson-reviewed/edited) follow-up nudge for
// a stalled quote to the customer, via Resend's REST API -- mirrors
// lib/notifications/sendExpiryReminderEmail.ts's plain-fetch pattern exactly.
// Triggered on demand from the /quotes list's stalled-quotes section (see
// app/(app)/quotes/followup-actions.ts), never from a cron, so this is a
// one-shot send rather than something that needs a "sent_at" dedupe guard.
// Best-effort: it must NEVER throw, so a failed send surfaces as a normal
// action error rather than crashing the request.
type SendFollowupEmailInput = {
  toEmail: string;
  message: string;
  quoteId: string;
  shareToken: string | null | undefined;
};

export async function sendFollowupEmail({
  toEmail,
  message,
  quoteId,
  shareToken,
}: SendFollowupEmailInput): Promise<{ error: string | null }> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("Failed to send follow-up nudge: RESEND_API_KEY is not set");
    return { error: "E-Mail-Versand ist nicht konfiguriert." };
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const quoteUrl = shareToken ? `${siteUrl}/q/${shareToken}` : `${siteUrl}/quotes/${quoteId}`;
  const subject = "Kurzes Update zu Ihrem Angebot";
  const text = `${message}\n\nAngebot ansehen: ${quoteUrl}`;

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
        subject,
        text,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error("Failed to send follow-up nudge:", response.status, body);
      return { error: "Nachricht konnte nicht gesendet werden." };
    }
  } catch (err) {
    console.error("Failed to send follow-up nudge:", err);
    return { error: "Nachricht konnte nicht gesendet werden." };
  }

  return { error: null };
}
