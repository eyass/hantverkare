// Sends the automated review-request email to a customer some days after
// their invoice is marked paid (issue #157), via Resend's REST API -- same
// plain-fetch pattern as sendDunningEmail.ts/sendSignedNotification.ts.
// Best-effort: this must NEVER throw, so a failed send can never break the
// review-request cron's processing of the rest of the batch.
type SendReviewRequestEmailInput = {
  toEmail: string;
  organizationName: string | null;
  invoiceNumber: string;
  reviewPlatformUrl: string;
};

export async function sendReviewRequestEmail({
  toEmail,
  organizationName,
  invoiceNumber,
  reviewPlatformUrl,
}: SendReviewRequestEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("Failed to send review-request notification: RESEND_API_KEY is not set");
    return;
  }

  const senderName = organizationName?.trim() || "Ihr Handwerksbetrieb";

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
        subject: `Wie war's? Ihre Meinung ist uns wichtig`,
        text:
          `Guten Tag,\n\n` +
          `vielen Dank für die Begleichung von Rechnung ${invoiceNumber}. Wir hoffen, Sie ` +
          `waren mit unserer Arbeit zufrieden!\n\n` +
          `Wenn Sie kurz Zeit haben, würden wir uns sehr über eine Bewertung freuen -- das ` +
          `hilft uns und anderen Kunden weiter:\n${reviewPlatformUrl}\n\n` +
          `Vielen Dank und viele Grüße\n${senderName}`,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error("Failed to send review-request notification:", response.status, body);
    }
  } catch (err) {
    console.error("Failed to send review-request notification:", err);
  }
}
