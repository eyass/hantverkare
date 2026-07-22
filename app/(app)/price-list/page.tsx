import { createClient } from "@/lib/supabase/server";
import { PriceListEditor } from "./PriceListEditor";
import { PriceListWizard, type TemplateWithItems } from "./PriceListWizard";

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

  if ((items ?? []).length > 0) {
    return <PriceListEditor items={items ?? []} />;
  }

  const { data: templates, error: templatesError } = await supabase
    .from("price_list_templates")
    .select(
      "id, trade_key, trade_label, sort_order, price_list_template_items(id, label, unit, default_unit_price_cents, category, sort_order)",
    )
    .order("sort_order")
    .order("sort_order", { referencedTable: "price_list_template_items" });

  if (templatesError) {
    console.error("Failed to load price list templates:", templatesError);
  }

  const normalizedTemplates: TemplateWithItems[] = (templates ?? []).map((template) => ({
    id: template.id,
    tradeKey: template.trade_key,
    tradeLabel: template.trade_label,
    items: template.price_list_template_items.map((item) => ({
      id: item.id,
      label: item.label,
      unit: item.unit,
      defaultUnitPriceCents: item.default_unit_price_cents,
      category: item.category,
    })),
  }));

  return <PriceListWizard templates={normalizedTemplates} />;
}
