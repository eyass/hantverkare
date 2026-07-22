import { describe, it, expect } from "vitest";
import { TRADE_CONFIGS, TRADE_SLUGS, getTradeConfig, formatItemPrice } from "./config";

describe("TRADE_SLUGS / TRADE_CONFIGS", () => {
  it("has exactly the 4 trades seeded in supabase/migrations/0011_price_list_templates.sql", () => {
    expect(TRADE_SLUGS.sort()).toEqual(
      ["bodenleger", "elektriker", "maler", "sanitaer-heizung"].sort()
    );
  });

  it("every config has a non-empty example item list with positive prices", () => {
    for (const slug of TRADE_SLUGS) {
      const config = TRADE_CONFIGS[slug];
      expect(config.exampleItems.length).toBeGreaterThan(0);
      for (const item of config.exampleItems) {
        expect(item.priceCents).toBeGreaterThan(0);
        expect(item.label.length).toBeGreaterThan(0);
      }
    }
  });

  it("every config has at least one demo job id", () => {
    for (const slug of TRADE_SLUGS) {
      expect(TRADE_CONFIGS[slug].demoJobIds.length).toBeGreaterThan(0);
    }
  });

  it("slugs match their own config's slug field", () => {
    for (const slug of TRADE_SLUGS) {
      expect(TRADE_CONFIGS[slug].slug).toBe(slug);
    }
  });
});

describe("getTradeConfig", () => {
  it("returns the config for a known trade slug", () => {
    expect(getTradeConfig("maler")?.label).toBe("Maler");
  });

  it("returns undefined for an unknown slug", () => {
    expect(getTradeConfig("dachdecker")).toBeUndefined();
  });
});

describe("formatItemPrice", () => {
  it("formats cents as German-locale EUR", () => {
    expect(formatItemPrice(120000)).toContain("1.200");
    expect(formatItemPrice(120000)).toContain("€");
  });
});
