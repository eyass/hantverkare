// Sends the three-stage Mahnwesen (dunning) email sequence via Resend's REST
// API, mirroring lib/notifications/sendExpiryReminderEmail.ts's plain-fetch
// pattern exactly. Called from the dunning cron
// (app/api/cron/invoice-dunning/route.ts) for the customer on each overdue
// invoice, once per stage. Best-effort: these must NEVER throw, so one failed
// send can never stop the cron from processing the rest of the batch.
import { calculateVerzugszinsenCents, STATUTORY_DEFAULT_INTEREST_RATE } from "@/lib/invoices/dunning";

export type DunningTone = "freundlich" | "neutral" | "streng";
export type DunningEmailStage = "reminder" | "mahnung" | "escalation";

type SendDunningEmailInput = {
  toEmail: string;
  stage: DunningEmailStage;
  tone: DunningTone;
  invoiceNumber: string;
  totalCents: number;
  overdueDays: number;
  dueDate: Date;
  invoiceId: string;
};

function formatEuros(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("de-DE");
}

function subjectFor(stage: DunningEmailStage, invoiceNumber: string): string {
  switch (stage) {
    case "reminder":
      return `Zahlungserinnerung: Rechnung ${invoiceNumber}`;
    case "mahnung":
      return `Mahnung: Rechnung ${invoiceNumber} ist überfällig`;
    case "escalation":
      return `Letzte Mahnung: Rechnung ${invoiceNumber}`;
  }
}

// Tone only changes the greeting/closing register (freundlich/neutral/streng);
// it never changes which legal facts are stated (amount owed, days overdue,
// Verzugszinsen) -- those are the same regardless of tone.
function greetingFor(tone: DunningTone): string {
  if (tone === "freundlich") return "Hallo,";
  if (tone === "streng") return "Sehr geehrte Damen und Herren,";
  return "Guten Tag,";
}

function closingFor(tone: DunningTone): string {
  if (tone === "freundlich") return "Vielen Dank und viele Grüße";
  if (tone === "streng") return "Mit freundlichen, aber bestimmten Grüßen";
  return "Mit freundlichen Grüßen";
}

function bodyFor(input: SendDunningEmailInput): string {
  const { stage, tone, invoiceNumber, totalCents, overdueDays, dueDate } = input;
  const amount = formatEuros(totalCents);
  const due = formatDate(dueDate);
  const greeting = greetingFor(tone);
  const closing = closingFor(tone);
  // Unlike the expiry-reminder email, there is no public/customer-facing
  // invoice page to link to yet (customers aren't app users, and invoices
  // are only viewable inside the authed quote detail page) -- so, unlike
  // sendExpiryReminderEmail.ts's share-token link, this email references the
  // invoice by number only. Adding a public invoice view is tracked as
  // separate follow-up scope, not part of this issue.

  if (stage === "reminder") {
    return (
      `${greeting}\n\n` +
      `unsere Rechnung ${invoiceNumber} über ${amount} war am ${due} fällig und ist ` +
      `laut unseren Unterlagen noch offen. Vermutlich handelt es sich um ein Versehen -- ` +
      `bitte gleichen Sie den Betrag zeitnah aus.\n\n` +
      `Falls die Zahlung bereits veranlasst wurde, betrachten Sie diese Erinnerung als ` +
      `gegenstandslos.\n\n${closing}`
    );
  }

  const interestCents = calculateVerzugszinsenCents(totalCents, overdueDays);
  const ratePercent = (STATUTORY_DEFAULT_INTEREST_RATE * 100).toFixed(2);

  if (stage === "mahnung") {
    return (
      `${greeting}\n\n` +
      `trotz unserer Zahlungserinnerung ist Rechnung ${invoiceNumber} über ${amount} ` +
      `(fällig am ${due}) weiterhin nicht beglichen. Sie befinden sich seit ${overdueDays} ` +
      `Tagen im Zahlungsverzug (SS 286 BGB).\n\n` +
      `Gemäß SS 288 Abs. 1 BGB berechnen wir Verzugszinsen in Höhe von ${ratePercent}% p.a. ` +
      `(Basiszinssatz zzgl. 5 Prozentpunkte), aufgelaufen bis heute: ${formatEuros(interestCents)}.\n\n` +
      `Wir fordern Sie hiermit auf, den offenen Betrag zzgl. Verzugszinsen innerhalb von ` +
      `7 Tagen zu begleichen.\n\n${closing}`
    );
  }

  return (
    `${greeting}\n\n` +
    `Rechnung ${invoiceNumber} über ${amount} (fällig am ${due}) ist trotz Zahlungserinnerung ` +
    `und Mahnung weiterhin unbeglichen -- Sie sind seit ${overdueDays} Tagen in Verzug.\n\n` +
    `Aufgelaufene Verzugszinsen (SS 288 Abs. 1 BGB, ${ratePercent}% p.a.): ${formatEuros(interestCents)}.\n\n` +
    `Sollte die Zahlung nicht innerhalb der nächsten 7 Tage bei uns eingehen, behalten wir uns ` +
    `weitere rechtliche Schritte zur Durchsetzung unserer Forderung vor.\n\n${closing}`
  );
}

export async function sendDunningEmail(input: SendDunningEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("Failed to send dunning notification: RESEND_API_KEY is not set");
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
        to: [input.toEmail],
        subject: subjectFor(input.stage, input.invoiceNumber),
        text: bodyFor(input),
      }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      console.error("Failed to send dunning notification:", response.status, body);
    }
  } catch (err) {
    console.error("Failed to send dunning notification:", err);
  }
}
