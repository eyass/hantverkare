import { describe, it, expect } from "vitest";
import { computeQuoteDisplayStatus } from "./status";

describe("computeQuoteDisplayStatus", () => {
  it("returns 'draft' for an unfinalized quote", () => {
    expect(
      computeQuoteDisplayStatus({ status: "draft", declinedAt: null }),
    ).toBe("draft");
  });

  it("returns 'final' for a finalized, unsigned, undeclined quote", () => {
    expect(
      computeQuoteDisplayStatus({ status: "final", declinedAt: null }),
    ).toBe("final");
  });

  it("returns 'signed' when status is 'signed'", () => {
    expect(
      computeQuoteDisplayStatus({ status: "signed", declinedAt: null, signedAt: "2026-01-01T00:00:00Z" }),
    ).toBe("signed");
  });

  it("returns 'signed' when signedAt is set even if status lags behind", () => {
    expect(
      computeQuoteDisplayStatus({ status: "final", declinedAt: null, signedAt: "2026-01-01T00:00:00Z" }),
    ).toBe("signed");
  });

  it("returns 'declined' when declinedAt is set", () => {
    expect(
      computeQuoteDisplayStatus({ status: "final", declinedAt: "2026-01-02T00:00:00Z" }),
    ).toBe("declined");
  });

  it("treats declined as authoritative even if signedAt is also (incorrectly) set", () => {
    expect(
      computeQuoteDisplayStatus({
        status: "signed",
        declinedAt: "2026-01-02T00:00:00Z",
        signedAt: "2026-01-01T00:00:00Z",
      }),
    ).toBe("declined");
  });

  it("accepts Date objects as well as ISO strings", () => {
    expect(
      computeQuoteDisplayStatus({ status: "final", declinedAt: new Date("2026-01-02T00:00:00Z") }),
    ).toBe("declined");
  });
});
