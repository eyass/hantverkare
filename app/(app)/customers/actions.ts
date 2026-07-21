"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/organizations/getCurrentOrg";

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

  // organization_id is computed server-side from the authenticated session --
  // never taken from client input -- so a user can only ever write into their
  // own org (RLS also enforces this via is_org_member on WITH CHECK).
  const org = await getCurrentOrg(supabase);
  if (!org) {
    return { error: "Keine Organisation gefunden." };
  }

  const { data, error } = await supabase
    .from("customers")
    .insert({
      name: input.name,
      email: input.email || null,
      phone: input.phone || null,
      address: input.address || null,
      organization_id: org.organizationId,
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
