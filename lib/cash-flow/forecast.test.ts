import { describe, it, expect } from "vitest";
import { buildCashFlowForecast, DEFAULT_RENEWAL_WINDOW_DAYS } from "./forecast";

const NOW = new Date("2026-07-22T12:00:00Z");

describe("buildCashFlowForecast", () => {
  it("sums unpaid invoices with a due date into expectedInflowCents", () => {
    const forecast = buildCashFlowForecast(
      {
        invoices: [
          {
            id: "inv-1",
            invoiceNumber: "RE-0001",
            dueDate: new Date("2026-08-01T00:00:00Z"),
            paidAt: null,
            totalCents: 10000,
            customerName: "Kunde A",
          },
        ],
        contracts: [],
        quotes: [],
      },
      NOW,
    );

    expect(forecast.unpaidInvoices.count).toBe(1);
    expect(forecast.unpaidInvoices.totalCents).toBe(10000);
    expect(forecast.expectedInflowCents).toBe(10000);
  });

  it("excludes paid invoices and invoices without a due date", () => {
    const forecast = buildCashFlowForecast(
      {
        invoices: [
          {
            id: "inv-paid",
            invoiceNumber: "RE-0002",
            dueDate: new Date("2026-08-01T00:00:00Z"),
            paidAt: new Date("2026-07-20T00:00:00Z"),
            totalCents: 5000,
            customerName: null,
          },
          {
            id: "inv-no-due-date",
            invoiceNumber: "RE-0003",
            dueDate: null,
            paidAt: null,
            totalCents: 7000,
            customerName: null,
          },
        ],
        contracts: [],
        quotes: [],
      },
      NOW,
    );

    expect(forecast.unpaidInvoices.count).toBe(0);
    expect(forecast.expectedInflowCents).toBe(0);
  });

  it("includes only active contracts due within the renewal window", () => {
    const forecast = buildCashFlowForecast(
      {
        invoices: [],
        contracts: [
          {
            id: "c-in-window",
            nextDueDate: new Date("2026-08-15T00:00:00Z"),
            status: "active",
            expectedValueCents: 30000,
            customerName: "Kunde B",
          },
          {
            id: "c-out-of-window",
            nextDueDate: new Date("2027-01-01T00:00:00Z"),
            status: "active",
            expectedValueCents: 40000,
            customerName: "Kunde C",
          },
          {
            id: "c-paused",
            nextDueDate: new Date("2026-08-15T00:00:00Z"),
            status: "paused",
            expectedValueCents: 50000,
            customerName: "Kunde D",
          },
        ],
        quotes: [],
      },
      NOW,
    );

    expect(forecast.upcomingRenewals.count).toBe(1);
    expect(forecast.upcomingRenewals.items[0].id).toBe("c-in-window");
    expect(forecast.upcomingRenewals.totalCents).toBe(30000);
    expect(forecast.expectedInflowCents).toBe(30000);
  });

  it("respects a custom renewal window", () => {
    const forecast = buildCashFlowForecast(
      {
        invoices: [],
        contracts: [
          {
            id: "c1",
            nextDueDate: new Date("2026-09-22T00:00:00Z"), // 62 days out
            status: "active",
            expectedValueCents: 1000,
            customerName: null,
          },
        ],
        quotes: [],
      },
      NOW,
      30,
    );

    expect(forecast.upcomingRenewals.count).toBe(0);
  });

  it("keeps open-quote pipeline value separate from expectedInflowCents", () => {
    const forecast = buildCashFlowForecast(
      {
        invoices: [],
        contracts: [],
        quotes: [
          { id: "q1", totalCents: 20000, customerName: "Kunde E" },
          { id: "q2", totalCents: 15000, customerName: null },
        ],
      },
      NOW,
    );

    expect(forecast.openQuotes.count).toBe(2);
    expect(forecast.potentialPipelineCents).toBe(35000);
    expect(forecast.expectedInflowCents).toBe(0);
  });

  it("combines invoices and renewals but never the quote pipeline into expectedInflowCents", () => {
    const forecast = buildCashFlowForecast({
      invoices: [
        {
          id: "inv-1",
          invoiceNumber: "RE-0001",
          dueDate: new Date("2026-08-01T00:00:00Z"),
          paidAt: null,
          totalCents: 10000,
          customerName: null,
        },
      ],
      contracts: [
        {
          id: "c1",
          nextDueDate: new Date("2026-08-15T00:00:00Z"),
          status: "active",
          expectedValueCents: 20000,
          customerName: null,
        },
      ],
      quotes: [{ id: "q1", totalCents: 999999, customerName: null }],
    }, NOW);

    expect(forecast.expectedInflowCents).toBe(30000);
    expect(forecast.potentialPipelineCents).toBe(999999);
  });

  it("sorts unpaid invoices and renewals by soonest due date first", () => {
    const forecast = buildCashFlowForecast(
      {
        invoices: [
          {
            id: "later",
            invoiceNumber: "RE-later",
            dueDate: new Date("2026-09-01T00:00:00Z"),
            paidAt: null,
            totalCents: 1,
            customerName: null,
          },
          {
            id: "sooner",
            invoiceNumber: "RE-sooner",
            dueDate: new Date("2026-07-25T00:00:00Z"),
            paidAt: null,
            totalCents: 1,
            customerName: null,
          },
        ],
        contracts: [],
        quotes: [],
      },
      NOW,
    );

    expect(forecast.unpaidInvoices.items.map((i) => i.id)).toEqual(["sooner", "later"]);
  });

  it("defaults the renewal window to 90 days", () => {
    expect(DEFAULT_RENEWAL_WINDOW_DAYS).toBe(90);
  });
});
