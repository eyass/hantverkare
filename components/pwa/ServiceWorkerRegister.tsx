"use client";

import { useEffect } from "react";

/**
 * Registers the minimal static-asset-caching service worker (public/sw.js).
 * Client-only, fire-and-forget: failures (unsupported browser, blocked by
 * extension, etc.) are logged and otherwise ignored -- the app works
 * identically without it, just without the installability/shell-caching
 * benefit.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined" || !("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js").catch((err) => {
      console.error("Service worker registration failed:", err);
    });
  }, []);

  return null;
}
