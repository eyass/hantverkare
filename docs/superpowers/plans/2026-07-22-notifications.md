# Email Notification on Quote Signed — Plan

See design spec: `docs/superpowers/specs/2026-07-22-notifications-design.md`.

## Tasks

1. **`lib/notifications/sendSignedEmail.ts`**
   - Export `sendSignedNotification({ toEmail, signerName, quoteDescription, quoteId }): Promise<void>`.
   - Guard on `process.env.RESEND_API_KEY` missing -> log + return.
   - Build subject "Ihr Angebot wurde signiert", plain text body with signer name,
     truncated description, and `${NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/quotes/{quoteId}`.
   - `fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: "Bearer <key>", "Content-Type": "application/json" }, body: JSON.stringify({ from, to, subject, text }) })`.
   - Wrap everything in try/catch; on non-ok response or thrown error, `console.error` and return (never throw).

2. **`app/q/[token]/actions.ts`**
   - Extend `.select("id")` to `.select("id, user_id, customer_description")`.
   - After confirming success, in a nested try/catch: read `data[0]`, call
     `supabase.auth.admin.getUserById(data[0].user_id)`, and if an email is present call
     `sendSignedNotification`.
   - Ensure this block cannot affect the returned `{ error: null }`.

3. **`.env.example`**: add `RESEND_API_KEY=` with a short comment and link to
   `https://resend.com/api-keys`.

4. **`.github/workflows/ci.yml`**: add `RESEND_API_KEY: dummy-key-for-ci` to `quality`
   job env.

5. Verify: `npm run build`, `npm run typecheck`, `npm run lint`, `npm test`.

6. Commit in small commits, push `feat/notifications`, open PR (don't merge).

## Verification that sign flow can't break

- The DB update + its `.select()` happens first and is the only thing that determines
  the return value's `error` field.
- The email side effect is a separate `try { ... } catch (e) { console.error(...) }`
  block that starts only after that update already succeeded, and its own function
  (`sendSignedNotification`) additionally never throws.
- No `await` inside the email block can propagate an exception out of `signQuote`
  because it's caught locally.
