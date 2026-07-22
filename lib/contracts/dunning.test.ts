import { describe, it, expect } from "vitest";
import { contractRiskReason } from "./dunning";

describe("contractRiskReason", () => {
  it("returns null when renewal succeeded and there is no invoice yet", () => {
    expect(contractRiskReason({ renewalFailedAt: null, invoice: null })).toBeNull();
  });

  it("returns null when the invoice is paid, even if mahnung was sent", () => {
    expect(
      contractRiskReason({
        renewalFailedAt: null,
        invoice: { paidAt: new Date(), mahnungSentAt: new Date() },
      }),
    ).toBeNull();
  });

  it("returns null when the invoice is merely reminder-stage overdue (not yet mahnung)", () => {
    expect(
      contractRiskReason({
        renewalFailedAt: null,
        invoice: { paidAt: null, mahnungSentAt: null },
      }),
    ).toBeNull();
  });

  it("returns 'invoice_overdue' once mahnung has been sent and the invoice is unpaid", () => {
    expect(
      contractRiskReason({
        renewalFailedAt: null,
        invoice: { paidAt: null, mahnungSentAt: new Date() },
      }),
    ).toBe("invoice_overdue");
  });

  it("returns 'renewal_failed' when the renewal cron failed, regardless of invoice state", () => {
    expect(
      contractRiskReason({
        renewalFailedAt: new Date(),
        invoice: { paidAt: null, mahnungSentAt: new Date() },
      }),
    ).toBe("renewal_failed");
  });

  it("prioritizes 'renewal_failed' over a healthy invoice", () => {
    expect(
      contractRiskReason({
        renewalFailedAt: new Date(),
        invoice: null,
      }),
    ).toBe("renewal_failed");
  });
});
