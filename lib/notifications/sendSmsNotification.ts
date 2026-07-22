// Sends an SMS notification via Twilio's REST API (plain fetch, no SDK --
// mirrors lib/notifications/sendSignedEmail.ts's pattern exactly). This is a
// best-effort side effect: it must NEVER throw, so a Twilio outage or
// misconfiguration can never break the flow that calls it (quote signing,
// the expiry-reminder cron). Callers are responsible for checking the org's
// `sms_notifications_enabled` opt-in toggle (see
// organizations.sms_notifications_enabled, added in
// 0016_sms_notifications.sql) and for only calling this when a phone number
// is actually on file -- this function itself does not gate on either.

function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}...` : text;
}

type SendSmsNotificationInput = {
  toPhone: string;
  body: string;
};

export async function sendSmsNotification({
  toPhone,
  body,
}: SendSmsNotificationInput): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;

  if (!accountSid || !authToken || !fromNumber) {
    console.error(
      "Failed to send SMS notification: TWILIO_ACCOUNT_SID/TWILIO_AUTH_TOKEN/TWILIO_FROM_NUMBER are not fully set",
    );
    return;
  }

  // SMS bodies are billed per-segment; keep messages short. 300 chars is
  // generous headroom while still guarding against a runaway description.
  const message = truncate(body, 300);

  try {
    const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${credentials}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          To: toPhone,
          From: fromNumber,
          Body: message,
        }).toString(),
      },
    );

    if (!response.ok) {
      const responseBody = await response.text().catch(() => "");
      console.error("Failed to send SMS notification:", response.status, responseBody);
    }
  } catch (err) {
    console.error("Failed to send SMS notification:", err);
  }
}

/** Builds the "your quote was signed" SMS body for the tradesperson. */
export function buildSignedSmsBody(signerName: string, quoteDescription: string): string {
  const descriptionSnippet = truncate(quoteDescription, 100);
  return `${signerName} hat Ihr Angebot signiert. Auftrag: ${descriptionSnippet}`;
}

/** Builds the "your quote is about to expire" SMS body for owner or customer. */
export function buildExpiryReminderSmsBody(
  audience: "owner" | "customer",
  daysUntilExpiry: number,
  quoteDescription: string,
): string {
  const when =
    daysUntilExpiry <= 0 ? "heute" : daysUntilExpiry === 1 ? "morgen" : `in ${daysUntilExpiry} Tagen`;
  const descriptionSnippet = truncate(quoteDescription, 100);
  return audience === "owner"
    ? `Ihr Angebot an einen Kunden läuft ${when} ab und wurde noch nicht signiert. Auftrag: ${descriptionSnippet}`
    : `Ihr Angebot läuft ${when} ab. Bitte prüfen und signieren Sie es rechtzeitig. Auftrag: ${descriptionSnippet}`;
}

/** Builds the SMS body for each stage of the automated Mahnwesen sequence (issue #122). */
export function buildDunningSmsBody(
  stage: "reminder" | "mahnung" | "escalation",
  invoiceNumber: string,
  totalCents: number,
): string {
  const amount = (totalCents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
  if (stage === "reminder") {
    return `Zahlungserinnerung: Rechnung ${invoiceNumber} über ${amount} ist noch offen. Bitte prüfen Sie den Zahlungseingang.`;
  }
  if (stage === "mahnung") {
    return `Mahnung: Rechnung ${invoiceNumber} über ${amount} ist überfällig. Es fallen Verzugszinsen an. Bitte zeitnah begleichen.`;
  }
  return `Letzte Mahnung: Rechnung ${invoiceNumber} über ${amount} weiterhin unbeglichen. Bitte umgehend begleichen, sonst drohen weitere Schritte.`;
}
