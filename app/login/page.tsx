import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string; ref?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    redirect("/price-list");
  }

  const { error, next, ref } = await searchParams;
  const initialError =
    error === "invalid_link" ? "Link abgelaufen oder ungültig, bitte erneut anfordern." : null;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;
  // Referral code (issue #79) is passed through as a hidden form field, not
  // set as a cookie here: this is a plain Server Component render, and Next
  // only allows setting cookies from Server Actions/Route Handlers. The
  // actual cookie is set in sendMagicLink() (app/login/actions.ts) once the
  // form is submitted. Format validation happens there too -- treat this as
  // untrusted query-param input until then.
  const safeRef = typeof ref === "string" ? ref : null;

  return <LoginForm initialError={initialError} next={safeNext} ref={safeRef} />;
}
