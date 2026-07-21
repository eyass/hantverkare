import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect("/price-list");
  }

  const { error, next } = await searchParams;
  const initialError =
    error === "invalid_link" ? "Link abgelaufen oder ungültig, bitte erneut anfordern." : null;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;

  return <LoginForm initialError={initialError} next={safeNext} />;
}
