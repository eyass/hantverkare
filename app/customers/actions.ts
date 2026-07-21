"use server";

import { createClient } from "@/lib/supabase/server";

export type CustomerInput = {
  name: string;
  email: string;
  phone: string;
  address: string;
};

type CustomerRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
};

type CreateResult = { error: string; customer?: never } | { error: null; customer: CustomerRow };

type ActionResult = { error: string | null };

function validateInput(input: CustomerInput): string | null {
  if (input.name.trim().length === 0) {
    return "Name darf nicht leer sein.";
  }
  return null;
}

export async function createCustomer(input: CustomerInput): Promise<CreateResult> {
  const validationError = validateInput(input);
  if (validationError) {
    return { error: validationError };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Bitte melde dich an." };
  }

  const { data, error } = await supabase
    .from("customers")
    .insert({
      name: input.name,
      email: input.email || null,
      phone: input.phone || null,
      address: input.address || null,
      user_id: user.id,
    })
    .select("id, name, email, phone, address")
    .single();
  if (error || !data) {
    console.error("Failed to create customer:", error);
    return { error: "Kunde konnte nicht angelegt werden." };
  }

  return { error: null, customer: data };
}

export async function updateCustomer(id: string, input: CustomerInput): Promise<ActionResult> {
  const validationError = validateInput(input);
  if (validationError) {
    return { error: validationError };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("customers")
    .update({
      name: input.name,
      email: input.email || null,
      phone: input.phone || null,
      address: input.address || null,
    })
    .eq("id", id);
  if (error) {
    console.error("Failed to update customer:", error);
    return { error: "Kunde konnte nicht gespeichert werden." };
  }

  return { error: null };
}

export async function deleteCustomer(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("customers").delete().eq("id", id);
  if (error) {
    console.error("Failed to delete customer:", error);
    return { error: "Kunde konnte nicht gelöscht werden." };
  }

  return { error: null };
}
