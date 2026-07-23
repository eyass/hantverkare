import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseLineItemsToolInput,
  parseGenerateLineItemsToolInput,
  buildPrompt,
  generateLineItems,
  QuoteGenerationError,
  type PriceListItem,
} from "./generateLineItems";

// Mock the Anthropic client entirely -- these tests exercise deterministic
// prompt-construction and schema-parsing logic (issue #193/#200/#202), never
// a real LLM call. Each test controls exactly what "the model" returns via
// the mocked tool_use response.
const mockCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
  },
}));

const priceList: PriceListItem[] = [
  { id: "pli-1", label: "Fliesen verlegen", unit: "m²", unitPriceCents: 4500, category: "Bodenbelag" },
  { id: "pli-2", label: "Bodenbelag entfernen", unit: "m²", unitPriceCents: 1500, category: "Abbruch" },
  { id: "pli-3", label: "Fassadenarbeiten", unit: "m²", unitPriceCents: 8000, category: "Fassade" },
];

describe("parseLineItemsToolInput", () => {
  it("parses a well-formed tool input, resolving priceListItemId against the price list", () => {
    const input = {
      lineItems: [
        {
          quantity: 12,
          itemType: "labor",
          quantityReasoning: "12 m² laut Beschreibung.",
          confidence: "high",
          priceListItemId: "pli-1",
        },
      ],
    };
    const result = parseLineItemsToolInput(input, priceList);
    expect(result).toEqual([
      {
        description: "Fliesen verlegen",
        quantity: 12,
        unit: "m²",
        unitPriceCents: 4500,
        itemType: "labor",
        quantityReasoning: "12 m² laut Beschreibung.",
        confidence: "high",
        priceListItemId: "pli-1",
        groupLabel: null,
      },
    ]);
  });

  it("throws when lineItems is missing", () => {
    expect(() => parseLineItemsToolInput({}, priceList)).toThrow(QuoteGenerationError);
  });

  it("throws when lineItems is empty", () => {
    expect(() => parseLineItemsToolInput({ lineItems: [] }, priceList)).toThrow(QuoteGenerationError);
  });

  it("throws when quantity is zero or negative", () => {
    const input = {
      lineItems: [
        { quantity: 0, itemType: "labor", quantityReasoning: "x", confidence: "high", priceListItemId: "pli-1" },
      ],
    };
    expect(() => parseLineItemsToolInput(input, priceList)).toThrow(QuoteGenerationError);
  });

  it("throws when quantity is NaN or Infinity", () => {
    const nanInput = {
      lineItems: [
        { quantity: NaN, itemType: "labor", quantityReasoning: "x", confidence: "high", priceListItemId: "pli-1" },
      ],
    };
    const infInput = {
      lineItems: [
        { quantity: Infinity, itemType: "labor", quantityReasoning: "x", confidence: "high", priceListItemId: "pli-1" },
      ],
    };
    expect(() => parseLineItemsToolInput(nanInput, priceList)).toThrow(QuoteGenerationError);
    expect(() => parseLineItemsToolInput(infInput, priceList)).toThrow(QuoteGenerationError);
  });

  it("throws when itemType is missing or invalid", () => {
    const missing = {
      lineItems: [{ quantity: 1, quantityReasoning: "x", confidence: "high", priceListItemId: "pli-1" }],
    };
    const invalid = {
      lineItems: [
        { quantity: 1, itemType: "not_a_type", quantityReasoning: "x", confidence: "high", priceListItemId: "pli-1" },
      ],
    };
    expect(() => parseLineItemsToolInput(missing, priceList)).toThrow(QuoteGenerationError);
    expect(() => parseLineItemsToolInput(invalid, priceList)).toThrow(QuoteGenerationError);
  });

  it("throws when quantityReasoning is missing (forced reasoning is required)", () => {
    const input = {
      lineItems: [{ quantity: 1, itemType: "labor", confidence: "high", priceListItemId: "pli-1" }],
    };
    expect(() => parseLineItemsToolInput(input, priceList)).toThrow(QuoteGenerationError);
  });

  it("throws when quantityReasoning is an empty/blank string", () => {
    const input = {
      lineItems: [
        { quantity: 1, itemType: "labor", quantityReasoning: "   ", confidence: "high", priceListItemId: "pli-1" },
      ],
    };
    expect(() => parseLineItemsToolInput(input, priceList)).toThrow(QuoteGenerationError);
  });

  it("throws when neither priceListItemId nor a custom item is provided", () => {
    const input = {
      lineItems: [{ quantity: 1, itemType: "labor", quantityReasoning: "x", confidence: "high" }],
    };
    expect(() => parseLineItemsToolInput(input, priceList)).toThrow(QuoteGenerationError);
  });

  it("throws when both priceListItemId and a custom item are provided", () => {
    const input = {
      lineItems: [
        {
          quantity: 1,
          itemType: "labor",
          quantityReasoning: "x",
          confidence: "high",
          priceListItemId: "pli-1",
          customUnitPriceCents: 1000,
          customDescription: "Custom",
        },
      ],
    };
    expect(() => parseLineItemsToolInput(input, priceList)).toThrow(QuoteGenerationError);
  });
});

