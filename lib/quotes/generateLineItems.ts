import Anthropic from "@anthropic-ai/sdk";
import type { LineItem } from "./types";

export class QuoteGenerationError extends Error {}

export type PriceListItem = {
  label: string;
  unit: string;
  unitPriceCents: number;
  category: string;
};

const LINE_ITEMS_TOOL = {
  name: "submit_line_items",
  description:
    "Submit the structured list of quote line items extracted from the job description.",
  input_schema: {
    type: "object" as const,
    properties: {
      lineItems: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            description: { type: "string" as const },
            quantity: { type: "number" as const },
            unit: { type: "string" as const },
            unitPriceCents: { type: "integer" as const },
          },
          required: ["description", "quantity", "unit", "unitPriceCents"],
        },
      },
    },
    required: ["lineItems"],
  },
};

export function parseLineItemsToolInput(input: unknown): LineItem[] {
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

  return rawItems.map((raw, index) => {
    if (
      typeof raw !== "object" ||
      raw === null ||
      typeof (raw as Record<string, unknown>).description !== "string" ||
      typeof (raw as Record<string, unknown>).quantity !== "number" ||
      typeof (raw as Record<string, unknown>).unit !== "string" ||
      typeof (raw as Record<string, unknown>).unitPriceCents !== "number"
    ) {
      throw new QuoteGenerationError(`Malformed line item at index ${index}`);
    }

    const item = raw as LineItem;
    if (item.quantity <= 0 || item.unitPriceCents <= 0) {
      throw new QuoteGenerationError(`Invalid quantity or price at index ${index}`);
    }
    return item;
  });
}

function buildPrompt(description: string, priceList: PriceListItem[]): string {
  const priceListText = priceList
    .map(
      (p) =>
        `- ${p.label} (${p.category}): ${(p.unitPriceCents / 100).toFixed(2)} EUR / ${p.unit}`,
    )
    .join("\n");

  return `You are pricing a job for a German Handwerker (tradesperson) using their price list below. Given the job description, produce a list of line items with realistic quantities and unit prices drawn from the price list (or a reasonable estimate if nothing matches). All prices are in EUR cents.

Price list:
${priceListText}

Job description:
${description}`;
}

export async function generateLineItems(
  description: string,
  priceList: PriceListItem[],
): Promise<LineItem[]> {
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
    throw new QuoteGenerationError(`Anthropic API call failed: ${(err as Error).message}`);
  }

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new QuoteGenerationError("AI response did not include tool use");
  }

  return parseLineItemsToolInput(toolUse.input);
}
