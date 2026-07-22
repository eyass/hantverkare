import { describe, it, expect } from "vitest";
import { generateDemoQuote, matchJobTemplate, formatCents, DEMO_JOB_TEMPLATES } from "./mockQuote";

describe("matchJobTemplate", () => {
  it("matches a bathroom job by keyword", () => {
    const template = matchJobTemplate("Badezimmer renovieren, Dusche und Fliesen erneuern");
    expect(template.id).toBe("bathroom");
  });

  it("matches a kitchen faucet job by keyword", () => {
    const template = matchJobTemplate("Küchenspüle und Wasserhahn austauschen");
    expect(template.id).toBe("kitchen-faucet");
  });

  it("falls back to the default template for unrecognized or empty input", () => {
    expect(matchJobTemplate("").id).toBe(DEMO_JOB_TEMPLATES[0].id);
    expect(matchJobTemplate("asdkjfhaslkdjfh").id).toBe(DEMO_JOB_TEMPLATES[0].id);
  });
});

describe("generateDemoQuote", () => {
  it("computes line totals and 19% VAT consistently", () => {
    const quote = generateDemoQuote("Badezimmer renovieren");
    const expectedSubtotal = quote.items.reduce((sum, item) => sum + item.lineTotalCents, 0);
    expect(quote.subtotalCents).toBe(expectedSubtotal);
    expect(quote.vatCents).toBe(Math.round(expectedSubtotal * 0.19));
    expect(quote.totalCents).toBe(quote.subtotalCents + quote.vatCents);
  });

  it("returns a non-empty item list for every template", () => {
    for (const template of DEMO_JOB_TEMPLATES) {
      const quote = generateDemoQuote(template.label);
      expect(quote.items.length).toBeGreaterThan(0);
      expect(quote.matchedJob).toBe(template.label);
    }
  });
});

describe("formatCents", () => {
  it("formats cents as German-locale EUR", () => {
    expect(formatCents(10000)).toContain("100");
    expect(formatCents(10000)).toContain("€");
  });
});
