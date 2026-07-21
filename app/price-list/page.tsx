import { createClient } from "@/lib/supabase/server";
import { PriceListEditor } from "./PriceListEditor";

export default async function PriceListPage() {
  const supabase = await createClient();
  const { data: items, error } = await supabase
    .from("price_list_items")
    .select("id, label, unit, unit_price_cents, category")
    .order("category")
    .order("label");

  if (error) {
    console.error("Failed to load price list:", error);
  }

  return <PriceListEditor items={items ?? []} />;
}
