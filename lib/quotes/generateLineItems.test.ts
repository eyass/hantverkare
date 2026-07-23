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
// prompt-construction and schema-parsing logic (issue #193), never a real
// LLM call. Each test controls exactly what "the model" returns via the
// mocked tool_use response.
const mockCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
  },
}));

describe("parseLineItemsToolInput", () => {
  it("parses a well-formed tool input into line items", () => {
    const input = {
      lineItems: [
        { description: "Spüle austauschen", quantity: 1, unit: "Stück", unitPriceCents: 8000 },
        { description: "Sanitärinstallation", quantity: 2, unit: "Stunde", unitPriceCents: 6500 },
      ],
    };
    const result = parseLineItemsToolInput(input);
    expect(result).toEqual(input.lineItems);
  });

  it("throws when lineItems is missing", () => {
    expect(() => parseLineItemsToolInput({})).toThrow(QuoteGenerationError);
  });

  it("throws when lineItems is empty", () => {
    expect(() => parseLineItemsToolInput({ lineItems: [] })).toThrow(QuoteGenerationError);
  });

  it("throws when a line item is missing a required field", () => {
    const input = { lineItems: [{ description: "Test", quantity: 1, unit: "Stück" }] };
    expect(() => parseLineItemsToolInput(input)).toThrow(QuoteGenerationError);
  });

  it("throws when quantity is zero or negative", () => {
    const input = {
      lineItems: [{ description: "Test", quantity: 0, unit: "Stück", unitPriceCents: 1000 }],
    };
    expect(() => parseLineItemsToolInput(input)).toThrow(QuoteGenerationError);
  });

  it("throws when unitPriceCents is zero or negative", () => {
    const input = {
      lineItems: [{ description: "Test", quantity: 1, unit: "Stück", unitPriceCents: 0 }],
    };
    expect(() => parseLineItemsToolInput(input)).toThrow(QuoteGenerationError);
  });

  it("throws when quantity is NaN", () => {
    const input = {
      lineItems: [{ description: "Test", quantity: NaN, unit: "Stück", unitPriceCents: 1000 }],
    };
    expect(() => parseLineItemsToolInput(input)).toThrow(QuoteGenerationError);
  });

  it("throws when quantity is Infinity", () => {
    const input = {
      lineItems: [
        { description: "Test", quantity: Infinity, unit: "Stück", unitPriceCents: 1000 },
      ],
    };
    expect(() => parseLineItemsToolInput(input)).toThrow(QuoteGenerationError);
  });

  it("throws when unitPriceCents is NaN", () => {
    const input = {
      lineItems: [{ description: "Test", quantity: 1, unit: "Stück", unitPriceCents: NaN }],
    };
    expect(() => parseLineItemsToolInput(input)).toThrow(QuoteGenerationError);
  });

  it("throws when unitPriceCents is Infinity", () => {
    const input = {
      lineItems: [
        { description: "Test", quantity: 1, unit: "Stück", unitPriceCents: Infinity },
      ],
    };
    expect(() => parseLineItemsToolInput(input)).toThrow(QuoteGenerationError);
  });

  it("throws when unitPriceCents is not an integer", () => {
    const input = {
      lineItems: [{ description: "Test", quantity: 1, unit: "Stück", unitPriceCents: 99.5 }],
    };
    expect(() => parseLineItemsToolInput(input)).toThrow(QuoteGenerationError);
  });
});

describe("parseGenerateLineItemsToolInput risk flags (issue #193)", () => {
  const baseLineItems = [
    { description: "Test", quantity: 1, unit: "Stück", unitPriceCents: 1000 },
  ];

  it("returns an empty riskFlags array when the field is absent", () => {
    const result = parseGenerateLineItemsToolInput({ lineItems: baseLineItems });
    expect(result.riskFlags).toEqual([]);
  });

  it("parses well-formed risk flags", () => {
    const result = parseGenerateLineItemsToolInput({
      lineItems: baseLineItems,
      riskFlags: [{ type: "asbestos", message: "Baujahr vor 1993, Bodenbelag wird entfernt." }],
    });
    expect(result.riskFlags).toEqual([
      { type: "asbestos", message: "Baujahr vor 1993, Bodenbelag wird entfernt." },
    ]);
  });

  it("drops entries with an unknown type", () => {
    const result = parseGenerateLineItemsToolInput({
      lineItems: baseLineItems,
      riskFlags: [{ type: "not_a_real_type", message: "should be dropped" }],
    });
    expect(result.riskFlags).toEqual([]);
  });

  it("degrades to an empty array when riskFlags is malformed (non-array)", () => {
    const result = parseGenerateLineItemsToolInput({
      lineItems: baseLineItems,
      riskFlags: "oops",
    });
    expect(result.riskFlags).toEqual([]);
  });
});

describe("buildPrompt", () => {
  const priceList: PriceListItem[] = [
    { label: "Fliesen verlegen", unit: "m²", unitPriceCents: 4500, category: "Bodenbelag" },
  ];

  it("always includes the risk-flag instruction block alongside the job description", () => {
    const prompt = buildPrompt("Badezimmer renovieren", priceList);
    expect(prompt).toContain("Badezimmer renovieren");
    expect(prompt).toContain("asbestos");
    expect(prompt).toContain("weg_approval");
    expect(prompt).toContain("denkmalschutz");
  });
});

describe("generateLineItems risk-flag scenarios (issue #193, mocked AI client)", () => {
  const priceList: PriceListItem[] = [
    { label: "Bodenbelag entfernen", unit: "m²", unitPriceCents: 1500, category: "Abbruch" },
    { label: "Fassadenarbeiten", unit: "m²", unitPriceCents: 8000, category: "Fassade" },
    { label: "Badezimmer neu fliesen", unit: "m²", unitPriceCents: 4500, category: "Bodenbelag" },
  ];

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
        { description: "Alten Bodenbelag entfernen", quantity: 20, unit: "m²", unitPriceCents: 1500 },
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
  });

  it("surfaces a weg_approval flag for facade work in a multi-unit building", async () => {
    mockToolResponse({
      lineItems: [
        { description: "Fassadendämmung anbringen", quantity: 80, unit: "m²", unitPriceCents: 8000 },
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
        { description: "Badezimmer neu fliesen", quantity: 12, unit: "m²", unitPriceCents: 4500 },
      ],
      riskFlags: [],
    });

    const result = await generateLineItems(
      "Neubau-Badezimmer soll neu gefliest werden, keine baulichen Änderungen.",
      priceList,
    );

    expect(result.riskFlags).toEqual([]);
  });
});
