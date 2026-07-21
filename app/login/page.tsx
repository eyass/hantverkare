import { LoginForm } from "./LoginForm";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const initialError =
    error === "invalid_link" ? "Link abgelaufen oder ungültig, bitte erneut anfordern." : null;

  return <LoginForm initialError={initialError} />;
}
