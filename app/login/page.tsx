import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  const initialError =
    error === "invalid_link" ? "Link abgelaufen oder ungültig, bitte erneut anfordern." : null;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : null;

  return <LoginForm initialError={initialError} next={safeNext} />;
}
