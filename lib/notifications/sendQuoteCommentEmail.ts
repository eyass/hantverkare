// Sends a "customer left a comment/question on your quote" notification email to the
// tradesperson via Resend's REST API, mirroring lib/notifications/sendDeclinedEmail.ts's
// plain-fetch pattern exactly. This is a best-effort side effect: it must NEVER throw,
// so a failure here can never break the customer-facing comment flow that calls it.
type SendQuoteCommentNotificationInput = {
  toEmail: string;
  quoteDescription: string;
  quoteId: string;
  commentBody: string;
};

function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}...` : text;
}

export async function sendQuoteCommentNotification({
  toEmail,
  quoteDescription,
  quoteId,
  commentBody,
}: SendQuoteCommentNotificationInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("Failed to send quote-comment notification: RESEND_API_KEY is not set");
    return;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const quoteUrl = `${siteUrl}/quotes/${quoteId}`;
  const descriptionSnippet = truncate(quoteDescription, 200);
  const commentSnippet = truncate(commentBody, 500);

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
        subject: "Neue Frage zu Ihrem Angebot",
        text: `Ein Kunde hat eine Frage zu Ihrem Angebot hinterlassen.\n\nAuftrag: ${descriptionSnippet}\n\nFrage: ${commentSnippet}\n\nAngebot ansehen: ${quoteUrl}`,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error("Failed to send quote-comment notification:", response.status, body);
    }
  } catch (err) {
    console.error("Failed to send quote-comment notification:", err);
  }
}
