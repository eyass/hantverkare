import { createAdminClient } from "@/lib/supabase/admin";
import { sendExpiryReminderEmail } from "@/lib/notifications/sendExpiryReminderEmail";
import { daysUntilExpiry, REMINDER_WINDOW_DAYS } from "@/lib/quotes/expiry";

// Vercel Cron (see vercel.json's `crons` entry) hits this route on a schedule
// with no user session at all, so it must use the service-role admin client
// (see lib/supabase/admin.ts) to read/write across every organization's
// quotes -- there is no auth.uid() to scope a normal request-scoped client to.
//
// Because this route can send email and read customer data, and because it
// deliberately bypasses RLS via the admin client, it must not be publicly
// invocable: Vercel signs its own cron requests with a bearer token equal to
// the CRON_SECRET env var (Vercel's documented convention -- see
// https://vercel.com/docs/cron-jobs/manage-cron-jobs#securing-cron-jobs).
// Any request missing/mismatching that header is rejected before touching
// the database. Set CRON_SECRET in the Vercel project's env vars (see
// docs/MANUAL-STEPS-PENDING.md) -- Vercel automatically sends it as
// `Authorization: Bearer $CRON_SECRET` for cron-triggered invocations.
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

export async function GET(request: Request): Promise<Response> {
  if (!isAuthorized(request)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();
  const windowEnd = new Date(now.getTime() + REMINDER_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const { data: quotes, error } = await supabase
    .from("quotes")
    .select("id, user_id, customer_id, customer_description, expires_at, share_token")
    .eq("status", "final")
    .is("expiry_reminder_sent_at", null)
    .not("expires_at", "is", null)
    .gte("expires_at", now.toISOString())
    .lte("expires_at", windowEnd.toISOString());

  if (error) {
    console.error("Failed to load quotes due for an expiry reminder:", error);
    return Response.json({ error: "Failed to load quotes." }, { status: 500 });
  }

  let sent = 0;
  let failed = 0;

  for (const quote of quotes ?? []) {
    try {
      const days = daysUntilExpiry(new Date(quote.expires_at as string), now);

      const { data: ownerData, error: ownerError } = await supabase.auth.admin.getUserById(
        quote.user_id,
      );
      const ownerEmail = ownerData?.user?.email;
      if (ownerError || !ownerEmail) {
        console.error("Failed to look up quote owner for expiry reminder:", quote.id, ownerError);
      } else {
        await sendExpiryReminderEmail({
          toEmail: ownerEmail,
          audience: "owner",
          quoteDescription: quote.customer_description ?? "",
          quoteId: quote.id,
          daysUntilExpiry: days,
        });
      }

      if (quote.customer_id) {
        const { data: customer, error: customerError } = await supabase
          .from("customers")
          .select("email")
          .eq("id", quote.customer_id)
          .maybeSingle();
        if (customerError) {
          console.error("Failed to look up customer for expiry reminder:", quote.id, customerError);
        } else if (customer?.email) {
          await sendExpiryReminderEmail({
            toEmail: customer.email,
            audience: "customer",
            quoteDescription: quote.customer_description ?? "",
            quoteId: quote.id,
            daysUntilExpiry: days,
            shareToken: quote.share_token as string | undefined,
          });
        }
      }

      const { error: stampError } = await supabase
        .from("quotes")
        .update({ expiry_reminder_sent_at: now.toISOString() })
        .eq("id", quote.id)
        .is("expiry_reminder_sent_at", null);
      if (stampError) {
        console.error("Failed to stamp expiry_reminder_sent_at:", quote.id, stampError);
        failed += 1;
        continue;
      }
      sent += 1;
    } catch (err) {
      console.error("Unexpected error sending expiry reminder for quote:", quote.id, err);
      failed += 1;
    }
  }

  return Response.json({ checked: quotes?.length ?? 0, sent, failed });
}
