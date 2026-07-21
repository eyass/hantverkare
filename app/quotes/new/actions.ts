"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateLineItems, QuoteGenerationError } from "@/lib/quotes/generateLineItems";
import { priceLineItem, computeTotals } from "@/lib/quotes/pricing";

export type GenerateQuoteState = { error: string | null };

export async function generateQuoteDraft(
  _prevState: GenerateQuoteState,
  formData: FormData,
): Promise<GenerateQuoteState> {
  const description = formData.get("description");
  if (typeof description !== "string" || description.trim().length === 0) {
    return { error: "Bitte beschreibe den Auftrag." };
  }
  if (description.length > 2000) {
    return { error: "Die Beschreibung ist zu lang (max. 2000 Zeichen)." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Bitte melde dich an." };
  }

  const { data: priceList, error: priceListError } = await supabase
    .from("price_list_items")
    .select("label, unit, unit_price_cents, category");
  if (priceListError || !priceList) {
    console.error("Failed to load price list:", priceListError);
    return { error: "Preisliste konnte nicht geladen werden." };
  }
  if (priceList.length === 0) {
    return { error: "Bitte lege zuerst Preislistenpositionen an." };
  }

  let lineItems;
  try {
    lineItems = await generateLineItems(
      description,
      priceList.map((p) => ({
        label: p.label,
        unit: p.unit,
        unitPriceCents: p.unit_price_cents,
        category: p.category,
      })),
    );
  } catch (err) {
    if (err instanceof QuoteGenerationError) {
      console.error("Quote generation failed:", err);
      return { error: `Angebot konnte nicht erstellt werden: ${err.message}` };
    }
    throw err;
  }

  const pricedItems = lineItems.map(priceLineItem);
  const totals = computeTotals(pricedItems);

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .insert({
      customer_description: description,
      status: "draft",
      subtotal_cents: totals.subtotalCents,
      vat_cents: totals.vatCents,
      total_cents: totals.totalCents,
      user_id: user.id,
    })
    .select("id")
    .single();
  if (quoteError || !quote) {
    console.error("Failed to insert quote:", quoteError);
    return { error: "Angebot konnte nicht gespeichert werden." };
  }

  const { error: lineItemsError } = await supabase.from("quote_line_items").insert(
    pricedItems.map((item, index) => ({
      quote_id: quote.id,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_price_cents: item.unitPriceCents,
      line_total_cents: item.lineTotalCents,
      position: index,
      user_id: user.id,
    })),
  );
  if (lineItemsError) {
    console.error("Failed to insert line items:", lineItemsError);
    await supabase.from("quotes").delete().eq("id", quote.id);
    return { error: "Positionen konnten nicht gespeichert werden." };
  }

  redirect(`/quotes/${quote.id}`);
}

export type TranscribeResult = { error: string; text?: never } | { error: null; text: string };

const MAX_AUDIO_BYTES = 25 * 1024 * 1024;

export async function transcribeAudio(formData: FormData): Promise<TranscribeResult> {
  const audio = formData.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return { error: "Keine Aufnahme empfangen." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Bitte melde dich an." };
  }

  if (audio.size > MAX_AUDIO_BYTES) {
    return { error: "Aufnahme ist zu groß." };
  }

  const whisperFormData = new FormData();
  whisperFormData.set("file", audio, "recording.webm");
  whisperFormData.set("model", "whisper-1");
  whisperFormData.set("language", "de");

  let response: Response;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30_000);
    try {
      response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: whisperFormData,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (err) {
    console.error("Whisper API request failed:", err);
    return { error: "Transkription fehlgeschlagen. Bitte versuche es erneut." };
  }

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("Whisper API error:", response.status, errorBody);
    return { error: "Transkription fehlgeschlagen. Bitte versuche es erneut." };
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch (err) {
    console.error("Failed to parse Whisper API response:", err);
    return { error: "Transkription fehlgeschlagen. Bitte versuche es erneut." };
  }

  const text =
    typeof data === "object" && data !== null && "text" in data && typeof (data as { text: unknown }).text === "string"
      ? (data as { text: string }).text.trim()
      : "";
  if (text.length === 0) {
    return { error: "Keine Sprache erkannt, bitte erneut versuchen." };
  }

  return { error: null, text };
}
