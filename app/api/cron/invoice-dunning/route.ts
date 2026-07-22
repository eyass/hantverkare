import { createAdminClient } from "@/lib/supabase/admin";
import { sendDunningEmail, type DunningEmailStage } from "@/lib/notifications/sendDunningEmail";
import { sendSmsNotification, buildDunningSmsBody } from "@/lib/notifications/sendSmsNotification";
import { daysOverdue, nextDunningStage } from "@/lib/invoices/dunning";

// Automated Mahnwesen (issue #122): a stage per overdue invoice, at most once
// each -- friendly reminder -> formal Mahnung (with Verzugszinsen) ->
// escalation notice. Structured identically to
// app/api/cron/quote-expiry-reminders/route.ts: same CRON_SECRET bearer-token
// auth, same admin-client-because-no-session reasoning, same
// "look up owner/customer, best-effort send, then stamp the timestamp" shape.
// See that file's comments for the full auth rationale (unchanged here).
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("CRON_SECRET is not set; rejecting cron request.");
    return false;
  }
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

const STAGE_COLUMN: Record<DunningEmailStage, string> = {
  reminder: "payment_reminder_sent_at",
  mahnung: "mahnung_sent_at",
  escalation: "escalation_sent_at",
};

export async function GET(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();

  // Candidates: unpaid invoices whose due_date has already passed. We can't
  // push the "which stage is next" decision into the SQL query itself (it
  // depends on three thresholds that vary per-organization, see
  // dunning_reminder_days/dunning_mahnung_days/dunning_escalation_days), so
  // this query intentionally over-fetches (every unpaid overdue invoice) and
  // nextDunningStage() decides in-process whether anything is actually due.
  const { data: invoices, error } = await supabase
    .from("invoices")
    .select(
      "id, organization_id, quote_id, invoice_number, total_cents, due_date, payment_reminder_sent_at, mahnung_sent_at, escalation_sent_at",
    )
    .is("paid_at", null)
    .lt("due_date", now.toISOString());

  if (error) {
    console.error("Failed to load invoices due for dunning:", error);
    return Response.json({ error: "Failed to load invoices." }, { status: 500 });
  }

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const invoice of invoices ?? []) {
    try {
      const { data: org, error: orgError } = await supabase
        .from("organizations")
        .select(
          "dunning_enabled, dunning_reminder_days, dunning_mahnung_days, dunning_escalation_days, dunning_tone, sms_notifications_enabled",
        )
        .eq("id", invoice.organization_id)
        .maybeSingle();

      if (orgError || !org) {
        console.error("Failed to look up organization dunning settings:", invoice.id, orgError);
        failed += 1;
        continue;
      }

      if (!org.dunning_enabled) {
        skipped += 1;
        continue;
      }

      const dueDate = new Date(invoice.due_date as string);
      const overdue = daysOverdue(dueDate, now);

      const stage = nextDunningStage(
        overdue,
        {
          reminderDays: org.dunning_reminder_days,
          mahnungDays: org.dunning_mahnung_days,
          escalationDays: org.dunning_escalation_days,
        },
        {
          paymentReminderSentAt: invoice.payment_reminder_sent_at
            ? new Date(invoice.payment_reminder_sent_at as string)
            : null,
          mahnungSentAt: invoice.mahnung_sent_at ? new Date(invoice.mahnung_sent_at as string) : null,
          escalationSentAt: invoice.escalation_sent_at
            ? new Date(invoice.escalation_sent_at as string)
            : null,
        },
      );

      if (!stage) {
        skipped += 1;
        continue;
      }

      // Look up the customer via the invoice's originating quote (invoices
      // don't store customer_id directly -- see 0008_invoices.sql).
      const { data: quote, error: quoteError } = await supabase
        .from("quotes")
        .select("customer_id")
        .eq("id", invoice.quote_id)
        .maybeSingle();
      if (quoteError) {
        console.error("Failed to look up quote for invoice dunning:", invoice.id, quoteError);
      }

      let customerEmail: string | null = null;
      let customerPhone: string | null = null;
      if (quote?.customer_id) {
        const { data: customer, error: customerError } = await supabase
          .from("customers")
          .select("email, phone")
          .eq("id", quote.customer_id)
          .maybeSingle();
        if (customerError) {
          console.error("Failed to look up customer for invoice dunning:", invoice.id, customerError);
        } else {
          customerEmail = customer?.email ?? null;
          customerPhone = customer?.phone ?? null;
        }
      }

      if (!customerEmail) {
        // Nothing to send to (no customer / no email on file). We still
        // don't stamp the column -- if an email address gets added later,
        // this invoice should still receive the reminder on a later run --
        // but we count it as skipped rather than sent so ops can see the gap.
        console.error("Invoice has no customer email on file; skipping dunning send:", invoice.id);
        skipped += 1;
        continue;
      }

      await sendDunningEmail({
        toEmail: customerEmail,
        stage,
        tone: org.dunning_tone,
        invoiceNumber: invoice.invoice_number,
        totalCents: invoice.total_cents,
        overdueDays: overdue,
        dueDate,
        invoiceId: invoice.id,
      });

      if (org.sms_notifications_enabled && customerPhone) {
        await sendSmsNotification({
          toPhone: customerPhone,
          body: buildDunningSmsBody(stage, invoice.invoice_number, invoice.total_cents),
        });
      }

      const column = STAGE_COLUMN[stage];
      const { error: stampError } = await supabase
        .from("invoices")
        .update({ [column]: now.toISOString() })
        .eq("id", invoice.id)
        .is(column, null);
      if (stampError) {
        console.error("Failed to stamp dunning stage timestamp:", invoice.id, stage, stampError);
        failed += 1;
        continue;
      }
      sent += 1;
    } catch (err) {
      console.error("Unexpected error processing invoice dunning:", invoice.id, err);
      failed += 1;
    }
  }

  return Response.json({ checked: invoices?.length ?? 0, sent, skipped, failed });
}
