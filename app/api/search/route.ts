import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  escapeIlikeTerm,
  groupSearchResults,
  isSearchableQuery,
  type RawCustomerRow,
  type RawQuoteRow,
} from "@/lib/search/formatResults";

// Read-only global search (issue #50) across quotes and customers, grouped by
// type. Deliberately no organization_id filter here: the Supabase client is
// created from the request's own auth cookies (see lib/supabase/server.ts),
// so every query below runs AS the authenticated user and the org-scoped RLS
// policies from supabase/migrations/0010_organizations.sql ("Members can view
// their org quotes/customers") already restrict rows to their organization.
// Adding a client-supplied org filter on top would be redundant at best and a
// trust-boundary bug at worst (an org id could be spoofed in the query
// string).
export async function GET(request: NextRequest) {
  const term = request.nextUrl.searchParams.get("q") ?? "";

  if (!isSearchableQuery(term)) {
    return NextResponse.json({ quotes: [], customers: [] });
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const pattern = `%${escapeIlikeTerm(term.trim())}%`;

  const [quotesResult, customersResult] = await Promise.all([
    supabase
      .from("quotes")
      .select("id, customer_description, status, created_at")
      .ilike("customer_description", pattern)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("customers")
      .select("id, name, email, phone")
      .ilike("name", pattern)
      .order("name")
      .limit(10),
  ]);

  if (quotesResult.error) {
    console.error("Global search: failed to query quotes:", quotesResult.error);
  }
  if (customersResult.error) {
    console.error("Global search: failed to query customers:", customersResult.error);
  }

  const grouped = groupSearchResults(
    (quotesResult.data ?? []) as RawQuoteRow[],
    (customersResult.data ?? []) as RawCustomerRow[],
  );

  return NextResponse.json(grouped);
}
