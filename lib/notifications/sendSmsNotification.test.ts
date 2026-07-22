import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  sendSmsNotification,
  buildSignedSmsBody,
  buildExpiryReminderSmsBody,
} from "./sendSmsNotification";

describe("buildSignedSmsBody", () => {
  it("includes the signer name and a truncated description", () => {
    const body = buildSignedSmsBody("Max Mustermann", "Badezimmer renovieren");
    expect(body).toContain("Max Mustermann");
    expect(body).toContain("Badezimmer renovieren");
  });

  it("truncates very long descriptions", () => {
    const long = "a".repeat(500);
    const body = buildSignedSmsBody("Max", long);
    expect(body.length).toBeLessThan(200);
  });
});

describe("buildExpiryReminderSmsBody", () => {
  it("uses 'heute' for zero/negative days", () => {
    expect(buildExpiryReminderSmsBody("owner", 0, "Auftrag")).toContain("heute");
    expect(buildExpiryReminderSmsBody("owner", -1, "Auftrag")).toContain("heute");
  });

  it("uses 'morgen' for one day", () => {
    expect(buildExpiryReminderSmsBody("owner", 1, "Auftrag")).toContain("morgen");
  });

  it("uses 'in N Tagen' for multiple days", () => {
    expect(buildExpiryReminderSmsBody("owner", 5, "Auftrag")).toContain("in 5 Tagen");
  });

  it("differs in wording between owner and customer audiences", () => {
    const ownerBody = buildExpiryReminderSmsBody("owner", 2, "Auftrag");
    const customerBody = buildExpiryReminderSmsBody("customer", 2, "Auftrag");
    expect(ownerBody).not.toEqual(customerBody);
  });
});

describe("sendSmsNotification", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("never throws and logs an error when Twilio env vars are missing", async () => {
    delete process.env.TWILIO_ACCOUNT_SID;
    delete process.env.TWILIO_AUTH_TOKEN;
    delete process.env.TWILIO_FROM_NUMBER;
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      sendSmsNotification({ toPhone: "+491234567", body: "Test" }),
    ).resolves.toBeUndefined();
    expect(errorSpy).toHaveBeenCalled();
  });

  it("is best-effort: a network failure never throws", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC_test";
    process.env.TWILIO_AUTH_TOKEN = "token_test";
    process.env.TWILIO_FROM_NUMBER = "+10000000000";
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network down")),
    );

    await expect(
      sendSmsNotification({ toPhone: "+491234567", body: "Test" }),
    ).resolves.toBeUndefined();

    vi.unstubAllGlobals();
  });

  it("sends a Twilio REST API request with Basic Auth when env vars are set", async () => {
    process.env.TWILIO_ACCOUNT_SID = "AC_test";
    process.env.TWILIO_AUTH_TOKEN = "token_test";
    process.env.TWILIO_FROM_NUMBER = "+10000000000";
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, text: async () => "" });
    vi.stubGlobal("fetch", fetchMock);

    await sendSmsNotification({ toPhone: "+491234567", body: "Hallo" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.twilio.com/2010-04-01/Accounts/AC_test/Messages.json");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe(
      `Basic ${Buffer.from("AC_test:token_test").toString("base64")}`,
    );

    vi.unstubAllGlobals();
  });
});
