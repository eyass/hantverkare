import { describe, it, expect } from "vitest";
import {
  quoteReference,
  formatQuoteResult,
  formatCustomerResult,
  groupSearchResults,
  isSearchableQuery,
  escapeIlikeTerm,
  MIN_QUERY_LENGTH,
} from "./formatResults";

describe("quoteReference", () => {
  it("derives an uppercase 8-char reference from the id", () => {
    expect(quoteReference("ab12cd34-ef56-7890-ab12-cd34ef567890")).toBe("#AB12CD34");
  });
});

describe("formatQuoteResult", () => {
  it("truncates long descriptions and includes the reference + status", () => {
    const long = "x".repeat(80);
    const result = formatQuoteResult({
      id: "ab12cd34-ef56-7890-ab12-cd34ef567890",
      customer_description: long,
      status: "draft",
      created_at: "2026-01-01T00:00:00.000Z",
    });
    expect(result.title).toBe(`${"x".repeat(60)}…`);
    expect(result.subtitle).toBe("#AB12CD34 · Entwurf");
    expect(result.href).toBe("/quotes/ab12cd34-ef56-7890-ab12-cd34ef567890");
  });

  it("keeps short descriptions untruncated", () => {
    const result = formatQuoteResult({
      id: "id-1",
      customer_description: "Badezimmer renovieren",
      status: "signed",
      created_at: "2026-01-01T00:00:00.000Z",
    });
    expect(result.title).toBe("Badezimmer renovieren");
    expect(result.subtitle).toContain("Signiert");
  });

  it("falls back to the raw status for unknown statuses", () => {
    const result = formatQuoteResult({
      id: "id-1",
      customer_description: "Test",
      status: "weird",
      created_at: "2026-01-01T00:00:00.000Z",
    });
    expect(result.subtitle).toContain("weird");
  });
});

describe("formatCustomerResult", () => {
  it("prefers email as the subtitle", () => {
    const result = formatCustomerResult({
      id: "c1",
      name: "Max Mustermann",
      email: "max@example.com",
      phone: "12345",
    });
    expect(result.subtitle).toBe("max@example.com");
    expect(result.href).toBe("/customers/c1");
  });

  it("falls back to phone when there is no email", () => {
    const result = formatCustomerResult({ id: "c2", name: "Erika", email: null, phone: "999" });
    expect(result.subtitle).toBe("999");
  });

  it("falls back to an empty subtitle when neither is present", () => {
    const result = formatCustomerResult({ id: "c3", name: "Erika", email: null, phone: null });
    expect(result.subtitle).toBe("");
  });
});

describe("groupSearchResults", () => {
  it("groups formatted quotes and customers separately", () => {
    const grouped = groupSearchResults(
      [{ id: "q1", customer_description: "Dach reparieren", status: "draft", created_at: "" }],
      [{ id: "c1", name: "Max", email: null, phone: null }],
    );
    expect(grouped.quotes).toHaveLength(1);
    expect(grouped.customers).toHaveLength(1);
    expect(grouped.quotes[0].id).toBe("q1");
    expect(grouped.customers[0].id).toBe("c1");
  });

  it("returns empty arrays for no matches", () => {
    expect(groupSearchResults([], [])).toEqual({ quotes: [], customers: [] });
  });
});

describe("isSearchableQuery", () => {
  it(`requires at least ${MIN_QUERY_LENGTH} non-whitespace characters`, () => {
    expect(isSearchableQuery("")).toBe(false);
    expect(isSearchableQuery("a")).toBe(false);
    expect(isSearchableQuery("  a  ")).toBe(false);
    expect(isSearchableQuery("ab")).toBe(true);
    expect(isSearchableQuery("  ab  ")).toBe(true);
  });
});

describe("escapeIlikeTerm", () => {
  it("escapes percent, underscore, and backslash", () => {
    expect(escapeIlikeTerm("50%")).toBe("50\\%");
    expect(escapeIlikeTerm("a_b")).toBe("a\\_b");
    expect(escapeIlikeTerm("a\\b")).toBe("a\\\\b");
  });

  it("leaves ordinary text untouched", () => {
    expect(escapeIlikeTerm("Max Mustermann")).toBe("Max Mustermann");
  });
});
