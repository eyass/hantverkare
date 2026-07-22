import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/organizations/getCurrentOrg";

// GDPR Art. 15 data export. Returns every row the organization owns as a
// single nested JSON document -- a plain JSON export is more defensible and
// complete than trying to flatten heterogeneous tables (quotes with nested
// line items, invoices, customers, price list, business settings) into CSVs,
// and per Art. 15 the format just needs to be usable/portable.
//
// Auth: any member of the org (owner or not) may export it -- GDPR access
// rights are personal to the data subject, not gated by role. We rely on
// getCurrentOrg (resolves the CALLER's own org from their session) plus RLS
// on every underlying table, so this can never leak another org's data.
//
// Deliberately excluded:
//  - `billing`: contains Stripe customer/subscription IDs, not user-facing data.
//  - `invoice_counters`: an internal sequence-generation helper, not user data.
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Bitte melde dich an." }, { status: 401 });
  }

  const org = await getCurrentOrg(supabase);
  if (!org) {
    return NextResponse.json({ error: "Keine Organisation gefunden." }, { status: 404 });
  }

  const orgId = org.organizationId;

  const [
    organizationResult,
    quotesResult,
    quoteLineItemsResult,
    customersResult,
    priceListItemsResult,
    businessSettingsResult,
    invoicesResult,
  ] = await Promise.all([
    supabase.from("organizations").select("id, name, created_at").eq("id", orgId).maybeSingle(),
    supabase.from("quotes").select("*").eq("organization_id", orgId),
    supabase.from("quote_line_items").select("*").eq("organization_id", orgId),
    supabase.from("customers").select("*").eq("organization_id", orgId),
    supabase.from("price_list_items").select("*").eq("organization_id", orgId),
    supabase.from("business_settings").select("*").eq("organization_id", orgId).maybeSingle(),
    supabase.from("invoices").select("*").eq("organization_id", orgId),
  ]);

  const errors = [
    organizationResult.error,
    quotesResult.error,
    quoteLineItemsResult.error,
    customersResult.error,
    priceListItemsResult.error,
    businessSettingsResult.error,
    invoicesResult.error,
  ].filter(Boolean);

  if (errors.length > 0) {
    console.error("GDPR export failed:", errors);
    return NextResponse.json(
      { error: "Export konnte nicht erstellt werden." },
      { status: 500 },
    );
  }

  const exportPayload = {
    exportedAt: new Date().toISOString(),
    format: "hantverkare-gdpr-export/v1",
    organization: organizationResult.data,
    businessSettings: businessSettingsResult.data,
    customers: customersResult.data,
    priceListItems: priceListItemsResult.data,
    quotes: quotesResult.data,
    quoteLineItems: quoteLineItemsResult.data,
    invoices: invoicesResult.data,
  };

  const filename = `hantverkare-export-${orgId}-${new Date().toISOString().slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(exportPayload, null, 2), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
