import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_APP_LANGUAGE, isAppLanguage, type AppLanguage } from "./dictionary";

/**
 * Resolves the signed-in user's UI language preference (issue #116) for
 * Server Components / Server Actions that can't use the client
 * AppLanguageProvider context.
 *
 * Fails open to DEFAULT_APP_LANGUAGE ('de') on any error, missing session,
 * or missing/invalid column value -- matches this app's existing
 * German-only default rather than blocking render, per the design spec's
 * "fail open" data-flow decision.
 *
 * Pass an existing server client to reuse the caller's session/getUser
 * rather than creating a second one; omit it and one is created.
 */
export async function getUserLanguage(client?: SupabaseClient): Promise<AppLanguage> {
  const supabase = client ?? (await createClient());

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return DEFAULT_APP_LANGUAGE;

  const { data, error } = await supabase
    .from("profiles")
    .select("language")
    .eq("id", user.id)
    .maybeSingle();

  if (error) {
    console.error("Failed to load user language preference:", error);
  }
  if (error || !data || !isAppLanguage(data.language)) {
    return DEFAULT_APP_LANGUAGE;
  }
  return data.language;
}
