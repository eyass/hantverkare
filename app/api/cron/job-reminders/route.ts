import { createAdminClient } from "@/lib/supabase/admin";
import { sendJobReminderEmail } from "@/lib/notifications/sendJobReminderEmail";
import { sendSmsNotification, buildJobReminderSmsBody } from "@/lib/notifications/sendSmsNotification";

// Day-before reminder for scheduled jobs (issue #124), mirroring
// app/api/cron/quote-expiry-reminders/route.ts's structure exactly -- same
// CRON_SECRET bearer-auth guard, same admin-client usage (this runs with no
// user session, triggered by Vercel Cron, so it must bypass RLS via the
// service-role client to read across every organization).
//
// "Tomorrow" is computed as a UTC calendar-day window: [start of tomorrow,
// start of the day after) in UTC. There is no per-organization timezone
// concept anywhere in this app yet (see ScheduleSection.tsx's comment), so
// this uses the server's UTC default like the rest of the codebase rather
// than inventing per-org timezone handling here -- out of scope for #124.
//
// reminder_sent_at (scheduled_jobs) guards against duplicate sends, exactly
// like quotes.expiry_reminder_sent_at guards the expiry-reminder cron.
function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    // Fail closed: an unconfigured secret must never be treated as "no auth
    // required". Misconfiguration should be loud (visible in logs), not a
    // silent open door.
    console.error("CRON_SECRET is not set; rejecting cron request.");
    return false;
  }
  const authHeader = request.headers.get("authorization");
  return authHeader === `Bearer ${secret}`;
}

function startOfUtcDay(date: Date, daysFromNow: number): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d;
}

export async function GET(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();
  const tomorrowStart = startOfUtcDay(now, 1);
  const tomorrowEnd = startOfUtcDay(now, 2);

  const { data: jobs, error } = await supabase
    .from("scheduled_jobs")
    .select("id, quote_id, organization_id, scheduled_start")
    .is("reminder_sent_at", null)
    .gte("scheduled_start", tomorrowStart.toISOString())
    .lt("scheduled_start", tomorrowEnd.toISOString());

  if (error) {
    console.error("Failed to load scheduled jobs due for a reminder:", error);
    return Response.json({ error: "Failed to load scheduled jobs." }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;

  for (const job of jobs ?? []) {
    try {
      const { data: quote, error: quoteError } = await supabase
        .from("quotes")
        .select("customer_description, customer_id")
        .eq("id", job.quote_id)
        .maybeSingle();
      if (quoteError || !quote) {
        console.error("Failed to look up quote for job reminder:", job.id, quoteError);
        failed += 1;
        continue;
      }

      let smsEnabled = false;
      const { data: orgRow, error: orgError } = await supabase
        .from("organizations")
        .select("sms_notifications_enabled")
        .eq("id", job.organization_id)
        .maybeSingle();
      if (orgError) {
        console.error("Failed to look up organization SMS setting:", job.id, orgError);
      } else {
        smsEnabled = orgRow?.sms_notifications_enabled === true;
      }

      if (quote.customer_id) {
        const { data: customer, error: customerError } = await supabase
          .from("customers")
          .select("email, phone")
          .eq("id", quote.customer_id)
          .maybeSingle();
        if (customerError) {
          console.error("Failed to look up customer for job reminder:", job.id, customerError);
        } else {
          if (customer?.email) {
            await sendJobReminderEmail({
              toEmail: customer.email,
              quoteDescription: quote.customer_description ?? "",
              quoteId: job.quote_id,
              scheduledStart: job.scheduled_start,
            });
          }
          if (smsEnabled && customer?.phone) {
            await sendSmsNotification({
              toPhone: customer.phone,
              body: buildJobReminderSmsBody(job.scheduled_start, quote.customer_description ?? ""),
            });
          }
        }
      }

      const { error: stampError } = await supabase
        .from("scheduled_jobs")
        .update({ reminder_sent_at: now.toISOString() })
        .eq("id", job.id)
        .is("reminder_sent_at", null);
      if (stampError) {
        console.error("Failed to stamp reminder_sent_at:", job.id, stampError);
        failed += 1;
        continue;
      }
      sent += 1;
    } catch (err) {
      console.error("Unexpected error sending job reminder for scheduled job:", job.id, err);
      failed += 1;
    }
  }

  return Response.json({ checked: jobs?.length ?? 0, sent, failed });
}
