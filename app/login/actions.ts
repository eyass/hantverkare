"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isValidReferralCodeFormat, normalizeReferralCode } from "@/lib/referrals/code";

const REFERRAL_COOKIE_NAME = "referral_code";
const REFERRAL_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60; // 30 days

export type LoginState = { error: string | null; sent: boolean };

export async function sendMagicLink(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get("email");
  if (typeof email !== "string" || !email.includes("@")) {
    return { error: "Bitte gib eine gültige E-Mail-Adresse ein.", sent: false };
  }

  const next = formData.get("next");
  const safeNext =
    typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : null;

  // Referral code (issue #79): validate format before ever storing it (this
  // is untrusted user input -- a query param that flowed through a hidden
  // form field). A malformed/garbage value is silently dropped, never
  // stored, never surfaced as an error -- a bad referral link must never
  // block someone from logging in.
  const rawRef = formData.get("ref");
  if (typeof rawRef === "string" && isValidReferralCodeFormat(rawRef)) {
    (await cookies()).set(REFERRAL_COOKIE_NAME, normalizeReferralCode(rawRef), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: REFERRAL_COOKIE_MAX_AGE_SECONDS,
    });
  }

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const callbackUrl = new URL(`${siteUrl}/auth/callback`);
  if (safeNext) {
    callbackUrl.searchParams.set("next", safeNext);
  }

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: callbackUrl.toString(),
    },
  });
  if (error) {
    console.error("Failed to send magic link:", error);
    return { error: "Link konnte nicht gesendet werden. Bitte versuche es erneut.", sent: false };
  }

  return { error: null, sent: true };
}
