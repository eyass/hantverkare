"use server";

// Server actions for the stalled-quotes follow-up nudge feature (issue #158):
// AI-drafts a short follow-up message for a quote that's been sent (status =
// "final") but sitting unsigned/undeclined past the threshold in
// lib/quotes/followup.ts, lets the tradesperson review/edit it client-side,
// then sends it to the customer over the existing Resend email
// infrastructure (lib/notifications/sendFollowupEmail.ts) with one click.

import { createClient } from "@/lib/supabase/server";
import { isStalledQuote } from "@/lib/quotes/followup";
import { generateFollowupMessage, FollowupGenerationError } from "@/lib/quotes/generateFollowupMessage";
import { sendFollowupEmail } from "@/lib/notifications/sendFollowupEmail";

export type GenerateFollowupResult =
  | { error: string; message?: never }
  | { error: null; message: string };

async function loadStalledQuote(supabase: Awaited<ReturnType<typeof createClient>>, quoteId: string) {
  const { data: quote, error } = await supabase
    .from("quotes")
    .select("id, customer_description, status, declined_at, signed_at, finalized_at, share_token, customer_id")
    .eq("id", quoteId)
    .maybeSingle();
  if (error || !quote) {
    return { quote: null, error: "Angebot nicht gefunden." };
  }
  if (
    !isStalledQuote({
      status: quote.status,
      declinedAt: quote.declined_at,
      signedAt: quote.signed_at,
      finalizedAt: quote.finalized_at,
    })
  ) {
    return { quote: null, error: "Dieses Angebot ist nicht überfällig." };
  }
  return { quote, error: null };
}

export async function generateFollowupDraft(quoteId: string): Promise<GenerateFollowupResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Bitte melde dich an." };
  }

  const { quote, error } = await loadStalledQuote(supabase, quoteId);
  if (!quote) {
    return { error: error ?? "Angebot nicht gefunden." };
  }

  const daysSinceSent = Math.max(
    0,
    Math.floor((Date.now() - new Date(quote.finalized_at as string).getTime()) / (24 * 60 * 60 * 1000)),
  );

  try {
    const message = await generateFollowupMessage(quote.customer_description, daysSinceSent);
    return { error: null, message };
  } catch (err) {
    if (err instanceof FollowupGenerationError) {
      console.error("Follow-up message generation failed:", err);
      return { error: "Entwurf konnte nicht erstellt werden." };
    }
    throw err;
  }
}

export type SendFollowupResult = { error: string | null };

export async function sendFollowupMessage(quoteId: string, message: string): Promise<SendFollowupResult> {
  const trimmed = message.trim();
  if (trimmed.length === 0) {
    return { error: "Bitte gib eine Nachricht ein." };
  }
  if (trimmed.length > 2000) {
    return { error: "Die Nachricht ist zu lang (max. 2000 Zeichen)." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Bitte melde dich an." };
  }

  const { quote, error } = await loadStalledQuote(supabase, quoteId);
  if (!quote) {
    return { error: error ?? "Angebot nicht gefunden." };
  }

  if (!quote.customer_id) {
    return { error: "Für dieses Angebot ist kein Kunde hinterlegt." };
  }

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("email")
    .eq("id", quote.customer_id)
    .maybeSingle();
  if (customerError || !customer?.email) {
    console.error("Failed to look up customer for follow-up nudge:", quoteId, customerError);
    return { error: "Für diesen Kunden ist keine E-Mail-Adresse hinterlegt." };
  }

  return sendFollowupEmail({
    toEmail: customer.email,
    message: trimmed,
    quoteId: quote.id,
    shareToken: quote.share_token as string | null | undefined,
  });
}
