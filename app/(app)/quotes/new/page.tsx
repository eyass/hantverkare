import { createClient } from "@/lib/supabase/server";
import NewQuoteForm from "./NewQuoteForm";

export default async function NewQuotePage() {
  const supabase = await createClient();
  const { data: customers, error } = await supabase
    .from("customers")
    .select("id, name")
    .order("name");

  if (error) {
    console.error("Failed to load customers:", error);
  }

  return (
    <div className="min-h-full bg-[#f4f6f8]">
      <NewQuoteForm customers={customers ?? []} />
    </div>
  );
}
