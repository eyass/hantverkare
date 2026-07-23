import Anthropic from "@anthropic-ai/sdk";
import type { LineItem } from "./types";

export class QuoteGenerationError extends Error {}

export type PriceListItem = {
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

export type GenerateLineItemsResult = {
  lineItems: LineItem[];
  riskFlags: RiskFlag[];
};

const LINE_ITEMS_TOOL = {
  name: "submit_line_items",
  description:
    "Submit the structured list of quote line items extracted from the job description, plus any known German-market risk flags the job description surfaces.",
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
    },
    required: ["lineItems"],
  },
};

export function parseLineItemsToolInput(input: unknown): LineItem[] {
  return parseGenerateLineItemsToolInput(input).lineItems;
}

export function parseGenerateLineItemsToolInput(input: unknown): GenerateLineItemsResult {
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

  const lineItems = rawItems.map((raw, index) => {
    if (
      typeof raw !== "object" ||
      raw === null ||
      typeof (raw as Record<string, unknown>).description !== "string" ||
      typeof (raw as Record<string, unknown>).quantity !== "number" ||
      typeof (raw as Record<string, unknown>).unit !== "string" ||
      typeof (raw as Record<string, unknown>).unitPriceCents !== "number" ||
      !Number.isInteger((raw as Record<string, unknown>).unitPriceCents)
    ) {
      throw new QuoteGenerationError(`Malformed line item at index ${index}`);
    }

    const item = raw as LineItem;
    if (
      !Number.isFinite(item.quantity) || item.quantity <= 0 ||
      !Number.isFinite(item.unitPriceCents) || item.unitPriceCents <= 0
    ) {
      throw new QuoteGenerationError(`Invalid quantity or price at index ${index}`);
    }
    return item;
  });

  const riskFlags = parseRiskFlags((input as { riskFlags?: unknown }).riskFlags);

  return { lineItems, riskFlags };
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
// same single tool-use response carries both lineItems and riskFlags. These
// are heuristic-assisted LLM judgments, not a certified compliance check --
// see the in-app disclaimer in app/(app)/quotes/[id]/RiskFlagsNotice.tsx.
const RISK_FLAG_INSTRUCTIONS = `Additionally, review the job description for these three known German-market risk categories and include a "riskFlags" entry for each one that clearly applies (leave riskFlags empty if none apply):

1. "asbestos" -- the building was built or last renovated before roughly 1993 (Germany's asbestos ban year) AND the job involves demolishing/removing flooring, ceiling panels, facade panels, or old pipe insulation (classic asbestos-containing materials from that era).
2. "weg_approval" -- the job affects common property in a multi-unit building (facade, roof, load-bearing walls, shared plumbing risers, balconies) -- this typically requires a WEG (Wohnungseigentümergemeinschaft) owners'-meeting resolution before work starts.
3. "denkmalschutz" -- the building is described as old/historic/listed AND facade or structural changes are planned -- this may require Denkmalschutzbehörde (heritage authority) approval.

Only flag a category when the description gives a clear, specific signal -- do not flag speculatively. For each flag, write a short German-language "message" explaining what to check and with whom (Hausverwaltung, Denkmalschutzbehörde, etc.).`;

export function buildPrompt(description: string, priceList: PriceListItem[]): string {
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

  return parseGenerateLineItemsToolInput(toolUse.input);
}
