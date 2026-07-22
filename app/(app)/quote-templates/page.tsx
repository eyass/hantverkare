import { createClient } from "@/lib/supabase/server";
import { QuoteTemplatesEditor } from "./QuoteTemplatesEditor";

export default async function QuoteTemplatesPage() {
  const supabase = await createClient();
  const { data: templates, error } = await supabase
    .from("quote_templates")
    .select("id, name, created_at, quote_template_items(id)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load quote templates:", error);
  }

  const normalized = (templates ?? []).map((template) => ({
    id: template.id,
    name: template.name,
    createdAt: template.created_at,
    itemCount: template.quote_template_items.length,
  }));

  return <QuoteTemplatesEditor templates={normalized} />;
}
