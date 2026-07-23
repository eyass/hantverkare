"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendSignedNotification } from "@/lib/notifications/sendSignedEmail";
import { sendDeclinedNotification } from "@/lib/notifications/sendDeclinedEmail";
import { sendQuoteCommentNotification } from "@/lib/notifications/sendQuoteCommentEmail";
import { sendSmsNotification, buildSignedSmsBody } from "@/lib/notifications/sendSmsNotification";
import { decrementStockOnSign } from "@/lib/inventory/decrementStockOnSign";
import { createDepositCheckoutSession } from "@/lib/payments/createDepositCheckoutSession";

type SignQuoteResult = { error: string | null; depositCheckoutUrl?: string | null };
type DeclineQuoteResult = { error: string | null };
type AddCommentResult = { error: string | null };
type RequestDepositCheckoutResult = { error: string | null; url?: string | null };

const MAX_DECLINE_REASON_LENGTH = 500;
const MAX_COMMENT_LENGTH = 2000;

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
    .select(
      "id, user_id, customer_description, organization_id, customer_id, signed_at, deposit_percent, total_cents",
    );
  if (error || !data || data.length === 0) {
    console.error("Failed to sign quote:", error);
    return { error: "Angebot konnte nicht unterschrieben werden. Es ist möglicherweise nicht mehr verfügbar." };
  }

  // Auto-generate the Gewährleistung (warranty) record for this job (#127).
  // Best-effort, like the notifications below: the customer has already
  // successfully signed at this point, so a failure here must never be
  // surfaced as a signing failure. Scope/date/line-items are all derived
  // from data already captured on the quote -- no new user input.
  try {
    const quote = data[0];
    const { data: lineItems, error: lineItemsError } = await supabase
      .from("quote_line_items")
      .select("description, quantity, unit, unit_price_cents, line_total_cents")
      .eq("quote_id", quote.id)
      .order("position");
    if (lineItemsError) {
      console.error("Failed to load line items for warranty record:", lineItemsError);
    } else {
      const startDate = new Date(quote.signed_at ?? Date.now());
      const warrantyPeriodMonths = 24; // German statutory minimum (BGB §634a) -- see 0020_warranty_records.sql
      const expiryDate = new Date(startDate);
      expiryDate.setMonth(expiryDate.getMonth() + warrantyPeriodMonths);

      const { error: warrantyError } = await supabase.from("warranty_records").insert({
        user_id: quote.user_id,
        quote_id: quote.id,
        customer_id: quote.customer_id,
        scope_description: quote.customer_description ?? "",
        line_items_snapshot: lineItems ?? [],
        warranty_start_date: startDate.toISOString().slice(0, 10),
        warranty_period_months: warrantyPeriodMonths,
        warranty_expiry_date: expiryDate.toISOString().slice(0, 10),
      });
      if (warrantyError) {
        console.error("Failed to create warranty record:", warrantyError);
      }
    }
  } catch (warrantyErr) {
    console.error("Failed to create warranty record:", warrantyErr);
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

  // Best-effort stock decrement (issue #125), gated on the org's opt-in
  // toggle -- must never affect the result returned to the already-signed
  // customer.
  try {
    const quote = data[0];
    await decrementStockOnSign(supabase, quote.organization_id, quote.id);
  } catch (inventoryErr) {
    console.error("Failed to decrement stock after signing:", inventoryErr);
  }

  // Deposit (Anzahlung) collection, issue #162: if the tradesperson
  // configured a deposit_percent on this quote, prepare a Stripe Checkout
  // Session for that share of the total right at signing time, on the org's
  // connected Stripe account (see lib/payments/createDepositCheckoutSession.ts
  // for the #131 Stripe Connect dependency and its graceful-skip behavior).
  // Best-effort, exactly like the notifications/warranty/stock blocks above
  // -- must never affect the result returned to the customer, who has
  // already successfully signed at this point. If no Stripe Connect account
  // is set up yet (e.g. #131 hasn't landed, or the org hasn't onboarded),
  // this silently no-ops rather than blocking signing.
  let depositCheckoutUrl: string | null = null;
  try {
    const quote = data[0];
    if (quote.deposit_percent) {
      const depositAmountCents = Math.round((quote.total_cents * quote.deposit_percent) / 100);
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
      const result = await createDepositCheckoutSession({
        supabase,
        organizationId: quote.organization_id,
        quoteId: quote.id,
        quoteDescription: quote.customer_description ?? "",
        depositAmountCents,
        successUrl: `${siteUrl}/q/${token}?deposit=success`,
        cancelUrl: `${siteUrl}/q/${token}?deposit=cancelled`,
      });
      if (result.skipped) {
        console.log("Deposit collection skipped at signing:", result.reason);
      } else {
        const { error: depositUpdateError } = await supabase
          .from("quotes")
          .update({
            deposit_amount_cents: depositAmountCents,
            deposit_stripe_checkout_session_id: result.sessionId,
          })
          .eq("id", quote.id);
        if (depositUpdateError) {
          console.error("Failed to persist deposit checkout session:", depositUpdateError);
        } else {
          depositCheckoutUrl = result.url;
        }
      }
    }
  } catch (depositErr) {
    console.error("Failed to prepare deposit checkout at signing:", depositErr);
  }

  return { error: null, depositCheckoutUrl };
}

