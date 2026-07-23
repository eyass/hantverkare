import Anthropic from "@anthropic-ai/sdk";
import type { LineItem } from "./types";

export class QuoteGenerationError extends Error {}

export type PriceListItem = {
  id: string;
  label: string;
  unit: string;
  unitPriceCents: number;
  category: string;
};

// Risk-flag categories for the German market (issue #193) -- see
// docs/superpowers/specs/2026-07-23-ai-risk-flagging-design.md. Adapted from
// Bliqat's "Bosse" persona risk flags (asbestos, housing-association rules),
// translated to German-market equivalents: Asbest, WEG-Beschluss (shared
// building approval), Denkmalschutz (heritage protection).
export const RISK_FLAG_TYPES = ["asbestos", "weg_approval", "denkmalschutz"] as const;
export type RiskFlagType = (typeof RISK_FLAG_TYPES)[number];

export type RiskFlag = {
  type: RiskFlagType;
  message: string;
};

const MAX_CLARIFYING_QUESTIONS = 3;

export const ITEM_TYPES = ["labor", "material"] as const;
export type ItemType = (typeof ITEM_TYPES)[number];

// A resolved line item, ready to be priced/inserted (issue #200). Either
// resolved from a real price_list_items row (priceListItemId set, and
// description/unit/unitPriceCents come from the server's own price list --
// never from the AI's echo, closing the drift bug matchPriceListItemId used
// to paper over) or a fully custom item the AI proposed when nothing in the
// price list fit.
export type GeneratedLineItem = LineItem & {
  itemType: ItemType;
  quantityReasoning: string;
  priceListItemId: string | null;
};

export type GenerateLineItemsResult = {
  lineItems: GeneratedLineItem[];
  riskFlags: RiskFlag[];
  clarifyingQuestions: string[];
};

const LINE_ITEMS_TOOL = {
  name: "submit_line_items",
  description:
    "Submit the structured list of quote line items extracted from the job description, " +
    "plus any known German-market risk flags the job description surfaces, and optionally " +
    "up to 3 clarifying questions if -- and only if -- a genuinely blocking detail is missing.",
  input_schema: {
    type: "object" as const,
    properties: {
      lineItems: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            quantity: { type: "number" as const },
            itemType: {
              type: "string" as const,
              enum: [...ITEM_TYPES],
              description: "Whether this line item is labor (work performed) or material (goods/parts used).",
            },
            quantityReasoning: {
              type: "string" as const,
              description:
                "A short justification (in German, matching the app's existing German-language line item style) " +
                "for how this quantity was derived, e.g. '6m² Boden / 1,5m² pro Paket = 4 Pakete, aufgerundet'.",
            },
            priceListItemId: {
              type: "string" as const,
              description:
                "The id of the matching price list item, when the job clearly matches an existing catalog entry " +
                "(prefer this over inventing a price whenever reasonably possible). Omit entirely when using a custom item instead.",
            },
            customUnitPriceCents: {
              type: "integer" as const,
              description:
                "Only when nothing in the price list fits: a reasonable estimated unit price in EUR cents for a custom item.",
            },
            customDescription: {
              type: "string" as const,
              description: "Only when nothing in the price list fits: a short German description of the custom item.",
            },
            unit: {
              type: "string" as const,
              description:
                "Only required alongside a custom item (priceListItemId omitted) -- the unit of measure, e.g. 'Stunde', 'm²', 'Stück'.",
            },
          },
          required: ["quantity", "itemType", "quantityReasoning"],
        },
      },
      riskFlags: {
        type: "array" as const,
        description:
          "Zero or more known risk flags relevant to this job. Only include a flag when the description clearly matches its trigger condition -- leave empty if unsure.",
        items: {
          type: "object" as const,
          properties: {
            type: {
              type: "string" as const,
              enum: [...RISK_FLAG_TYPES],
            },
            message: { type: "string" as const },
          },
          required: ["type", "message"],
        },
      },
      clarifyingQuestions: {
        type: "array" as const,
        description:
          "At most 3 short questions to ask the tradesperson, only for genuinely " +
          "blocking ambiguity that prevents a confident estimate (e.g. a missing " +
          "critical quantity or dimension). Omit or leave empty whenever a reasonable " +
          "assumption can be made instead -- most job descriptions should NOT produce " +
          "any questions.",
        items: { type: "string" as const },
      },
    },
    required: ["lineItems"],
  },
};

export function parseLineItemsToolInput(input: unknown, priceList: PriceListItem[]): GeneratedLineItem[] {
  return parseGenerateLineItemsToolInput(input, priceList).lineItems;
}

