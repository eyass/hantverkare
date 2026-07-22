import type { SupabaseClient } from "@supabase/supabase-js";

export type OnboardingChecklistState = {
  hasBusinessSettings: boolean;
  hasPriceListItems: boolean;
  hasQuote: boolean;
  hasTeamMember: boolean;
};

/**
 * Computes onboarding-checklist completion (issue #74) from existing tables --
 * deliberately no new "completed" column anywhere. Each signal is a simple
 * existence/count check, scoped by RLS the same way every other read in the
 * app is (no explicit organization_id filter needed):
 *
 *  - business settings: a business_settings row exists for the org
 *  - price list: at least one price_list_items row
 *  - first quote: at least one quotes row
 *  - team: more than one organization_members row (the owner alone doesn't count)
 *
 * Uses `head: true` count-only queries where we don't need the row data, so
 * this stays cheap to call on every quotes-page load.
 */
export async function getOnboardingChecklistState(
  supabase: SupabaseClient,
): Promise<OnboardingChecklistState> {
  const [businessSettings, priceListItems, quotes, members] = await Promise.all([
    supabase.from("business_settings").select("user_id", { count: "exact", head: true }),
    supabase.from("price_list_items").select("id", { count: "exact", head: true }),
    supabase.from("quotes").select("id", { count: "exact", head: true }),
    supabase
      .from("organization_members")
      .select("user_id", { count: "exact", head: true }),
  ]);

  if (businessSettings.error) {
    console.error("Onboarding checklist: failed to check business_settings:", businessSettings.error);
  }
  if (priceListItems.error) {
    console.error("Onboarding checklist: failed to check price_list_items:", priceListItems.error);
  }
  if (quotes.error) {
    console.error("Onboarding checklist: failed to check quotes:", quotes.error);
  }
  if (members.error) {
    console.error("Onboarding checklist: failed to check organization_members:", members.error);
  }

  return {
    hasBusinessSettings: (businessSettings.count ?? 0) > 0,
    hasPriceListItems: (priceListItems.count ?? 0) > 0,
    hasQuote: (quotes.count ?? 0) > 0,
    hasTeamMember: (members.count ?? 0) > 1,
  };
}