describe("parseLineItemsToolInput confidence (issue #202)", () => {
  it("throws when confidence is missing", () => {
    const input = {
      lineItems: [{ quantity: 1, itemType: "labor", quantityReasoning: "x", priceListItemId: "pli-1" }],
    };
    expect(() => parseLineItemsToolInput(input, priceList)).toThrow(QuoteGenerationError);
  });

  it("throws when confidence is an invalid value", () => {
    const input = {
      lineItems: [
        {
          quantity: 1,
          itemType: "labor",
          quantityReasoning: "x",
          confidence: "very_sure",
          priceListItemId: "pli-1",
        },
      ],
    };
    expect(() => parseLineItemsToolInput(input, priceList)).toThrow(QuoteGenerationError);
  });

  it("throws when confidence is not a string", () => {
    const input = {
      lineItems: [
        { quantity: 1, itemType: "labor", quantityReasoning: "x", confidence: 1, priceListItemId: "pli-1" },
      ],
    };
    expect(() => parseLineItemsToolInput(input, priceList)).toThrow(QuoteGenerationError);
  });

  it.each(["high", "medium", "low"] as const)("accepts confidence '%s'", (confidence) => {
    const input = {
      lineItems: [
        { quantity: 1, itemType: "labor", quantityReasoning: "x", confidence, priceListItemId: "pli-1" },
      ],
    };
    const result = parseLineItemsToolInput(input, priceList);
    expect(result[0].confidence).toBe(confidence);
  });
});

describe("parseLineItemsToolInput groupLabel (issue #205)", () => {
  it("defaults groupLabel to null when the field is absent", () => {
    const input = {
      lineItems: [
        { quantity: 1, itemType: "labor", quantityReasoning: "x", confidence: "high", priceListItemId: "pli-1" },
      ],
    };
    const result = parseLineItemsToolInput(input, priceList);
    expect(result[0].groupLabel).toBeNull();
  });

  it("accepts a valid groupLabel string", () => {
    const input = {
      lineItems: [
        {
          quantity: 1,
          itemType: "labor",
          quantityReasoning: "x",
          confidence: "high",
          priceListItemId: "pli-1",
          groupLabel: "Küche",
        },
      ],
    };
    const result = parseLineItemsToolInput(input, priceList);
    expect(result[0].groupLabel).toBe("Küche");
  });

  it("trims a groupLabel and treats a blank/whitespace-only value as ungrouped", () => {
    const input = {
      lineItems: [
        {
          quantity: 1,
          itemType: "labor",
          quantityReasoning: "x",
          confidence: "high",
          priceListItemId: "pli-1",
          groupLabel: "  Bad  ",
        },
        {
          quantity: 1,
          itemType: "labor",
          quantityReasoning: "x",
          confidence: "high",
          priceListItemId: "pli-1",
          groupLabel: "   ",
        },
      ],
    };
    const result = parseLineItemsToolInput(input, priceList);
    expect(result[0].groupLabel).toBe("Bad");
    expect(result[1].groupLabel).toBeNull();
  });

  it("throws when groupLabel is not a string", () => {
    const input = {
      lineItems: [
        {
          quantity: 1,
          itemType: "labor",
          quantityReasoning: "x",
          confidence: "high",
          priceListItemId: "pli-1",
          groupLabel: 42,
        },
      ],
    };
    expect(() => parseLineItemsToolInput(input, priceList)).toThrow(QuoteGenerationError);
  });
});

