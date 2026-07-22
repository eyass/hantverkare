// Sends the internal "this contract needs attention" notification via
// Resend's REST API, mirroring lib/notifications/sendExpiryReminderEmail.ts's
// plain-fetch pattern exactly. Called from the contract-dunning cron
// (app/api/cron/contract-dunning/route.ts) for the contract's owner (the
// tradesperson) only -- unlike invoice dunning, this is never sent to the
// customer: a lapsing contract is the org's problem to chase, not something
// to escalate at the customer directly (that already happens via the
// underlying invoice's own dunning emails). Best-effort: must NEVER throw,
// so one failed send can never stop the cron from processing the rest of
// the batch.
import type { ContractRiskReason } from "@/lib/contracts/dunning";
import { CONTRACT_RISK_LABELS } from "@/lib/contracts/dunning";

type SendContractAtRiskEmailInput = {
  toEmail: string;
  reason: ContractRiskReason;
  contractId: string;
  customerDescription: string;
};

function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.slice(0, maxLength).trimEnd()}...` : text;
}

function bodyFor(reason: ContractRiskReason, descriptionSnippet: string, contractId: string, siteUrl: string): string {
  const link = `${siteUrl}/contracts`;
  switch (reason) {
    case "renewal_failed":
      return `Ein Wartungsvertrag konnte nicht automatisch verlängert werden.\n\nAuftrag: ${descriptionSnippet}\n\nVertrag ansehen: ${link}`;
    case "invoice_overdue":
      return `Die zuletzt erzeugte Rechnung zu einem Wartungsvertrag ist überfällig und hat die Mahnstufe erreicht.\n\nAuftrag: ${descriptionSnippet}\n\nVertrag ansehen: ${link}`;
  }
}

export async function sendContractAtRiskEmail({
  toEmail,
  reason,
  contractId,
  customerDescription,
}: SendContractAtRiskEmailInput): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("Failed to send contract-at-risk notification: RESEND_API_KEY is not set");
    return;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const descriptionSnippet = truncate(customerDescription, 200);

  const subject =
    reason === "renewal_failed" ? "Wartungsvertrag: Verlängerung fehlgeschlagen" : "Wartungsvertrag: Rechnung überfällig";
  const text = bodyFor(reason, descriptionSnippet, contractId, siteUrl);

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
      console.error("Failed to send contract-at-risk notification:", response.status, body);
    }
  } catch (err) {
    console.error("Failed to send contract-at-risk notification:", err);
  }
}

// Re-exported so callers only need to import from this module for both the
// label map and the send function, if convenient.
export { CONTRACT_RISK_LABELS };
