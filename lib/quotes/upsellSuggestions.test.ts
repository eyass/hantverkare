import { describe, it, expect } from "vitest";
import {
  computeUpsellSuggestions,
  MIN_QUOTES_FOR_SUGGESTIONS,
  type HistoricalQuote,
  type PriceListItemInfo,
} from "./upsellSuggestions";

const priceList: PriceListItemInfo[] = [
  { id: "bad", label: "Badezimmer Renovierung", unit: "Pauschal", unitPriceCents: 500000 },
  { id: "fliesen", label: "Fliesenlegen", unit: "m²", unitPriceCents: 6000 },
  { id: "sanitaer", label: "Sanitärinstallation", unit: "Stunde", unitPriceCents: 8000 },
  { id: "unrelated", label: "Rasenmähen", unit: "Stunde", unitPriceCents: 3000 },
];

function quotesPairing(count: number, a: string, b: string): HistoricalQuote[] {
  return Array.from({ length: count }, (_, i) => ({
    quoteId: `q-${a}-${b}-${i}`,
    priceListItemIds: [a, b],
  }));
}

describe("computeUpsellSuggestions", () => {
  it("returns [] when there is too little quote history", () => {
    const history = quotesPairing(MIN_QUOTES_FOR_SUGGESTIONS - 1, "bad", "fliesen");
    const result = computeUpsellSuggestions(history, ["bad"], priceList);
    expect(result).toEqual([]);
  });

  it("suggests items that co-occurred with the current quote's items often enough", () => {
    const history = quotesPairing(MIN_QUOTES_FOR_SUGGESTIONS, "bad", "fliesen");
    const result = computeUpsellSuggestions(history, ["bad"], priceList);
    expect(result).toHaveLength(1);
    expect(result[0].priceListItemId).toBe("fliesen");
    expect(result[0].coOccurrenceCount).toBe(MIN_QUOTES_FOR_SUGGESTIONS);
  });

  it("ranks suggestions by co-occurrence count, most common first", () => {
    const history = [
      ...quotesPairing(MIN_QUOTES_FOR_SUGGESTIONS, "bad", "fliesen"),
      ...quotesPairing(2, "bad", "sanitaer"),
    ];
    const result = computeUpsellSuggestions(history, ["bad"], priceList);
    expect(result.map((s) => s.priceListItemId)).toEqual(["fliesen", "sanitaer"]);
  });

  it("never suggests an item already on the current quote", () => {
    const history = quotesPairing(MIN_QUOTES_FOR_SUGGESTIONS, "bad", "fliesen");
    const result = computeUpsellSuggestions(history, ["bad", "fliesen"], priceList);
    expect(result).toEqual([]);
  });

  it("returns [] when the current quote has no price-list-linked items yet", () => {
    const history = quotesPairing(MIN_QUOTES_FOR_SUGGESTIONS, "bad", "fliesen");
    const result = computeUpsellSuggestions(history, [], priceList);
    expect(result).toEqual([]);
  });

  it("ignores quotes that don't overlap with the current quote's items at all", () => {
    const history = [
      ...quotesPairing(MIN_QUOTES_FOR_SUGGESTIONS, "bad", "fliesen"),
      ...quotesPairing(MIN_QUOTES_FOR_SUGGESTIONS, "sanitaer", "unrelated"),
    ];
    const result = computeUpsellSuggestions(history, ["bad"], priceList);
    expect(result.map((s) => s.priceListItemId)).toEqual(["fliesen"]);
  });

  it("respects the limit parameter", () => {
    const history = [
      ...quotesPairing(MIN_QUOTES_FOR_SUGGESTIONS, "bad", "fliesen"),
      ...quotesPairing(MIN_QUOTES_FOR_SUGGESTIONS, "bad", "sanitaer"),
      ...quotesPairing(MIN_QUOTES_FOR_SUGGESTIONS, "bad", "unrelated"),
    ];
    const result = computeUpsellSuggestions(history, ["bad"], priceList, 2);
    expect(result).toHaveLength(2);
  });

  it("skips a co-occurring item id that no longer exists in the price list", () => {
    const history: HistoricalQuote[] = quotesPairing(MIN_QUOTES_FOR_SUGGESTIONS, "bad", "deleted-item");
    const result = computeUpsellSuggestions(history, ["bad"], priceList);
    expect(result).toEqual([]);
  });

  it("dedupes repeated items within a single historical quote before counting", () => {
    const history: HistoricalQuote[] = Array.from({ length: MIN_QUOTES_FOR_SUGGESTIONS }, (_, i) => ({
      quoteId: `q-${i}`,
      priceListItemIds: ["bad", "fliesen", "fliesen"],
    }));
    const result = computeUpsellSuggestions(history, ["bad"], priceList);
    expect(result[0].coOccurrenceCount).toBe(MIN_QUOTES_FOR_SUGGESTIONS);
  });
});
