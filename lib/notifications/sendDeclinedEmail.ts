// Sends a "your quote was declined" notification email to the tradesperson via
// Resend's REST API, mirroring lib/notifications/sendSignedEmail.ts's plain-fetch
// pattern exactly. This is a best-effort side effect: it must NEVER throw, so a
// failure here can never break the customer-facing decline flow that calls it.
type SendDeclinedNotificationInput = {
  toEmail: string;
  quoteDescription: string;
  quoteId: string;
  declineReason: string | null;
};

function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}...` : text;
}

export async function sendDeclinedNotification({
  toEmail,
  quoteDescription,
  quoteId,
  declineReason,
}: SendDeclinedNotificationInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("Failed to send declined-quote notification: RESEND_API_KEY is not set");
    return;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const quoteUrl = `${siteUrl}/quotes/${quoteId}`;
  const descriptionSnippet = truncate(quoteDescription, 200);
  const reasonLine = declineReason ? `\n\nGrund: ${truncate(declineReason, 500)}` : "";

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
        subject: "Ihr Angebot wurde abgelehnt",
        text: `Ein Kunde hat Ihr Angebot abgelehnt.\n\nAuftrag: ${descriptionSnippet}${reasonLine}\n\nAngebot ansehen: ${quoteUrl}`,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error("Failed to send declined-quote notification:", response.status, body);
    }
  } catch (err) {
    console.error("Failed to send declined-quote notification:", err);
  }
}
