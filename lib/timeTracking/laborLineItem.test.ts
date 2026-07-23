import { describe, it, expect } from "vitest";
import { sumHours, formatHoursLabel, buildLaborLineItem } from "./laborLineItem";

describe("sumHours", () => {
  it("sums hours across entries", () => {
    expect(sumHours([{ hours: 3 }, { hours: 4.5 }])).toBe(7.5);
  });

  it("returns 0 for an empty list", () => {
    expect(sumHours([])).toBe(0);
  });

  it("rounds away floating point noise", () => {
    expect(sumHours([{ hours: 0.1 }, { hours: 0.2 }])).toBe(0.3);
  });
});

describe("formatHoursLabel", () => {
  it("formats with two decimal places, German locale", () => {
    expect(formatHoursLabel(7.5)).toBe("7,50");
  });

  it("formats whole numbers with trailing zeros", () => {
    expect(formatHoursLabel(3)).toBe("3,00");
  });
});

describe("buildLaborLineItem", () => {
  it("builds a line item summarizing the total hours", () => {
    const item = buildLaborLineItem(12.5);
    expect(item).toEqual({
      description: "Arbeitszeit: 12,50 Std.",
      quantity: 12.5,
      unit: "Std.",
      unitPriceCents: 0,
    });
  });

  it("returns null for zero hours", () => {
    expect(buildLaborLineItem(0)).toBeNull();
  });

  it("returns null for negative hours", () => {
    expect(buildLaborLineItem(-1)).toBeNull();
  });

  it("returns null for non-finite hours", () => {
    expect(buildLaborLineItem(NaN)).toBeNull();
    expect(buildLaborLineItem(Infinity)).toBeNull();
  });
});
