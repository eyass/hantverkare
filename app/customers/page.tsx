import { createClient } from "@/lib/supabase/server";
import { CustomerEditor } from "./CustomerEditor";

export default async function CustomersPage() {
  const supabase = await createClient();
  const { data: customers, error } = await supabase
    .from("customers")
    .select("id, name, email, phone, address")
    .order("name");

  if (error) {
    console.error("Failed to load customers:", error);
  }

  return <CustomerEditor customers={customers ?? []} />;
}
