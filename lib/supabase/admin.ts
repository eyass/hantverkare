import { createClient } from "@supabase/supabase-js";

// Server-only. Bypasses RLS deliberately and only for the narrow purpose of
// looking up a quote by its unguessable share_token -- the token itself is
// the access control, not RLS. Used ONLY by app/q/[token]/page.tsx and
// app/q/[token]/actions.ts. Never import this from a client component: the
// service role key must never reach the browser bundle.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
