import { createClient } from "@/lib/supabase/server";
import NewQuoteForm from "./NewQuoteForm";
import { FromTemplateForm } from "./FromTemplateForm";

export default async function NewQuotePage() {
  const supabase = await createClient();
  const { data: customers, error } = await supabase
    .from("customers")
    .select("id, name")
    .order("name");

  if (error) {
    console.error("Failed to load customers:", error);
  }

  const { data: templates, error: templatesError } = await supabase
    .from("quote_templates")
    .select("id, name, quote_template_items(id)")
    .order("name");
  if (templatesError) {
    console.error("Failed to load quote templates:", templatesError);
  }
  const normalizedTemplates = (templates ?? []).map((template) => ({
    id: template.id,
    name: template.name,
    itemCount: template.quote_template_items.length,
  }));

  return (
    <div className="min-h-full bg-[#f4f6f8]">
      <NewQuoteForm customers={customers ?? []} />
      {normalizedTemplates.length > 0 && (
        <FromTemplateForm customers={customers ?? []} templates={normalizedTemplates} />
      )}
    </div>
  );
}
