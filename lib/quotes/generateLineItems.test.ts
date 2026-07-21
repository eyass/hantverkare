import { describe, it, expect } from "vitest";
import { parseLineItemsToolInput, QuoteGenerationError } from "./generateLineItems";

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
