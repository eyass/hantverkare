import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/organizations/getCurrentOrg";
import { canViewBilling } from "@/lib/organizations/permissions";
import { createCheckoutSession, createBillingPortalSession } from "./actions";

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("de-DE", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default async function BillingPage() {
  const supabase = await createClient();
  const org = await getCurrentOrg(supabase);

  // Billing is per-organization and owner-only. Members see a notice instead of
  // the subscription controls (the Server Actions also enforce this).
  if (org && !canViewBilling(org.role)) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-semibold">Abonnement</h1>
        <div className="mt-6 rounded-lg border p-6">
          <p>
            Das Abonnement wird vom Inhaber deiner Organisation verwaltet. Bitte
            wende dich an den Inhaber, wenn du Fragen zur Abrechnung hast.
          </p>
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
      <h1 className="text-2xl font-semibold">Abonnement</h1>

      <div className="mt-6 rounded-lg border p-6">
        {status === "trialing" && (
          <p>
            Du befindest dich in der kostenlosen Testphase
            {trialEndsAt ? ` bis zum ${trialEndsAt}` : ""}. Danach kostet hantverkare
            29&nbsp;€/Monat.
          </p>
        )}
        {status === "active" && <p>Dein Abonnement ist aktiv. Vielen Dank!</p>}
        {(status === "canceled" || status === "past_due" || status === "unpaid") && (
          <p>
            Dein Abonnement ist derzeit nicht aktiv (Status: {status}). Bitte
            abonniere erneut, um weiter Zugriff zu haben.
          </p>
        )}
        {!status && <p>Du hast noch kein Abonnement.</p>}

        <div className="mt-6 flex gap-3">
          {status !== "active" && (
            <form action={createCheckoutSession}>
              <button
                type="submit"
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
              >
                Jetzt abonnieren (29&nbsp;€/Monat)
              </button>
            </form>
          )}
          {hasStripeCustomer && (
            <form action={createBillingPortalSession}>
              <button
                type="submit"
                className="rounded-md border px-4 py-2 text-sm font-medium"
              >
                Abonnement verwalten
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
