"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSignedNotification } from "@/lib/notifications/sendSignedEmail";
import { sendSmsNotification, buildSignedSmsBody } from "@/lib/notifications/sendSmsNotification";

type SignQuoteResult = { error: string | null };

export async function signQuote(token: string, signerName: string): Promise<SignQuoteResult> {
  const trimmedName = signerName.trim();
  if (trimmedName.length === 0) {
    return { error: "Bitte geben Sie Ihren vollständigen Namen ein." };
  }

  const supabase = createAdminClient();

  let signerIp: string | null = null;
  try {
    const headerList = await headers();
    signerIp = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  } catch {
    // Best effort only -- signing must never fail just because the IP is
    // unavailable in this environment.
  }

  const { data, error } = await supabase
    .from("quotes")
    .update({
      status: "signed",
      signed_at: new Date().toISOString(),
      signer_name: trimmedName,
      signer_ip: signerIp,
    })
    .eq("share_token", token)
    .eq("status", "final")
    .select("id, user_id, customer_description, organization_id");
  if (error || !data || data.length === 0) {
    console.error("Failed to sign quote:", error);
    return { error: "Angebot konnte nicht unterschrieben werden. Es ist möglicherweise nicht mehr verfügbar." };
  }

  // Best-effort notification only -- must never affect the result returned to the
  // customer, who has already successfully signed at this point.
  try {
    const quote = data[0];
    const { data: ownerData, error: ownerError } = await supabase.auth.admin.getUserById(
      quote.user_id,
    );
    const ownerEmail = ownerData?.user?.email;
    if (ownerError || !ownerEmail) {
      console.error("Failed to look up quote owner for signed-quote notification:", ownerError);
    } else {
      await sendSignedNotification({
        toEmail: ownerEmail,
        signerName: trimmedName,
        quoteDescription: quote.customer_description ?? "",
        quoteId: quote.id,
      });
    }

    // Additional best-effort SMS, gated on the org's opt-in toggle (see
    // organizations.sms_notifications_enabled, 0016_sms_notifications.sql)
    // and on the owner actually having a phone number on file. Must never
    // affect the result returned to the customer.
    const ownerPhone = ownerData?.user?.phone;
    if (ownerPhone) {
      const { data: orgRow, error: orgError } = await supabase
        .from("organizations")
        .select("sms_notifications_enabled")
        .eq("id", quote.organization_id)
        .maybeSingle();
      if (orgError) {
        console.error("Failed to look up organization SMS setting:", orgError);
      } else if (orgRow?.sms_notifications_enabled) {
        await sendSmsNotification({
          toPhone: ownerPhone,
          body: buildSignedSmsBody(trimmedName, quote.customer_description ?? ""),
        });
      }
    }
  } catch (notifyErr) {
    console.error("Failed to send signed-quote notification:", notifyErr);
  }

  return { error: null };
}
