import { createClient } from "@supabase/supabase-js";

// Server-only. Bypasses RLS deliberately. Has several legitimate server-only
// call sites (e.g. app/q/[token]/page.tsx and app/q/[token]/actions.ts for
// looking up a quote by its unguessable share_token, where the token itself
// is the access control rather than RLS; and the danger-zone org-deletion
// action, which needs to read/delete across an organization's data and
// delete the auth.users row after ownership has already been verified).
// Never import this from a client component: the service role key must
// never reach the browser bundle.
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
