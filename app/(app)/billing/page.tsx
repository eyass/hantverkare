import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/organizations/getCurrentOrg";
import { canViewBilling } from "@/lib/organizations/permissions";
import { getUserLanguage } from "@/lib/i18n/getUserLanguage";
import { BILLING_DICTIONARY } from "./billing.dictionary";
import { createCheckoutSession, createBillingPortalSession } from "./actions";
import { formatDate as formatDateBase } from "@/lib/format";

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return formatDateBase(iso);
}

export default async function BillingPage() {
  const supabase = await createClient();
  const org = await getCurrentOrg(supabase);
  const language = await getUserLanguage(supabase);
  const t = BILLING_DICTIONARY[language];

  // Billing is per-organization and owner-only. Members see a notice instead of
  // the subscription controls (the Server Actions also enforce this).
  if (org && !canViewBilling(org.role)) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-semibold">{t.title}</h1>
        <div className="mt-6 rounded-lg border p-6">
          <p>{t.ownerManagedNotice}</p>
        </div>
      </div>
    );
  }

  const { data: settings, error } = org
    ? await supabase
        .from("billing")
        .select("subscription_status, trial_ends_at, stripe_customer_id")
        .eq("organization_id", org.organizationId)
        .maybeSingle()
    : { data: null, error: null };

  if (error) {
    console.error("Failed to load billing state:", error);
  }

  const status = settings?.subscription_status ?? null;
  const trialEndsAt = formatDate(settings?.trial_ends_at ?? null);
  const hasStripeCustomer = Boolean(settings?.stripe_customer_id);

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-semibold">{t.title}</h1>

      <div className="mt-6 rounded-lg border p-6">
        {status === "trialing" && <p>{t.trialing(trialEndsAt)}</p>}
        {status === "active" && <p>{t.active}</p>}
        {(status === "canceled" || status === "past_due" || status === "unpaid") && (
          <p>{t.inactive(status)}</p>
        )}
        {!status && <p>{t.none}</p>}

        <div className="mt-6 flex gap-3">
          {status !== "active" && (
            <form action={createCheckoutSession}>
              <button
                type="submit"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                {t.subscribe}
              </button>
            </form>
          )}
          {hasStripeCustomer && (
            <form action={createBillingPortalSession}>
              <button
                type="submit"
                className="rounded-md border px-4 py-2 text-sm font-medium"
              >
                {t.manage}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
