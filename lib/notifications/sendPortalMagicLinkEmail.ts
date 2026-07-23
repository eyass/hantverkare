// Sends the customer-portal magic-link email via Resend's REST API,
// mirroring lib/notifications/sendInviteEmail.ts's plain-fetch pattern
// exactly. Best-effort: must NEVER throw, so a mail failure can't break the
// /portal/request Server Action that calls it (see
// app/portal/request/actions.ts, which always returns the same generic
// message to the browser regardless of whether a send happened, to avoid
// leaking whether an email matched a customer record).
type SendPortalMagicLinkEmailInput = {
  toEmail: string;
  portalUrl: string;
};

export async function sendPortalMagicLinkEmail({ toEmail, portalUrl }: SendPortalMagicLinkEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("Failed to send portal magic-link email: RESEND_API_KEY is not set");
    return;
  }

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
        subject: "Ihr Zugangslink zum Kundenportal",
        text: `Mit diesem Link können Sie Ihre Angebote, Rechnungen, Termine und Gewährleistungen einsehen:\n\n${portalUrl}\n\nDer Link ist 24 Stunden gültig. Wenn Sie diese E-Mail nicht angefordert haben, können Sie sie ignorieren.`,
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error("Failed to send portal magic-link email:", response.status, body);
    }
  } catch (err) {
    console.error("Failed to send portal magic-link email:", err);
  }
}