describe("priceListItemId trust boundary (issue #200)", () => {
  it("uses the server's own price list unit/price, ignoring any AI-echoed values for a catalog item", () => {
    // Even if the model's tool input somehow included a drifted price or
    // unit alongside priceListItemId, resolveLineItem never reads those
    // fields for a catalog item -- only priceListItemId is consulted, and
    // description/unit/unitPriceCents always come from the price list row.
    const input = {
      lineItems: [
        {
          quantity: 5,
          itemType: "material",
          quantityReasoning: "5 m² laut Aufmaß.",
          confidence: "medium",
          priceListItemId: "pli-2",
          // Not part of the schema for a priceListItemId item, but even if
          // present should never be trusted:
          unitPriceCents: 999999,
          unit: "Liter",
          description: "Komplett andere Beschreibung",
        },
      ],
    };
    const result = parseLineItemsToolInput(input, priceList);
    expect(result).toEqual([
      {
        description: "Bodenbelag entfernen",
        quantity: 5,
        unit: "m²",
        unitPriceCents: 1500,
        itemType: "material",
        quantityReasoning: "5 m² laut Aufmaß.",
        confidence: "medium",
        priceListItemId: "pli-2",
        groupLabel: null,
      },
    ]);
  });

  it("keeps a custom item's own price/description/unit as-is", () => {
    const input = {
      lineItems: [
        {
          quantity: 2,
          itemType: "material",
          quantityReasoning: "2 Stück laut Beschreibung.",
          confidence: "low",
          customUnitPriceCents: 12345,
          customDescription: "Spezialdichtung",
          unit: "Stück",
        },
      ],
    };
    const result = parseLineItemsToolInput(input, priceList);
    expect(result).toEqual([
      {
        description: "Spezialdichtung",
        quantity: 2,
        unit: "Stück",
        unitPriceCents: 12345,
        itemType: "material",
        quantityReasoning: "2 Stück laut Beschreibung.",
        confidence: "low",
        priceListItemId: null,
        groupLabel: null,
      },
    ]);
  });

  it("throws QuoteGenerationError when priceListItemId doesn't exist in the given price list", () => {
    const input = {
      lineItems: [
        {
          quantity: 1,
          itemType: "labor",
          quantityReasoning: "x",
          confidence: "high",
          priceListItemId: "does-not-exist",
        },
      ],
    };
    expect(() => parseLineItemsToolInput(input, priceList)).toThrow(QuoteGenerationError);
  });
});

describe("parseGenerateLineItemsToolInput risk flags (issue #193)", () => {
  const baseLineItems = [
    { quantity: 1, itemType: "labor", quantityReasoning: "x", confidence: "high", priceListItemId: "pli-1" },
  ];

  it("returns an empty riskFlags array when the field is absent", () => {
    const result = parseGenerateLineItemsToolInput({ lineItems: baseLineItems }, priceList);
    expect(result.riskFlags).toEqual([]);
  });

  it("parses well-formed risk flags", () => {
    const result = parseGenerateLineItemsToolInput(
      {
        lineItems: baseLineItems,
        riskFlags: [{ type: "asbestos", message: "Baujahr vor 1993, Bodenbelag wird entfernt." }],
      },
      priceList,
    );
    expect(result.riskFlags).toEqual([
      { type: "asbestos", message: "Baujahr vor 1993, Bodenbelag wird entfernt." },
    ]);
  });

  it("drops entries with an unknown type", () => {
    const result = parseGenerateLineItemsToolInput(
      {
        lineItems: baseLineItems,
        riskFlags: [{ type: "not_a_real_type", message: "should be dropped" }],
      },
      priceList,
    );
    expect(result.riskFlags).toEqual([]);
  });

  it("degrades to an empty array when riskFlags is malformed (non-array)", () => {
    const result = parseGenerateLineItemsToolInput(
      { lineItems: baseLineItems, riskFlags: "oops" },
      priceList,
    );
    expect(result.riskFlags).toEqual([]);
  });
});

describe("parseGenerateLineItemsToolInput clarifying questions (issue #194)", () => {
  const baseLineItems = [
    { quantity: 1, itemType: "labor", quantityReasoning: "x", confidence: "high", priceListItemId: "pli-1" },
  ];

  it("returns an empty clarifyingQuestions array when the field is absent", () => {
    const result = parseGenerateLineItemsToolInput({ lineItems: baseLineItems }, priceList);
    expect(result.clarifyingQuestions).toEqual([]);
  });

  it("parses clarifying questions when present, capped at 3, trimmed and empty ones dropped", () => {
    const input = {
      lineItems: baseLineItems,
      clarifyingQuestions: [
        " Wie viele Quadratmeter hat das Bad? ",
        "",
        "Welche Fliesenfarbe?",
        "Gibt es einen Bodenablauf?",
        "Ist Strom vorhanden?",
      ],
    };
    const result = parseGenerateLineItemsToolInput(input, priceList);
    expect(result.clarifyingQuestions).toEqual([
      "Wie viele Quadratmeter hat das Bad?",
      "Welche Fliesenfarbe?",
      "Gibt es einen Bodenablauf?",
    ]);
  });

  it("throws when clarifyingQuestions contains a non-string", () => {
    const input = {
      lineItems: baseLineItems,
      clarifyingQuestions: ["ok", 5],
    };
    expect(() => parseGenerateLineItemsToolInput(input, priceList)).toThrow(QuoteGenerationError);
  });

  it("returns both riskFlags and clarifyingQuestions together when both are present", () => {
    const result = parseGenerateLineItemsToolInput(
      {
        lineItems: baseLineItems,
        riskFlags: [{ type: "asbestos", message: "Baujahr vor 1993." }],
        clarifyingQuestions: ["Wie viele Quadratmeter?"],
      },
      priceList,
    );
    expect(result.riskFlags).toHaveLength(1);
    expect(result.clarifyingQuestions).toEqual(["Wie viele Quadratmeter?"]);
  });
});

