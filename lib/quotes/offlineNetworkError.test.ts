import { describe, expect, it } from "vitest";
import { isNextRedirectError, isOfflineNetworkError } from "./offlineNetworkError";

describe("isNextRedirectError", () => {
  it("recognizes a Next.js redirect control-flow error", () => {
    const err = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;push;/quotes/1" });
    expect(isNextRedirectError(err)).toBe(true);
  });

  it("returns false for a plain error", () => {
    expect(isNextRedirectError(new Error("boom"))).toBe(false);
  });

  it("returns false for non-object values", () => {
    expect(isNextRedirectError("boom")).toBe(false);
    expect(isNextRedirectError(null)).toBe(false);
    expect(isNextRedirectError(undefined)).toBe(false);
  });
});

describe("isOfflineNetworkError", () => {
  it("never treats a redirect as an offline error, even while offline", () => {
    const err = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;push;/quotes/1" });
    expect(isOfflineNetworkError(err, false)).toBe(false);
  });

  it("treats any thrown Error as offline when navigator reports offline", () => {
    expect(isOfflineNetworkError(new Error("some odd failure"), false)).toBe(true);
  });

  it("treats a recognized fetch-failure message as offline even if navigator reports online", () => {
    expect(isOfflineNetworkError(new TypeError("Failed to fetch"), true)).toBe(true);
    expect(
      isOfflineNetworkError(new TypeError("NetworkError when attempting to fetch resource."), true),
    ).toBe(true);
    expect(isOfflineNetworkError(new TypeError("Load failed"), true)).toBe(true);
  });

  it("does not treat an unrelated error as offline when navigator reports online", () => {
    expect(isOfflineNetworkError(new TypeError("Cannot read properties of undefined"), true)).toBe(
      false,
    );
  });

  it("returns false for non-Error throws", () => {
    expect(isOfflineNetworkError("boom", false)).toBe(false);
    expect(isOfflineNetworkError(null, false)).toBe(false);
  });
});
