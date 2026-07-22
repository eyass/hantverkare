import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TemplateDetailEditor } from "./TemplateDetailEditor";

export default async function QuoteTemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: template } = await supabase
    .from("quote_templates")
    .select("id, name, created_at")
    .eq("id", id)
    .single();
  if (!template) notFound();

  const { data: items, error: itemsError } = await supabase
    .from("quote_template_items")
    .select("id, label, unit, quantity, unit_price_cents, sort_order")
    .eq("template_id", id)
    .order("sort_order");
  if (itemsError) {
    console.error("Failed to load quote template items:", itemsError);
  }

  const { data: versions, error: versionsError } = await supabase
    .from("quote_template_versions")
    .select("id, version_number, name_snapshot, items_snapshot, created_at")
    .eq("template_id", id)
    .order("version_number", { ascending: false });
  if (versionsError) {
    console.error("Failed to load quote template versions:", versionsError);
  }

  return (
    <TemplateDetailEditor
      template={{ id: template.id, name: template.name, createdAt: template.created_at }}
      items={(items ?? []).map((item) => ({
        id: item.id,
        label: item.label,
        unit: item.unit,
        quantity: item.quantity,
        unitPriceCents: item.unit_price_cents,
      }))}
      versions={(versions ?? []).map((version) => ({
        id: version.id,
        versionNumber: version.version_number,
        name: version.name_snapshot,
        items: (version.items_snapshot as {
          label: string;
          unit: string;
          quantity: number;
          unit_price_cents: number;
        }[]).map((item) => ({
          label: item.label,
          unit: item.unit,
          quantity: item.quantity,
          unitPriceCents: item.unit_price_cents,
        })),
        createdAt: version.created_at,
      }))}
    />
  );
}