describe("buildPrompt", () => {
  it("always includes the risk-flag instruction block alongside the job description", () => {
    const prompt = buildPrompt("Badezimmer renovieren", priceList);
    expect(prompt).toContain("Badezimmer renovieren");
    expect(prompt).toContain("asbestos");
    expect(prompt).toContain("weg_approval");
    expect(prompt).toContain("denkmalschutz");
  });

  it("includes the job description and price list with ids for a description missing a critical quantity", () => {
    const description = "Badezimmer neu fliesen"; // no square meterage given
    const prompt = buildPrompt(description, priceList);
    expect(prompt).toContain(description);
    expect(prompt).toContain("id=pli-1");
    expect(prompt).toContain("Fliesen verlegen");
    expect(prompt).toContain("45.00 EUR / m²");
  });

  it("includes the job description and price list for a complete description", () => {
    const description = "12 m² Badezimmer fliesen mit Fliesen verlegen, weiße Fliesen 20x20cm";
    const prompt = buildPrompt(description, priceList);
    expect(prompt).toContain(description);
    expect(prompt).toContain("Fliesen verlegen");
  });

  it("instructs the model to prefer selecting an existing price list item by id over inventing a custom price", () => {
    const prompt = buildPrompt("Irgendein Auftrag", priceList);
    expect(prompt).toContain("strongly prefer selecting an existing price list item by its id");
    expect(prompt).toContain("Never invent a price for something that's already in the price list");
  });

  it("always instructs the model to prefer a complete draft and cap questions at 3", () => {
    const prompt = buildPrompt("Irgendein Auftrag", priceList);
    expect(prompt).toContain("Prefer producing a complete draft with reasonable assumptions");
    expect(prompt).toContain("at most 3");
  });

  it("always includes the auxiliary-cost instruction block (issue #202)", () => {
    const prompt = buildPrompt("Irgendein Auftrag", priceList);
    expect(prompt).toContain("Anfahrt");
    expect(prompt).toContain("Entsorgung");
    expect(prompt).toContain("Kleinmaterial");
  });

  it("instructs the model to set a confidence per line item (issue #202)", () => {
    const prompt = buildPrompt("Irgendein Auftrag", priceList);
    expect(prompt).toContain("confidence");
  });

  it("omits any few-shot history section when pastQuotesContext is not provided", () => {
    const prompt = buildPrompt("Irgendein Auftrag", priceList);
    expect(prompt).not.toContain("recent examples of how this organization has priced");
  });

  it("omits any few-shot history section when pastQuotesContext is undefined explicitly", () => {
    const prompt = buildPrompt("Irgendein Auftrag", priceList, undefined);
    expect(prompt).not.toContain("recent examples of how this organization has priced");
  });

  it("includes the few-shot history block and its content when pastQuotesContext is provided (issue #202)", () => {
    const history = 'Beispiel 1 (Auftrag: "Badezimmer fliesen"):\n  - Fliesen verlegen: 10 m² à 45.00 EUR';
    const prompt = buildPrompt("Irgendein Auftrag", priceList, history);
    expect(prompt).toContain("recent examples of how this organization has priced");
    expect(prompt).toContain(history);
  });
});

