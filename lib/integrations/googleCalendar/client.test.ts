import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { buildGoogleAuthUrl, isGoogleCalendarConfigured } from "./client";

describe("googleCalendar/client", () => {
  const originalClientId = process.env.GOOGLE_CLIENT_ID;
  const originalClientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const originalSiteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = "test-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
  });

  afterEach(() => {
    process.env.GOOGLE_CLIENT_ID = originalClientId;
    process.env.GOOGLE_CLIENT_SECRET = originalClientSecret;
    process.env.NEXT_PUBLIC_SITE_URL = originalSiteUrl;
  });

  it("is not configured when env vars are missing", () => {
    delete process.env.GOOGLE_CLIENT_ID;
    delete process.env.GOOGLE_CLIENT_SECRET;
    expect(isGoogleCalendarConfigured()).toBe(false);
  });

  it("is configured when both env vars are present", () => {
    expect(isGoogleCalendarConfigured()).toBe(true);
  });

  it("builds an auth URL carrying the calendar.events scope, the redirect URI, and the given state", () => {
    const url = buildGoogleAuthUrl("org-123:nonce-abc");
    expect(url).toContain("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url).toContain("scope=https%3A%2F%2Fwww.googleapis.com%2Fauth%2Fcalendar.events");
    expect(url).toContain(
      "redirect_uri=https%3A%2F%2Fexample.com%2Fapi%2Fintegrations%2Fgoogle-calendar%2Fcallback",
    );
    expect(url).toContain("state=org-123%3Anonce-abc");
    // access_type=offline + prompt=consent are required to reliably get a
    // refresh_token back, including on re-connect after a prior disconnect.
    expect(url).toContain("access_type=offline");
    expect(url).toContain("prompt=consent");
  });

  it("throws when building an auth URL without configured credentials", () => {
    delete process.env.GOOGLE_CLIENT_ID;
    expect(() => buildGoogleAuthUrl("state")).toThrow();
  });
});
