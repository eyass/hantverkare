import Anthropic from "@anthropic-ai/sdk";
import type { LineItem } from "./types";
import type { PriceListItem } from "./generateLineItems";

export class ManualLineItemError extends Error {}

// Re-exported so callers don't need to import from generateLineItems just to
// get the shape of the org's price list.
export type { PriceListItem };

/**
 * A resolved manual quick-add line item, ready to be priced/inserted.
 * Mirrors the trust-boundary of GeneratedLineItem in generateLineItems.ts:
 * when priceListItemId is set, description/unit/unitPriceCents come
 * exclusively from the server's own price list row passed into
 * resolveManualLineItem -- never from anything the model echoed back. A
 * custom item (priceListItemId null) uses the model's own proposed price,
 * since there is no catalog row to ground-truth against.
 */
export type ResolvedManualLineItem = LineItem & {
  priceListItemId: string | null;
};

const MANUAL_LINE_ITEM_TOOL = {
  name: "resolve_line_item",
  description:
    "Resolve a single free-text line item description into a quantity, unit, and either a matching " +
    "price list entry or a custom price.",
  input_schema: {
    type: "object" as const,
    properties: {
      quantity: { type: "number" as const },
      priceListItemId: {
        type: "string" as const,
        description:
          "The id of the matching price list item, when the description clearly matches an existing " +
          "catalog entry (prefer this over inventing a price whenever reasonably possible). Omit entirely " +
          "when using a custom item instead.",
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
    required: ["quantity"],
  },
};

export function buildManualLineItemPrompt(description: string, priceList: PriceListItem[]): string {
  const priceListText = priceList
    .map(
      (p) =>
        `- id=${p.id}: ${p.label} (${p.category}): ${(p.unitPriceCents / 100).toFixed(2)} EUR / ${p.unit}`,
    )
    .join("\n");

  return `You are adding one additional line item to an existing German Handwerker (tradesperson) quote, using their price list below. Given the short free-text description of the item to add, resolve a realistic quantity and either a matching price list entry or a custom price. All prices are in EUR cents.

Strongly prefer selecting an existing price list item by its id whenever the description matches one -- even approximately. Only propose a custom item (with your own customUnitPriceCents, customDescription, and unit) when nothing in the price list reasonably fits. Never invent a price for something that's already in the price list -- always reference it by id instead so the exact catalog price is used.

Price list:
${priceListText}

Item to add:
${description}`;
}

/**
 * Validates and resolves the model's tool-use response into a
 * ResolvedManualLineItem. Same trust boundary as resolveLineItem in
 * generateLineItems.ts: a priceListItemId is resolved exclusively against
 * the server's own priceList array, never trusting an echoed price/label
 * from the model. A priceListItemId that doesn't exist in the given price
 * list is treated as malformed input and throws.
 */
export function parseManualLineItemToolInput(
  input: unknown,
  priceList: PriceListItem[],
): ResolvedManualLineItem {
  if (typeof input !== "object" || input === null) {
    throw new ManualLineItemError("Malformed tool input");
  }
  const item = input as Record<string, unknown>;

  if (typeof item.quantity !== "number" || !Number.isFinite(item.quantity) || item.quantity <= 0) {
    throw new ManualLineItemError("Invalid quantity");
  }

  const priceListById = new Map(priceList.map((p) => [p.id, p]));

  const hasPriceListItemId = typeof item.priceListItemId === "string" && item.priceListItemId.length > 0;
  const hasCustom =
    typeof item.customUnitPriceCents === "number" && typeof item.customDescription === "string";

  if (hasPriceListItemId === hasCustom) {
    throw new ManualLineItemError(
      "Line item must specify exactly one of priceListItemId or customUnitPriceCents+customDescription",
    );
  }

  if (hasPriceListItemId) {
    const priceListItem = priceListById.get(item.priceListItemId as string);
    if (!priceListItem) {
      throw new ManualLineItemError(
        `Line item references unknown priceListItemId "${item.priceListItemId as string}"`,
      );
    }
    return {
      description: priceListItem.label,
      quantity: item.quantity,
      unit: priceListItem.unit,
      unitPriceCents: priceListItem.unitPriceCents,
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
    throw new ManualLineItemError("Invalid customUnitPriceCents");
  }
  if (customDescription.trim().length === 0) {
    throw new ManualLineItemError("Empty customDescription");
  }
  if (unit.trim().length === 0) {
    throw new ManualLineItemError("Missing unit for custom line item");
  }

  return {
    description: customDescription,
    quantity: item.quantity,
    unit,
    unitPriceCents: customUnitPriceCents,
    priceListItemId: null,
  };
}

export async function resolveManualLineItem(
  description: string,
  priceList: PriceListItem[],
): Promise<ResolvedManualLineItem> {
  const anthropic = new Anthropic();

  let response;
  try {
    response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 512,
      tools: [MANUAL_LINE_ITEM_TOOL],
      tool_choice: { type: "tool", name: "resolve_line_item" },
      messages: [{ role: "user", content: buildManualLineItemPrompt(description, priceList) }],
    });
  } catch (err) {
    throw new ManualLineItemError(`Anthropic API call failed: ${(err as Error).message}`, {
      cause: err,
    });
  }

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new ManualLineItemError("AI response did not include tool use");
  }

  return parseManualLineItemToolInput(toolUse.input, priceList);
}
