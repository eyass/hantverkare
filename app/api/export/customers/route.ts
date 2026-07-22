import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { toCsv } from "@/lib/csv/toCsv";

export async function GET() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
  }

  // No explicit organization filter: RLS on `customers` scopes rows to the
  // caller's organization already (see supabase/migrations/0010_organizations.sql).
  const { data: customers, error } = await supabase
    .from("customers")
    .select("name, email, phone, address, created_at")
    .order("name");

  if (error) {
    console.error("Failed to export customers:", error);
    return NextResponse.json({ error: "Export fehlgeschlagen" }, { status: 500 });
  }

  const headers = ["Name", "E-Mail", "Telefon", "Adresse", "Erstellt am"];

  const rows = (customers ?? []).map((customer) => [
    customer.name,
    customer.email ?? "",
    customer.phone ?? "",
    customer.address ?? "",
    new Date(customer.created_at).toLocaleDateString("de-DE"),
  ]);

  const csv = toCsv(headers, rows);

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="kunden.csv"',
    },
  });
}