export function parseGenerateLineItemsToolInput(
  input: unknown,
  priceList: PriceListItem[],
): GenerateLineItemsResult {
  if (
    typeof input !== "object" ||
    input === null ||
    !("lineItems" in input) ||
    !Array.isArray((input as { lineItems: unknown }).lineItems)
  ) {
    throw new QuoteGenerationError("Malformed tool input: missing lineItems array");
  }

  const rawItems = (input as { lineItems: unknown[] }).lineItems;
  if (rawItems.length === 0) {
    throw new QuoteGenerationError("AI returned zero line items");
  }

  const priceListById = new Map(priceList.map((p) => [p.id, p]));

  const lineItems = rawItems.map((raw, index) => resolveLineItem(raw, index, priceListById));

  const riskFlags = parseRiskFlags((input as { riskFlags?: unknown }).riskFlags);

  const rawQuestions = (input as { clarifyingQuestions?: unknown }).clarifyingQuestions;
  let clarifyingQuestions: string[] = [];
  if (rawQuestions !== undefined) {
    if (!Array.isArray(rawQuestions) || rawQuestions.some((q) => typeof q !== "string")) {
      throw new QuoteGenerationError("Malformed clarifyingQuestions: expected string array");
    }
    clarifyingQuestions = (rawQuestions as string[])
      .map((q) => q.trim())
      .filter((q) => q.length > 0)
      .slice(0, MAX_CLARIFYING_QUESTIONS);
  }

  return { lineItems, riskFlags, clarifyingQuestions };
}

/**
 * Validates and resolves a single raw line item from the model's tool-use
 * response into a GeneratedLineItem.
 *
 * Trust boundary (issue #200): when the model selects an existing catalog
 * item via priceListItemId, the description/unit/unitPriceCents on the
 * resulting line item come exclusively from the server's own priceList
 * array (the same one passed into generateLineItems), never from anything
 * the model echoed back. This is what closes the price-drift bug that used
 * to require the fragile matchPriceListItemId() heuristic after the fact --
 * there is no "echoed" price to drift, because we never read one for
 * catalog items. A priceListItemId that doesn't exist in the given price
 * list is treated as malformed input and throws, rather than silently
 * guessing or falling back to a custom item.
 *
 * For a custom item (priceListItemId omitted), customUnitPriceCents and
 * customDescription are used as-is -- same trust level as the old flat
 * unitPriceCents/description fields, since there's no catalog row to
 * ground-truth against.
 */
function resolveLineItem(
  raw: unknown,
  index: number,
  priceListById: Map<string, PriceListItem>,
): GeneratedLineItem {
  if (typeof raw !== "object" || raw === null) {
    throw new QuoteGenerationError(`Malformed line item at index ${index}`);
  }
  const item = raw as Record<string, unknown>;

  if (
    typeof item.quantity !== "number" ||
    !Number.isFinite(item.quantity) ||
    item.quantity <= 0
  ) {
    throw new QuoteGenerationError(`Invalid quantity at index ${index}`);
  }

  if (
    typeof item.itemType !== "string" ||
    !(ITEM_TYPES as readonly string[]).includes(item.itemType)
  ) {
    throw new QuoteGenerationError(`Missing or invalid itemType at index ${index}`);
  }

  if (typeof item.quantityReasoning !== "string" || item.quantityReasoning.trim().length === 0) {
    throw new QuoteGenerationError(`Missing quantityReasoning at index ${index}`);
  }

  const hasPriceListItemId = typeof item.priceListItemId === "string" && item.priceListItemId.length > 0;
  const hasCustom =
    typeof item.customUnitPriceCents === "number" && typeof item.customDescription === "string";

  if (hasPriceListItemId === hasCustom) {
    // Either neither was provided, or both were -- the schema requires
    // exactly one of the two shapes.
    throw new QuoteGenerationError(
      `Line item at index ${index} must specify exactly one of priceListItemId or customUnitPriceCents+customDescription`,
    );
  }

  if (hasPriceListItemId) {
    const priceListItem = priceListById.get(item.priceListItemId as string);
    if (!priceListItem) {
      throw new QuoteGenerationError(
        `Line item at index ${index} references unknown priceListItemId "${item.priceListItemId as string}"`,
      );
    }
    return {
      description: priceListItem.label,
      quantity: item.quantity,
      unit: priceListItem.unit,
      unitPriceCents: priceListItem.unitPriceCents,
      itemType: item.itemType as ItemType,
      quantityReasoning: (item.quantityReasoning as string).trim(),
      priceListItemId: priceListItem.id,
    };
  }

  const customUnitPriceCents = item.customUnitPriceCents as number;
  const customDescription = item.customDescription as string;
  const unit = typeof item.unit === "string" ? item.unit : "";

  if (
    !Number.isFinite(customUnitPriceCents) ||
    !Number.isInteger(customUnitPriceCents) ||
    customUnitPriceCents <= 0
  ) {
    throw new QuoteGenerationError(`Invalid customUnitPriceCents at index ${index}`);
  }
  if (customDescription.trim().length === 0) {
    throw new QuoteGenerationError(`Empty customDescription at index ${index}`);
  }
  if (unit.trim().length === 0) {
    throw new QuoteGenerationError(`Missing unit for custom line item at index ${index}`);
  }

  return {
    description: customDescription,
    quantity: item.quantity,
    unit,
    unitPriceCents: customUnitPriceCents,
    itemType: item.itemType as ItemType,
    quantityReasoning: (item.quantityReasoning as string).trim(),
    priceListItemId: null,
  };
}

