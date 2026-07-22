import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { SecuritySettingsForm } from "./SecuritySettingsForm";

export default async function SecuritySettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) {
    console.error("Failed to list MFA factors:", error);
  }

  // A factor only "counts" once it's verified -- an abandoned enrollment
  // (QR shown but never confirmed) should not be presented as active 2FA,
  // and the client re-enrolls over it.
  const verifiedTotp = (data?.totp ?? []).find((factor) => factor.status === "verified");

  return (
    <SecuritySettingsForm
      enrolled={
        verifiedTotp ? { factorId: verifiedTotp.id, friendlyName: verifiedTotp.friendly_name ?? null } : null
      }
    />
  );
}
