import { describe, expect, it } from "vitest";
import { matchPriceListItemId } from "./matchPriceListItem";

const priceList = [
  { id: "1", label: "Wasserhahn montieren", unit: "Stück", unit_price_cents: 4500 },
  { id: "2", label: "Steckdose installieren", unit: "Stück", unit_price_cents: 4000 },
];

describe("matchPriceListItemId", () => {
  it("matches on unique unit + price combination", () => {
    const result = matchPriceListItemId(
      { description: "Neuer Wasserhahn in der Küche", unit: "Stück", unitPriceCents: 4500 },
      priceList,
    );
    expect(result).toBe("1");
  });

  it("returns null when unit + price don't match anything", () => {
    const result = matchPriceListItemId(
      { description: "Sonstiges", unit: "Stunde", unitPriceCents: 9999 },
      priceList,
    );
    expect(result).toBeNull();
  });

  it("resolves ambiguous unit+price matches via exact label match", () => {
    const ambiguous = [
      { id: "1", label: "Wasserhahn montieren", unit: "Stück", unit_price_cents: 4500 },
      { id: "2", label: "Spülbecken montieren", unit: "Stück", unit_price_cents: 4500 },
    ];
    const result = matchPriceListItemId(
      { description: "Wasserhahn montieren", unit: "Stück", unitPriceCents: 4500 },
      ambiguous,
    );
    expect(result).toBe("1");
  });

  it("bails out (null) on unresolved ambiguity rather than guessing", () => {
    const ambiguous = [
      { id: "1", label: "Wasserhahn montieren", unit: "Stück", unit_price_cents: 4500 },
      { id: "2", label: "Spülbecken montieren", unit: "Stück", unit_price_cents: 4500 },
    ];
    const result = matchPriceListItemId(
      { description: "Etwas ganz anderes", unit: "Stück", unitPriceCents: 4500 },
      ambiguous,
    );
    expect(result).toBeNull();
  });
});