function parseRiskFlags(raw: unknown): RiskFlag[] {
  if (raw === undefined || raw === null) {
    return [];
  }
  if (!Array.isArray(raw)) {
    // Malformed risk flags are non-critical for the core quoting flow --
    // degrade gracefully to "no flags" rather than failing the whole
    // generation (line items are the load-bearing part of this response).
    return [];
  }

  const flags: RiskFlag[] = [];
  for (const entry of raw) {
    if (
      typeof entry === "object" &&
      entry !== null &&
      typeof (entry as Record<string, unknown>).type === "string" &&
      (RISK_FLAG_TYPES as readonly string[]).includes((entry as Record<string, unknown>).type as string) &&
      typeof (entry as Record<string, unknown>).message === "string" &&
      (entry as Record<string, unknown>).message !== ""
    ) {
      flags.push({
        type: (entry as Record<string, unknown>).type as RiskFlagType,
        message: (entry as Record<string, unknown>).message as string,
      });
    }
  }
  return flags;
}

// Risk-flag trigger conditions (issue #193). Kept as an explicit instruction
// block appended to the existing prompt rather than a second LLM call --
// same single tool-use response carries lineItems, riskFlags, and
// clarifyingQuestions together. These are heuristic-assisted LLM judgments,
// not a certified compliance check -- see the in-app disclaimer in
// app/(app)/quotes/[id]/RiskFlagsNotice.tsx.
const RISK_FLAG_INSTRUCTIONS = `Additionally, review the job description for these three known German-market risk categories and include a "riskFlags" entry for each one that clearly applies (leave riskFlags empty if none apply):

1. "asbestos" -- the building was built or last renovated before roughly 1993 (Germany's asbestos ban year) AND the job involves demolishing/removing flooring, ceiling panels, facade panels, or old pipe insulation (classic asbestos-containing materials from that era).
2. "weg_approval" -- the job affects common property in a multi-unit building (facade, roof, load-bearing walls, shared plumbing risers, balconies) -- this typically requires a WEG (Wohnungseigentümergemeinschaft) owners'-meeting resolution before work starts.
3. "denkmalschutz" -- the building is described as old/historic/listed AND facade or structural changes are planned -- this may require Denkmalschutzbehörde (heritage authority) approval.

Only flag a category when the description gives a clear, specific signal -- do not flag speculatively. For each flag, write a short German-language "message" explaining what to check and with whom (Hausverwaltung, Denkmalschutzbehörde, etc.).`;

export function buildPrompt(description: string, priceList: PriceListItem[]): string {
  const priceListText = priceList
    .map(
      (p) =>
        `- id=${p.id}: ${p.label} (${p.category}): ${(p.unitPriceCents / 100).toFixed(2)} EUR / ${p.unit}`,
    )
    .join("\n");

  return `You are pricing a job for a German Handwerker (tradesperson) using their price list below. Given the job description, produce a list of line items with realistic quantities. All prices are in EUR cents.

For each line item, strongly prefer selecting an existing price list item by its id whenever the job description matches one -- even approximately (e.g. a "Fliesen verlegen" job should use the exact "Fliesenleger, Fliesen verlegen" catalog entry by id if present, not invent a new price for it). Only propose a custom item (with your own customUnitPriceCents, customDescription, and unit) when nothing in the price list reasonably fits. Never invent a price for something that's already in the price list -- always reference it by id instead so the exact catalog price is used.

For every line item, classify it as itemType "labor" (work performed) or "material" (goods/parts used), and provide a short quantityReasoning in German (matching this app's existing German-language line item style) briefly explaining how you derived the quantity, e.g. "6m² Boden / 1,5m² pro Paket = 4 Pakete, aufgerundet".

Prefer producing a complete draft with reasonable assumptions whenever you can -- the tradesperson reviews and edits every draft before sending it, so a confident best guess is far more useful than a stalled draft. Only include clarifyingQuestions (at most 3) when a detail is genuinely blocking -- you cannot produce any reasonable estimate without it (e.g. "Wie viele Quadratmeter hat das Badezimmer?" when materials can't be quantified at all without an area). Do NOT ask about stylistic preferences, exact brand/color choices, or anything you can safely default -- still produce the full lineItems draft even when you do ask a question.

Price list:
${priceListText}

Job description:
${description}

${RISK_FLAG_INSTRUCTIONS}`;
}

export async function generateLineItems(
  description: string,
  priceList: PriceListItem[],
): Promise<GenerateLineItemsResult> {
  const anthropic = new Anthropic();

  let response;
  try {
    response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 2048,
      tools: [LINE_ITEMS_TOOL],
      tool_choice: { type: "tool", name: "submit_line_items" },
      messages: [{ role: "user", content: buildPrompt(description, priceList) }],
    });
  } catch (err) {
    throw new QuoteGenerationError(`Anthropic API call failed: ${(err as Error).message}`, {
      cause: err,
    });
  }

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new QuoteGenerationError("AI response did not include tool use");
  }

  return parseGenerateLineItemsToolInput(toolUse.input, priceList);
}