describe("generateLineItems risk-flag scenarios (issue #193, mocked AI client)", () => {
  function mockToolResponse(input: unknown) {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "tool_use", name: "submit_line_items", input }],
    });
  }

  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("surfaces an asbestos flag for old-building flooring demolition (pre-1993, panel/flooring removal)", async () => {
    mockToolResponse({
      lineItems: [
        {
          quantity: 20,
          itemType: "labor",
          quantityReasoning: "20 m² laut Beschreibung.",
          confidence: "high",
          priceListItemId: "pli-2",
        },
      ],
      riskFlags: [
        {
          type: "asbestos",
          message:
            "Gebäude Baujahr vor 1993, Entfernung von Bodenbelag -- möglicherweise asbesthaltig. Bitte fachgerecht prüfen lassen.",
        },
      ],
    });

    const result = await generateLineItems(
      "Wohnung Baujahr 1975, alter Bodenbelag im Flur soll entfernt und neu verlegt werden.",
      priceList,
    );

    expect(result.riskFlags).toHaveLength(1);
    expect(result.riskFlags[0].type).toBe("asbestos");
    expect(result.clarifyingQuestions).toEqual([]);
    expect(result.lineItems[0].unitPriceCents).toBe(1500);
  });

  it("surfaces a weg_approval flag for facade work in a multi-unit building", async () => {
    mockToolResponse({
      lineItems: [
        {
          quantity: 80,
          itemType: "labor",
          quantityReasoning: "80 m² laut Beschreibung.",
          confidence: "high",
          priceListItemId: "pli-3",
        },
      ],
      riskFlags: [
        {
          type: "weg_approval",
          message:
            "Fassadenarbeiten betreffen Gemeinschaftseigentum -- WEG-Beschluss vor Baubeginn einholen.",
        },
      ],
    });

    const result = await generateLineItems(
      "Mehrfamilienhaus: Fassade des gesamten Gebäudes soll gedämmt und neu verputzt werden.",
      priceList,
    );

    expect(result.riskFlags).toHaveLength(1);
    expect(result.riskFlags[0].type).toBe("weg_approval");
  });

  it("returns no risk flags for a routine job with no trigger conditions", async () => {
    mockToolResponse({
      lineItems: [
        {
          quantity: 12,
          itemType: "labor",
          quantityReasoning: "12 m² laut Beschreibung.",
          confidence: "high",
          priceListItemId: "pli-1",
        },
      ],
      riskFlags: [],
    });

    const result = await generateLineItems(
      "Neubau-Badezimmer soll neu gefliest werden, keine baulichen Änderungen.",
      priceList,
    );

    expect(result.riskFlags).toEqual([]);
  });

  it("surfaces both risk flags and clarifying questions from a single call", async () => {
    mockToolResponse({
      lineItems: [
        {
          quantity: 10,
          itemType: "labor",
          quantityReasoning: "10 m² geschätzt, Fläche unklar.",
          confidence: "medium",
          priceListItemId: "pli-2",
        },
      ],
      riskFlags: [{ type: "asbestos", message: "Baujahr vor 1993, Bodenbelag wird entfernt." }],
      clarifyingQuestions: ["Wie viele Quadratmeter genau?"],
    });

    const result = await generateLineItems(
      "Altbau vor 1993, Bodenbelag im Flur entfernen, Fläche unklar.",
      priceList,
    );

    expect(result.riskFlags).toHaveLength(1);
    expect(result.clarifyingQuestions).toEqual(["Wie viele Quadratmeter genau?"]);
  });

  it("throws QuoteGenerationError when the AI references a priceListItemId not in the given price list", async () => {
    mockToolResponse({
      lineItems: [
        {
          quantity: 1,
          itemType: "labor",
          quantityReasoning: "x",
          confidence: "high",
          priceListItemId: "hallucinated-id",
        },
      ],
    });

    await expect(
      generateLineItems("Irgendein Auftrag", priceList),
    ).rejects.toThrow(QuoteGenerationError);
  });

  it("throws QuoteGenerationError when the AI omits confidence on a line item (issue #202)", async () => {
    mockToolResponse({
      lineItems: [
        {
          quantity: 1,
          itemType: "labor",
          quantityReasoning: "x",
          priceListItemId: "pli-1",
        },
      ],
    });

    await expect(
      generateLineItems("Irgendein Auftrag", priceList),
    ).rejects.toThrow(QuoteGenerationError);
  });

  it("passes pastQuotesContext through into the constructed prompt sent to the model (issue #202)", async () => {
    mockToolResponse({
      lineItems: [
        {
          quantity: 1,
          itemType: "labor",
          quantityReasoning: "x",
          confidence: "high",
          priceListItemId: "pli-1",
        },
      ],
    });

    const history = 'Beispiel 1 (Auftrag: "Badezimmer fliesen"):\n  - Fliesen verlegen: 10 m² à 45.00 EUR';
    await generateLineItems("Irgendein Auftrag", priceList, history);

    const callArgs = mockCreate.mock.calls[0][0];
    const promptSent = callArgs.messages[0].content as string;
    expect(promptSent).toContain(history);
  });
});