// Re-generates a deposit Checkout Session for an already-signed quote
// (issue #162). Used by the customer-facing "pay deposit" prompt on page
// reload/re-visit, since the URL returned inline from signQuote isn't
// persisted anywhere -- Stripe Checkout Session URLs also expire after 24h,
// so a fresh one may be needed even shortly after signing. Mirrors
// addCustomerComment's security model: share_token is the only lookup key,
// via the service-role admin client.
export async function requestDepositCheckout(token: string): Promise<RequestDepositCheckoutResult> {
  const supabase = createAdminClient();

  const { data: quote, error } = await supabase
    .from("quotes")
    .select("id, organization_id, customer_description, total_cents, status, deposit_percent, deposit_paid_at")
    .eq("share_token", token)
    .maybeSingle();
  if (error || !quote) {
    console.error("Failed to look up quote for deposit checkout request:", error);
    return { error: "Angebot nicht gefunden." };
  }
  if (quote.status !== "signed") {
    return { error: "Angebot ist noch nicht unterschrieben." };
  }
  if (!quote.deposit_percent) {
    return { error: "Für dieses Angebot ist keine Anzahlung vorgesehen." };
  }
  if (quote.deposit_paid_at) {
    return { error: "Anzahlung wurde bereits bezahlt." };
  }

  const depositAmountCents = Math.round((quote.total_cents * quote.deposit_percent) / 100);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const result = await createDepositCheckoutSession({
    supabase,
    organizationId: quote.organization_id,
    quoteId: quote.id,
    quoteDescription: quote.customer_description ?? "",
    depositAmountCents,
    successUrl: `${siteUrl}/q/${token}?deposit=success`,
    cancelUrl: `${siteUrl}/q/${token}?deposit=cancelled`,
  });

  if (result.skipped) {
    console.error("Deposit checkout session request skipped:", result.reason);
    return { error: "Anzahlung kann derzeit nicht online bezahlt werden. Bitte kontaktieren Sie uns direkt." };
  }

  const { error: updateError } = await supabase
    .from("quotes")
    .update({
      deposit_amount_cents: depositAmountCents,
      deposit_stripe_checkout_session_id: result.sessionId,
    })
    .eq("id", quote.id);
  if (updateError) {
    console.error("Failed to persist re-requested deposit checkout session:", updateError);
    return { error: "Zahlungslink konnte nicht vorbereitet werden." };
  }

  return { error: null, url: result.url };
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

// Customer-side half of the #155 comment thread. Mirrors declineQuote's
// security model: the share_token (never a client-supplied quote id) is the
// only lookup key, via the service-role admin client (customers have no
// auth session at all -- see 0029_quote_comments.sql's RLS notes). Allowed
// on any non-draft quote (final, signed, or declined) so a customer can
// still ask a follow-up question after signing/declining; drafts aren't
// shared with customers yet (see page.tsx's own draft guard) so they're
// excluded here too.
export async function addCustomerComment(token: string, body: string): Promise<AddCommentResult> {
  const trimmedBody = body.trim().slice(0, MAX_COMMENT_LENGTH);
  if (trimmedBody.length === 0) {
    return { error: "Bitte geben Sie eine Nachricht ein." };
  }

  const supabase = createAdminClient();

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .select("id, organization_id, user_id, customer_description, status")
    .eq("share_token", token)
    .neq("status", "draft")
    .maybeSingle();
  if (quoteError || !quote) {
    console.error("Failed to look up quote for comment:", quoteError);
    return { error: "Angebot konnte nicht gefunden werden." };
  }

  const { error: insertError } = await supabase.from("quote_comments").insert({
    organization_id: quote.organization_id,
    quote_id: quote.id,
    author_type: "customer",
    author_name: "Kunde",
    body: trimmedBody,
  });
  if (insertError) {
    console.error("Failed to insert quote comment:", insertError);
    return { error: "Nachricht konnte nicht gespeichert werden." };
  }

  // Best-effort notification only -- must never affect the result returned to the
  // customer, who has already successfully posted at this point.
  try {
    const { data: ownerData, error: ownerError } = await supabase.auth.admin.getUserById(
      quote.user_id,
    );
    const ownerEmail = ownerData?.user?.email;
    if (ownerError || !ownerEmail) {
      console.error("Failed to look up quote owner for comment notification:", ownerError);
    } else {
      await sendQuoteCommentNotification({
        toEmail: ownerEmail,
        quoteDescription: quote.customer_description ?? "",
        quoteId: quote.id,
        commentBody: trimmedBody,
      });
    }
  } catch (notifyErr) {
    console.error("Failed to send quote-comment notification:", notifyErr);
  }

  return { error: null };
}
