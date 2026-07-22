// Sends a "your quote is about to expire" reminder email via Resend's REST
// API, mirroring lib/notifications/sendSignedEmail.ts's plain-fetch pattern
// exactly. Called from the expiry-reminder cron
// (app/api/cron/quote-expiry-reminders/route.ts) for both the tradesperson
// (always) and the customer (when we have an email on file). This is a
// best-effort side effect: it must NEVER throw, so one failed send can never
// stop the cron from processing the rest of the batch.
type SendExpiryReminderInput = {
  toEmail: string;
  audience: "owner" | "customer";
  quoteDescription: string;
  quoteId: string;
  daysUntilExpiry: number;
  shareToken?: string | null;
};

function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}...` : text;
}

function expiryPhrase(days: number): string {
  if (days <= 0) return "heute";
  if (days === 1) return "morgen";
  return `in ${days} Tagen`;
}

export async function sendExpiryReminderEmail({
  toEmail,
  audience,
  quoteDescription,
  quoteId,
  daysUntilExpiry,
  shareToken,
}: SendExpiryReminderInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("Failed to send expiry-reminder notification: RESEND_API_KEY is not set");
    return;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const descriptionSnippet = truncate(quoteDescription, 200);
  const when = expiryPhrase(daysUntilExpiry);

  const subject = "Ihr Angebot läuft bald ab";
  const text =
    audience === "owner"
      ? `Ihr Angebot an einen Kunden läuft ${when} ab und wurde noch nicht signiert.\n\nAuftrag: ${descriptionSnippet}\n\nAngebot ansehen: ${siteUrl}/quotes/${quoteId}`
      : `Ihr Angebot läuft ${when} ab. Bitte prüfen und signieren Sie es rechtzeitig.\n\nAuftrag: ${descriptionSnippet}\n\nAngebot ansehen: ${siteUrl}/q/${shareToken ?? ""}`;

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
      console.error("Failed to send expiry-reminder notification:", response.status, body);
    }
  } catch (err) {
    console.error("Failed to send expiry-reminder notification:", err);
  }
}
