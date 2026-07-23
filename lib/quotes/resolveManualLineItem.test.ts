import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  parseManualLineItemToolInput,
  resolveManualLineItem,
  ManualLineItemError,
  type PriceListItem,
} from "./resolveManualLineItem";

// Mock the Anthropic client entirely -- these tests exercise deterministic
// schema-parsing/trust-boundary logic, never a real LLM call.
const mockCreate = vi.fn();
vi.mock("@anthropic-ai/sdk", () => ({
  default: class MockAnthropic {
    messages = { create: mockCreate };
  },
}));

const priceList: PriceListItem[] = [
  { id: "pli-1", label: "Wasserhahn montieren", unit: "Stück", unitPriceCents: 8000, category: "Sanitär" },
  { id: "pli-2", label: "Fliesen verlegen", unit: "m²", unitPriceCents: 4500, category: "Bodenbelag" },
];

describe("parseManualLineItemToolInput", () => {
  it("resolves via priceListItemId, using the server's own price list row (not an AI-echoed price)", () => {
    const input = { quantity: 1, priceListItemId: "pli-1" };
    const result = parseManualLineItemToolInput(input, priceList);
    expect(result).toEqual({
      description: "Wasserhahn montieren",
      quantity: 1,
      unit: "Stück",
      unitPriceCents: 8000,
      priceListItemId: "pli-1",
    });
  });

  it("ignores an AI-echoed price/description for a matched catalog item", () => {
    // Even if the model somehow included extra fields alongside a valid
    // priceListItemId, only the server's own price list row is used.
    const input = {
      quantity: 2,
      priceListItemId: "pli-2",
      customUnitPriceCents: 999999,
      customDescription: "Should be ignored",
    };
    // hasCustom is also true here, which the schema treats as ambiguous
    // (exactly one of the two shapes is required) -- so this throws rather
    // than silently picking one. Assert the ambiguity is rejected.
    expect(() => parseManualLineItemToolInput(input, priceList)).toThrow(ManualLineItemError);
  });

  it("falls back to a custom item when nothing in the price list matches", () => {
    const input = {
      quantity: 3,
      customUnitPriceCents: 1200,
      customDescription: "Silikon nachziehen",
      unit: "Meter",
    };
    const result = parseManualLineItemToolInput(input, priceList);
    expect(result).toEqual({
      description: "Silikon nachziehen",
      quantity: 3,
      unit: "Meter",
      unitPriceCents: 1200,
      priceListItemId: null,
    });
  });

  it("rejects a priceListItemId that doesn't exist in the given price list", () => {
    const input = { quantity: 1, priceListItemId: "hallucinated-id" };
    expect(() => parseManualLineItemToolInput(input, priceList)).toThrow(ManualLineItemError);
  });

  it("throws when quantity is missing or invalid", () => {
    expect(() => parseManualLineItemToolInput({ priceListItemId: "pli-1" }, priceList)).toThrow(
      ManualLineItemError,
    );
    expect(() =>
      parseManualLineItemToolInput({ quantity: 0, priceListItemId: "pli-1" }, priceList),
    ).toThrow(ManualLineItemError);
    expect(() =>
      parseManualLineItemToolInput({ quantity: NaN, priceListItemId: "pli-1" }, priceList),
    ).toThrow(ManualLineItemError);
  });

  it("throws when neither priceListItemId nor a custom item is provided", () => {
    expect(() => parseManualLineItemToolInput({ quantity: 1 }, priceList)).toThrow(
      ManualLineItemError,
    );
  });

  it("throws when a custom item is missing its unit", () => {
    const input = {
      quantity: 1,
      customUnitPriceCents: 1200,
      customDescription: "Silikon nachziehen",
    };
    expect(() => parseManualLineItemToolInput(input, priceList)).toThrow(ManualLineItemError);
  });

  it("throws when customUnitPriceCents is not a positive integer", () => {
    const input = {
      quantity: 1,
      customUnitPriceCents: -5,
      customDescription: "Silikon nachziehen",
      unit: "Meter",
    };
    expect(() => parseManualLineItemToolInput(input, priceList)).toThrow(ManualLineItemError);
  });
});

describe("resolveManualLineItem", () => {
  function mockToolResponse(input: unknown) {
    mockCreate.mockResolvedValueOnce({
      content: [{ type: "tool_use", name: "resolve_line_item", input }],
    });
  }

  beforeEach(() => {
    mockCreate.mockReset();
  });

  it("returns a resolved catalog item end-to-end", async () => {
    mockToolResponse({ quantity: 1, priceListItemId: "pli-1" });

    const result = await resolveManualLineItem("zusätzlicher Wasserhahn", priceList);

    expect(result).toEqual({
      description: "Wasserhahn montieren",
      quantity: 1,
      unit: "Stück",
      unitPriceCents: 8000,
      priceListItemId: "pli-1",
    });
  });

  it("returns a resolved custom item end-to-end", async () => {
    mockToolResponse({
      quantity: 2,
      customUnitPriceCents: 2000,
      customDescription: "Sonderanfertigung",
      unit: "Stück",
    });

    const result = await resolveManualLineItem("Sonderanfertigung", priceList);

    expect(result.priceListItemId).toBeNull();
    expect(result.unitPriceCents).toBe(2000);
  });

  it("throws QuoteGenerationError-equivalent when the AI references an unknown priceListItemId", async () => {
    mockToolResponse({ quantity: 1, priceListItemId: "hallucinated-id" });

    await expect(resolveManualLineItem("etwas", priceList)).rejects.toThrow(ManualLineItemError);
  });

  it("throws when the response has no tool use", async () => {
    mockCreate.mockResolvedValueOnce({ content: [{ type: "text", text: "no tool use" }] });

    await expect(resolveManualLineItem("etwas", priceList)).rejects.toThrow(ManualLineItemError);
  });
});
