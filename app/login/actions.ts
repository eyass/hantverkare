"use server";

import { createClient } from "@/lib/supabase/server";

export type LoginState = { error: string | null; sent: boolean };

export async function sendMagicLink(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get("email");
  if (typeof email !== "string" || !email.includes("@")) {
    return { error: "Bitte gib eine gültige E-Mail-Adresse ein.", sent: false };
  }

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  });
  if (error) {
    console.error("Failed to send magic link:", error);
    return { error: "Link konnte nicht gesendet werden. Bitte versuche es erneut.", sent: false };
  }

  return { error: null, sent: true };
}
