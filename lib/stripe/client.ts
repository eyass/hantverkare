import Stripe from "stripe";

// Server-only Stripe SDK singleton. Never import from a client component.
//
// This app only ever uses Stripe TEST MODE keys during development -- the
// human sets the real secret in Vercel/`.env.local` once they've created a
// Stripe account and a test-mode secret key (starts with `sk_test_`). Nothing
// in this codebase creates a live Price, switches to a live key, or executes
// a real charge; see docs/MANUAL-STEPS-PENDING.md for the manual setup steps.
let stripeSingleton: Stripe | null = null;

export function getStripeClient(): Stripe {
  if (stripeSingleton) {
    return stripeSingleton;
  }

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set.");
  }

  stripeSingleton = new Stripe(secretKey, {
    apiVersion: "2026-06-24.dahlia",
  });
  return stripeSingleton;
}
