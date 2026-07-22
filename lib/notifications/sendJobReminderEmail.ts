// Sends a "your job is scheduled for tomorrow" reminder email via Resend's
// REST API, mirroring lib/notifications/sendExpiryReminderEmail.ts's
// plain-fetch pattern exactly. Called from the day-before job-reminder cron
// (app/api/cron/job-reminders/route.ts) for the customer on file for the
// underlying quote. This is a best-effort side effect: it must NEVER throw,
// so one failed send can never stop the cron from processing the rest of
// the batch.
type SendJobReminderInput = {
  toEmail: string;
  quoteDescription: string;
  quoteId: string;
  scheduledStart: string; // ISO string
};

function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}...` : text;
}

function formatSlot(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export async function sendJobReminderEmail({
  toEmail,
  quoteDescription,
  quoteId,
  scheduledStart,
}: SendJobReminderInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("Failed to send job-reminder notification: RESEND_API_KEY is not set");
    return;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const descriptionSnippet = truncate(quoteDescription, 200);
  const when = formatSlot(scheduledStart);

  const subject = "Ihr Termin ist morgen";
  const text = `Ihr Termin ist morgen, ${when}.\n\nAuftrag: ${descriptionSnippet}\n\nAngebot ansehen: ${siteUrl}/quotes/${quoteId}`;

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
      console.error("Failed to send job-reminder notification:", response.status, body);
    }
  } catch (err) {
    console.error("Failed to send job-reminder notification:", err);
  }
}
