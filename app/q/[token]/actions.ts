"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSignedNotification } from "@/lib/notifications/sendSignedEmail";
import { sendDeclinedNotification } from "@/lib/notifications/sendDeclinedEmail";
import { sendSmsNotification, buildSignedSmsBody } from "@/lib/notifications/sendSmsNotification";

type SignQuoteResult = { error: string | null };
type DeclineQuoteResult = { error: string | null };

const MAX_DECLINE_REASON_LENGTH = 500;

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
    .is("declined_at", null)
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

// Mirrors signQuote's security model exactly: the share_token (not a
// client-supplied quote id) is the only lookup key, and the update itself is
// scoped by .eq("share_token", token) so a customer can never act on any
// quote other than the one their link points to. Declining and signing are
// mutually exclusive -- both guard on .eq("status", "final").is("declined_at",
// null) so a quote already signed can't also be declined, and vice versa.
export async function declineQuote(token: string, reason: string): Promise<DeclineQuoteResult> {
  const trimmedReason = reason.trim().slice(0, MAX_DECLINE_REASON_LENGTH);

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("quotes")
    .update({
      declined_at: new Date().toISOString(),
      decline_reason: trimmedReason.length > 0 ? trimmedReason : null,
    })
    .eq("share_token", token)
    .eq("status", "final")
    .is("signed_at", null)
    .is("declined_at", null)
    .select("id, user_id, customer_description");
  if (error || !data || data.length === 0) {
    console.error("Failed to decline quote:", error);
    return { error: "Angebot konnte nicht abgelehnt werden. Es ist möglicherweise nicht mehr verfügbar." };
  }

  // Best-effort notification only -- must never affect the result returned to the
  // customer, who has already successfully declined at this point.
  try {
    const quote = data[0];
    const { data: ownerData, error: ownerError } = await supabase.auth.admin.getUserById(
      quote.user_id,
    );
    const ownerEmail = ownerData?.user?.email;
    if (ownerError || !ownerEmail) {
      console.error("Failed to look up quote owner for declined-quote notification:", ownerError);
    } else {
      await sendDeclinedNotification({
        toEmail: ownerEmail,
        quoteDescription: quote.customer_description ?? "",
        quoteId: quote.id,
        declineReason: trimmedReason.length > 0 ? trimmedReason : null,
      });
    }
  } catch (notifyErr) {
    console.error("Failed to send declined-quote notification:", notifyErr);
  }

  return { error: null };
}
