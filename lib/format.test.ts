import { describe, expect, it } from "vitest";
import { formatEuros, formatDateShort, formatDate, formatDateTime } from "./format";

describe("formatEuros", () => {
  it("formats zero", () => {
    expect(formatEuros(0)).toBe((0).toLocaleString("de-DE", { style: "currency", currency: "EUR" }));
  });

  it("formats a typical positive amount", () => {
    expect(formatEuros(123456)).toBe(
      (1234.56).toLocaleString("de-DE", { style: "currency", currency: "EUR" }),
    );
  });

  it("formats a negative amount", () => {
    expect(formatEuros(-500)).toBe((-5).toLocaleString("de-DE", { style: "currency", currency: "EUR" }));
  });
});

describe("formatDateShort", () => {
  it("formats an ISO string", () => {
    expect(formatDateShort("2026-07-22T00:00:00.000Z")).toBe(
      new Date("2026-07-22T00:00:00.000Z").toLocaleDateString("de-DE"),
    );
  });

  it("formats a Date instance", () => {
    const date = new Date("2026-01-01T12:00:00.000Z");
    expect(formatDateShort(date)).toBe(date.toLocaleDateString("de-DE"));
  });
});

describe("formatDate", () => {
  it("formats an ISO string with long month", () => {
    expect(formatDate("2026-07-22T00:00:00.000Z")).toBe(
      new Date("2026-07-22T00:00:00.000Z").toLocaleDateString("de-DE", {
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    );
  });

  it("formats a Date instance", () => {
    const date = new Date("2026-12-31T00:00:00.000Z");
    expect(formatDate(date)).toBe(
      date.toLocaleDateString("de-DE", { year: "numeric", month: "long", day: "numeric" }),
    );
  });
});

describe("formatDateTime", () => {
  it("formats an ISO string with short month and time", () => {
    expect(formatDateTime("2026-07-22T14:05:00.000Z")).toBe(
      new Date("2026-07-22T14:05:00.000Z").toLocaleString("de-DE", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
  });

  it("formats a Date instance", () => {
    const date = new Date("2026-01-01T09:30:00.000Z");
    expect(formatDateTime(date)).toBe(
      date.toLocaleString("de-DE", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }),
    );
  });
});
