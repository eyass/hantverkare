# Real Authentication Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the no-auth prototype with real Supabase Auth (magic link, open signup). Every tradesperson gets their own account, their own price list, and their own quotes — fully isolated via RLS. Closes [#14](https://github.com/eyass/hantverkare/issues/14) and folds in [#16](https://github.com/eyass/hantverkare/issues/16).

**Architecture:** `middleware.ts` refreshes sessions and gates `/quotes/*` + `/price-list/*` behind login. `/login` sends a magic link via `supabase.auth.signInWithOtp`; `/auth/callback` exchanges the code for a session. `quotes`, `quote_line_items`, and `price_list_items` gain a `user_id` column and owner-scoped RLS policies, replacing the old open ones. A new `/price-list` page provides CRUD since accounts now start with an empty price list.

**Tech Stack:** Next.js (App Router, Server Actions, Middleware) · TypeScript · `@supabase/ssr` (already installed) · Supabase Auth/Postgres/RLS

---

## File Structure

Created by this plan:
- `middleware.ts` (project root) — invokes session refresh + route protection
- `lib/supabase/middleware.ts` — `updateSession()` helper
- `app/login/page.tsx`, `app/login/LoginForm.tsx`, `app/login/actions.ts` — magic link request form
- `app/auth/callback/route.ts` — exchanges the magic link code for a session
- `app/logout/actions.ts` — sign-out Server Action
- `app/price-list/page.tsx`, `app/price-list/PriceListEditor.tsx`, `app/price-list/actions.ts` — price list CRUD
- `supabase/migrations/0003_auth.sql` — `user_id` columns + owner-scoped RLS + data wipe

Modified:
- `lib/supabase/server.ts` — remove the now-resolved TODO comment
- `app/layout.tsx` — show signed-in user's email + sign-out link when authenticated
- `app/quotes/new/actions.ts` — scope to `auth.uid()`, add empty-price-list guard
- `.env.example`, `.github/workflows/ci.yml` — add `NEXT_PUBLIC_SITE_URL`

---

## Task 1: Database schema — user_id columns, owner-scoped RLS, data wipe

**Files:**
- Create: `supabase/migrations/0003_auth.sql`

This touches `supabase/migrations/` — per `.harness/RISK-TIERS.md` this is **T3**. Flag it clearly in the PR and stop for explicit human approval before merging (do not auto-merge).

- [ ] **Step 1: Create the migration**

Create `supabase/migrations/0003_auth.sql`:
```sql
-- Real authentication: scope quotes, quote_line_items, and price_list_items to
-- the authenticated user (auth.users). Folds in the per-tradesperson price list
-- scoping originally tracked as a separate backlog item (#16), since it's the
-- same migration touching the same tables.

-- Existing prototype data has no owner and cannot be attributed to a real
-- account — wiped rather than backfilled. Order matters for FK constraints.
truncate table public.quote_line_items, public.quotes, public.price_list_items;

alter table public.quotes
  add column user_id uuid not null references auth.users(id) on delete cascade;

alter table public.quote_line_items
  add column user_id uuid not null references auth.users(id) on delete cascade;

alter table public.price_list_items
  add column user_id uuid not null references auth.users(id) on delete cascade;

-- Replace the open prototype policies with owner-scoped ones.
drop policy "Quotes are viewable by everyone" on public.quotes;
drop policy "Anyone can insert quotes" on public.quotes;
drop policy "Anyone can update quotes" on public.quotes;

create policy "Users can view their own quotes"
  on public.quotes for select
  using (auth.uid() = user_id);

create policy "Users can insert their own quotes"
  on public.quotes for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own quotes"
  on public.quotes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy "Line items are viewable by everyone" on public.quote_line_items;
drop policy "Anyone can insert line items" on public.quote_line_items;
drop policy "Anyone can update line items" on public.quote_line_items;

create policy "Users can view their own line items"
  on public.quote_line_items for select
  using (auth.uid() = user_id);

create policy "Users can insert their own line items"
  on public.quote_line_items for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own line items"
  on public.quote_line_items for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- price_list_items was previously read-only/unowned; now each account manages
-- its own, so it gains insert/update/delete policies for the first time.
drop policy "Price list items are viewable by everyone" on public.price_list_items;

create policy "Users can view their own price list items"
  on public.price_list_items for select
  using (auth.uid() = user_id);

create policy "Users can insert their own price list items"
  on public.price_list_items for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own price list items"
  on public.price_list_items for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own price list items"
  on public.price_list_items for delete
  using (auth.uid() = user_id);
```

- [ ] **Step 2: Apply the migration**

Ask the human to run this SQL in the Supabase SQL editor for the linked project (same process as `0001_init.sql`/`0002_quotes.sql`). This truncates existing quotes/line-items/price-list data — confirm with the human this is expected (it was already agreed during brainstorming) before running.
Verify: `quotes`, `quote_line_items`, `price_list_items` are all empty; each has a `user_id` column (not null); `price_list_items` now shows 4 policies in Supabase → Table Editor → RLS (select/insert/update/delete) instead of just 1.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0003_auth.sql
git commit -m "feat: scope quotes/line-items/price-list to authenticated users"
```

---

## Task 2: Middleware — session refresh + route protection

**Files:**
- Create: `lib/supabase/middleware.ts`
- Create: `middleware.ts`
- Modify: `lib/supabase/server.ts`

- [ ] **Step 1: Create the session-refresh + route-protection helper**

Create `lib/supabase/middleware.ts`:
```ts
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = ["/quotes", "/price-list"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isProtected = PROTECTED_PREFIXES.some((prefix) =>
    request.nextUrl.pathname.startsWith(prefix),
  );

  if (!user && isProtected) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return supabaseResponse;
}
```

- [ ] **Step 2: Create the root middleware**

Create `middleware.ts` (project root, alongside `package.json`):
```ts
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 3: Remove the now-resolved TODO in `lib/supabase/server.ts`**

In `lib/supabase/server.ts`, the `catch` block currently reads:
```ts
          } catch {
            // Called from a Server Component, where cookies can't be mutated.
            // TODO: add middleware.ts to refresh sessions before real auth ships.
          }
```
Change the comment to:
```ts
          } catch {
            // Called from a Server Component, where cookies can't be mutated.
            // Safe to ignore: middleware.ts refreshes the session on every request.
          }
```

- [ ] **Step 4: Verify the build passes**

Run: `npm run build`
Expected: "Compiled successfully", exit code 0. (Functional verification of the redirect behavior happens in Task 8's manual QA, once `/login` exists.)

- [ ] **Step 5: Commit**

```bash
git add middleware.ts lib/supabase/middleware.ts lib/supabase/server.ts
git commit -m "feat: add session-refresh middleware with route protection"
```

---

## Task 3: `/login` page + magic link + auth callback

**Files:**
- Create: `app/login/actions.ts`
- Create: `app/login/LoginForm.tsx`
- Create: `app/login/page.tsx`
- Create: `app/auth/callback/route.ts`
- Modify: `.env.example`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add the site URL env var**

In `.env.example`, append:
```
# Used to build the magic-link redirect URL. Set to your Vercel/production URL in prod.
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

- [ ] **Step 2: Add a dummy value to CI**

In `.github/workflows/ci.yml`, under the `quality` job's `env:` block, add `NEXT_PUBLIC_SITE_URL: http://localhost:3000` alongside the existing dummy values:
```yaml
    env:
      NEXT_PUBLIC_SUPABASE_URL: https://example.supabase.co
      NEXT_PUBLIC_SUPABASE_ANON_KEY: dummy-anon-key-for-ci-build
      ANTHROPIC_API_KEY: dummy-key-for-ci
      NEXT_PUBLIC_SITE_URL: http://localhost:3000
```

- [ ] **Step 3: Create the magic-link Server Action**

Create `app/login/actions.ts`:
```ts
"use server";

import { createClient } from "@/lib/supabase/server";

export type LoginState = { error: string | null; sent: boolean };

export async function sendMagicLink(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = formData.get("email");
  if (typeof email !== "string" || !email.includes("@")) {
    return { error: "Bitte gib eine gültige E-Mail-Adresse ein.", sent: false };
  }

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  });
  if (error) {
    console.error("Failed to send magic link:", error);
    return { error: "Link konnte nicht gesendet werden. Bitte versuche es erneut.", sent: false };
  }

  return { error: null, sent: true };
}
```

- [ ] **Step 4: Create the login form component**

Create `app/login/LoginForm.tsx`:
```tsx
"use client";

import { useActionState } from "react";
import { sendMagicLink, type LoginState } from "./actions";

export function LoginForm({ initialError }: { initialError: string | null }) {
  const initialState: LoginState = { error: initialError, sent: false };
  const [state, formAction, isPending] = useActionState(sendMagicLink, initialState);

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">Anmelden</h1>
      {state.sent ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Wir haben dir einen Anmeldelink per E-Mail geschickt. Bitte prüfe dein Postfach.
        </p>
      ) : (
        <form action={formAction} className="flex flex-col gap-4">
          <label htmlFor="email" className="text-sm font-medium">
            E-Mail-Adresse
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="du@beispiel.de"
            className="w-full rounded-md border border-zinc-300 p-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
          />
          {state.error && <p className="text-sm text-red-600">{state.error}</p>}
          <button
            type="submit"
            disabled={isPending}
            className="self-start rounded-full bg-foreground px-5 py-3 text-background disabled:opacity-50"
          >
            {isPending ? "Wird gesendet…" : "Anmeldelink senden"}
          </button>
        </form>
      )}
    </div>
  );
}
```

- [ ] **Step 5: Create the login page**

Create `app/login/page.tsx`:
```tsx
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
```

- [ ] **Step 6: Create the auth callback route**

Create `app/auth/callback/route.ts`:
```ts
import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/price-list";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    console.error("Failed to exchange code for session:", error);
  }

  const loginUrl = new URL("/login", origin);
  loginUrl.searchParams.set("error", "invalid_link");
  return NextResponse.redirect(loginUrl);
}
```

- [ ] **Step 7: Verify the build passes**

Run: `npm run build`
Expected: "Compiled successfully", exit code 0.

- [ ] **Step 8: Commit**

```bash
git add app/login app/auth .env.example .github/workflows/ci.yml
git commit -m "feat: add magic link login + auth callback"
```

---

## Task 4: Sign-out + header

**Files:**
- Create: `app/logout/actions.ts`
- Modify: `app/layout.tsx`

- [ ] **Step 1: Create the sign-out Server Action**

Create `app/logout/actions.ts`:
```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
```

- [ ] **Step 2: Show the signed-in user + sign-out link in the root layout**

In `app/layout.tsx`, the current file is:
```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Create Next App",
  description: "Generated by create next app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
```

Replace it with:
```tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/logout/actions";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Create Next App",
  description: "Generated by create next app",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {user && (
          <header className="flex items-center justify-between border-b border-zinc-200 px-8 py-3 text-sm dark:border-zinc-800">
            <span className="text-zinc-600 dark:text-zinc-400">{user.email}</span>
            <form action={signOut}>
              <button type="submit" className="underline">
                Abmelden
              </button>
            </form>
          </header>
        )}
        {children}
      </body>
    </html>
  );
}
```

Only the `RootLayout` function body and the two new imports change — `metadata` and the font setup are untouched.

- [ ] **Step 3: Verify the build passes**

Run: `npm run build`
Expected: "Compiled successfully", exit code 0. Note: the root layout is now `async` and reads cookies, so every page becomes dynamically rendered (no more static prerendering) — this is expected once auth exists, not a bug.

- [ ] **Step 4: Commit**

```bash
git add app/logout app/layout.tsx
git commit -m "feat: add sign-out action and header"
```

---

## Task 5: `/price-list` — CRUD page

**Files:**
- Create: `app/price-list/actions.ts`
- Create: `app/price-list/PriceListEditor.tsx`
- Create: `app/price-list/page.tsx`

- [ ] **Step 1: Create the CRUD Server Actions**

Create `app/price-list/actions.ts`:
```ts
"use server";

import { createClient } from "@/lib/supabase/server";

export type PriceListItemInput = {
  label: string;
  unit: string;
  unitPriceCents: number;
  category: string;
};

type PriceListItemRow = {
  id: string;
  label: string;
  unit: string;
  unit_price_cents: number;
  category: string;
};

type CreateResult = { error: string; item?: never } | { error: null; item: PriceListItemRow };

type ActionResult = { error: string | null };

function validateInput(input: PriceListItemInput): string | null {
  if (input.label.trim().length === 0 || input.unit.trim().length === 0) {
    return "Bezeichnung und Einheit dürfen nicht leer sein.";
  }
  if (!Number.isInteger(input.unitPriceCents) || input.unitPriceCents <= 0) {
    return "Preis muss größer als 0 sein.";
  }
  return null;
}

export async function createPriceListItem(input: PriceListItemInput): Promise<CreateResult> {
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
    .from("price_list_items")
    .insert({
      label: input.label,
      unit: input.unit,
      unit_price_cents: input.unitPriceCents,
      category: input.category,
      user_id: user.id,
    })
    .select("id, label, unit, unit_price_cents, category")
    .single();
  if (error || !data) {
    console.error("Failed to create price list item:", error);
    return { error: "Position konnte nicht angelegt werden." };
  }

  return { error: null, item: data };
}

export async function updatePriceListItem(
  id: string,
  input: PriceListItemInput,
): Promise<ActionResult> {
  const validationError = validateInput(input);
  if (validationError) {
    return { error: validationError };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("price_list_items")
    .update({
      label: input.label,
      unit: input.unit,
      unit_price_cents: input.unitPriceCents,
      category: input.category,
    })
    .eq("id", id);
  if (error) {
    console.error("Failed to update price list item:", error);
    return { error: "Position konnte nicht gespeichert werden." };
  }

  return { error: null };
}

export async function deletePriceListItem(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase.from("price_list_items").delete().eq("id", id);
  if (error) {
    console.error("Failed to delete price list item:", error);
    return { error: "Position konnte nicht gelöscht werden." };
  }

  return { error: null };
}
```

- [ ] **Step 2: Create the client editor component**

Create `app/price-list/PriceListEditor.tsx`:
```tsx
"use client";

import { useState, useTransition } from "react";
import {
  createPriceListItem,
  updatePriceListItem,
  deletePriceListItem,
  type PriceListItemInput,
} from "./actions";

type PriceListItem = {
  id: string;
  label: string;
  unit: string;
  unit_price_cents: number;
  category: string;
};

function centsToEuroString(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function PriceListEditor({ items: initialItems }: { items: PriceListItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [lastSavedItems, setLastSavedItems] = useState(initialItems);
  const [error, setError] = useState<string | null>(null);
  const [newItem, setNewItem] = useState({ label: "", unit: "", unitPrice: "", category: "" });
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    const input: PriceListItemInput = {
      label: newItem.label,
      unit: newItem.unit,
      unitPriceCents: Math.round(Number(newItem.unitPrice) * 100),
      category: newItem.category,
    };
    startTransition(async () => {
      const result = await createPriceListItem(input);
      if (result.error !== null) {
        setError(result.error);
        return;
      }
      setError(null);
      setItems((prev) => [...prev, result.item]);
      setLastSavedItems((prev) => [...prev, result.item]);
      setNewItem({ label: "", unit: "", unitPrice: "", category: "" });
    });
  }

  function handleFieldChange(
    id: string,
    field: "label" | "unit" | "unit_price_cents" | "category",
    value: string,
  ) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, [field]: field === "unit_price_cents" ? Number(value) : value }
          : item,
      ),
    );
  }

  function handleBlurSave(item: PriceListItem) {
    startTransition(async () => {
      const result = await updatePriceListItem(item.id, {
        label: item.label,
        unit: item.unit,
        unitPriceCents: item.unit_price_cents,
        category: item.category,
      });
      if (result.error !== null) {
        setError(result.error);
        setItems((prev) =>
          prev.map((i) =>
            i.id === item.id ? (lastSavedItems.find((saved) => saved.id === item.id) ?? i) : i,
          ),
        );
        return;
      }
      setError(null);
      setLastSavedItems((prev) => prev.map((i) => (i.id === item.id ? item : i)));
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      const result = await deletePriceListItem(id);
      if (result.error !== null) {
        setError(result.error);
        return;
      }
      setError(null);
      setItems((prev) => prev.filter((item) => item.id !== id));
      setLastSavedItems((prev) => prev.filter((item) => item.id !== id));
    });
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Preisliste</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-300 dark:border-zinc-700">
            <th className="py-2">Bezeichnung</th>
            <th className="py-2">Einheit</th>
            <th className="py-2">Preis (EUR)</th>
            <th className="py-2">Kategorie</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-zinc-200 dark:border-zinc-800">
              <td className="py-2">
                <input
                  value={item.label}
                  onChange={(e) => handleFieldChange(item.id, "label", e.target.value)}
                  onBlur={() => handleBlurSave(item)}
                  className="w-full bg-transparent"
                />
              </td>
              <td className="py-2">
                <input
                  value={item.unit}
                  onChange={(e) => handleFieldChange(item.id, "unit", e.target.value)}
                  onBlur={() => handleBlurSave(item)}
                  className="w-24 bg-transparent"
                />
              </td>
              <td className="py-2">
                <input
                  type="number"
                  value={centsToEuroString(item.unit_price_cents)}
                  onChange={(e) =>
                    handleFieldChange(
                      item.id,
                      "unit_price_cents",
                      String(Math.round(Number(e.target.value) * 100)),
                    )
                  }
                  onBlur={() => handleBlurSave(item)}
                  className="w-24 bg-transparent"
                />
              </td>
              <td className="py-2">
                <input
                  value={item.category}
                  onChange={(e) => handleFieldChange(item.id, "category", e.target.value)}
                  onBlur={() => handleBlurSave(item)}
                  className="w-32 bg-transparent"
                />
              </td>
              <td className="py-2">
                <button onClick={() => handleDelete(item.id)} className="text-red-600 underline">
                  Löschen
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-col gap-2 border-t border-zinc-300 pt-4 dark:border-zinc-700">
        <h2 className="text-lg font-medium">Neue Position</h2>
        <div className="flex flex-wrap gap-2">
          <input
            value={newItem.label}
            onChange={(e) => setNewItem((prev) => ({ ...prev, label: e.target.value }))}
            placeholder="Bezeichnung"
            className="flex-1 rounded-md border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <input
            value={newItem.unit}
            onChange={(e) => setNewItem((prev) => ({ ...prev, unit: e.target.value }))}
            placeholder="Einheit"
            className="w-24 rounded-md border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <input
            type="number"
            value={newItem.unitPrice}
            onChange={(e) => setNewItem((prev) => ({ ...prev, unitPrice: e.target.value }))}
            placeholder="Preis (EUR)"
            className="w-28 rounded-md border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
          <input
            value={newItem.category}
            onChange={(e) => setNewItem((prev) => ({ ...prev, category: e.target.value }))}
            placeholder="Kategorie"
            className="w-32 rounded-md border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={isPending}
          className="self-start rounded-full bg-foreground px-5 py-3 text-background disabled:opacity-50"
        >
          Position hinzufügen
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create the server page**

Create `app/price-list/page.tsx`:
```tsx
import { createClient } from "@/lib/supabase/server";
import { PriceListEditor } from "./PriceListEditor";

export default async function PriceListPage() {
  const supabase = await createClient();
  const { data: items, error } = await supabase
    .from("price_list_items")
    .select("id, label, unit, unit_price_cents, category")
    .order("category")
    .order("label");

  if (error) {
    console.error("Failed to load price list:", error);
  }

  return <PriceListEditor items={items ?? []} />;
}
```

- [ ] **Step 4: Verify the build passes**

Run: `npm run build`
Expected: "Compiled successfully", exit code 0.

- [ ] **Step 5: Commit**

```bash
git add app/price-list
git commit -m "feat: add price list CRUD page"
```

---

## Task 6: Scope quote generation to the authenticated user

**Files:**
- Modify: `app/quotes/new/actions.ts`

- [ ] **Step 1: Update the Server Action**

In `app/quotes/new/actions.ts`, the current file is:
```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateLineItems, QuoteGenerationError } from "@/lib/quotes/generateLineItems";
import { priceLineItem, computeTotals } from "@/lib/quotes/pricing";

export type GenerateQuoteState = { error: string | null };

export async function generateQuoteDraft(
  _prevState: GenerateQuoteState,
  formData: FormData,
): Promise<GenerateQuoteState> {
  const description = formData.get("description");
  if (typeof description !== "string" || description.trim().length === 0) {
    return { error: "Bitte beschreibe den Auftrag." };
  }
  if (description.length > 2000) {
    return { error: "Die Beschreibung ist zu lang (max. 2000 Zeichen)." };
  }

  const supabase = await createClient();
  const { data: priceList, error: priceListError } = await supabase
    .from("price_list_items")
    .select("label, unit, unit_price_cents, category");
  if (priceListError || !priceList) {
    console.error("Failed to load price list:", priceListError);
    return { error: "Preisliste konnte nicht geladen werden." };
  }

  let lineItems;
  try {
    lineItems = await generateLineItems(
      description,
      priceList.map((p) => ({
        label: p.label,
        unit: p.unit,
        unitPriceCents: p.unit_price_cents,
        category: p.category,
      })),
    );
  } catch (err) {
    if (err instanceof QuoteGenerationError) {
      console.error("Quote generation failed:", err);
      return { error: `Angebot konnte nicht erstellt werden: ${err.message}` };
    }
    throw err;
  }

  const pricedItems = lineItems.map(priceLineItem);
  const totals = computeTotals(pricedItems);

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .insert({
      customer_description: description,
      status: "draft",
      subtotal_cents: totals.subtotalCents,
      vat_cents: totals.vatCents,
      total_cents: totals.totalCents,
    })
    .select("id")
    .single();
  if (quoteError || !quote) {
    console.error("Failed to insert quote:", quoteError);
    return { error: "Angebot konnte nicht gespeichert werden." };
  }

  const { error: lineItemsError } = await supabase.from("quote_line_items").insert(
    pricedItems.map((item, index) => ({
      quote_id: quote.id,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_price_cents: item.unitPriceCents,
      line_total_cents: item.lineTotalCents,
      position: index,
    })),
  );
  if (lineItemsError) {
    console.error("Failed to insert line items:", lineItemsError);
    await supabase.from("quotes").delete().eq("id", quote.id);
    return { error: "Positionen konnten nicht gespeichert werden." };
  }

  redirect(`/quotes/${quote.id}`);
}
```

Replace it with:
```ts
"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { generateLineItems, QuoteGenerationError } from "@/lib/quotes/generateLineItems";
import { priceLineItem, computeTotals } from "@/lib/quotes/pricing";

export type GenerateQuoteState = { error: string | null };

export async function generateQuoteDraft(
  _prevState: GenerateQuoteState,
  formData: FormData,
): Promise<GenerateQuoteState> {
  const description = formData.get("description");
  if (typeof description !== "string" || description.trim().length === 0) {
    return { error: "Bitte beschreibe den Auftrag." };
  }
  if (description.length > 2000) {
    return { error: "Die Beschreibung ist zu lang (max. 2000 Zeichen)." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Bitte melde dich an." };
  }

  const { data: priceList, error: priceListError } = await supabase
    .from("price_list_items")
    .select("label, unit, unit_price_cents, category");
  if (priceListError || !priceList) {
    console.error("Failed to load price list:", priceListError);
    return { error: "Preisliste konnte nicht geladen werden." };
  }
  if (priceList.length === 0) {
    return { error: "Bitte lege zuerst Preislistenpositionen an." };
  }

  let lineItems;
  try {
    lineItems = await generateLineItems(
      description,
      priceList.map((p) => ({
        label: p.label,
        unit: p.unit,
        unitPriceCents: p.unit_price_cents,
        category: p.category,
      })),
    );
  } catch (err) {
    if (err instanceof QuoteGenerationError) {
      console.error("Quote generation failed:", err);
      return { error: `Angebot konnte nicht erstellt werden: ${err.message}` };
    }
    throw err;
  }

  const pricedItems = lineItems.map(priceLineItem);
  const totals = computeTotals(pricedItems);

  const { data: quote, error: quoteError } = await supabase
    .from("quotes")
    .insert({
      customer_description: description,
      status: "draft",
      subtotal_cents: totals.subtotalCents,
      vat_cents: totals.vatCents,
      total_cents: totals.totalCents,
      user_id: user.id,
    })
    .select("id")
    .single();
  if (quoteError || !quote) {
    console.error("Failed to insert quote:", quoteError);
    return { error: "Angebot konnte nicht gespeichert werden." };
  }

  const { error: lineItemsError } = await supabase.from("quote_line_items").insert(
    pricedItems.map((item, index) => ({
      quote_id: quote.id,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_price_cents: item.unitPriceCents,
      line_total_cents: item.lineTotalCents,
      position: index,
      user_id: user.id,
    })),
  );
  if (lineItemsError) {
    console.error("Failed to insert line items:", lineItemsError);
    await supabase.from("quotes").delete().eq("id", quote.id);
    return { error: "Positionen konnten nicht gespeichert werden." };
  }

  redirect(`/quotes/${quote.id}`);
}
```

The only changes: fetch the authenticated user and bail out with a friendly error if absent (defensive — middleware should already prevent reaching this action while logged out), reject an empty price list before calling Claude, and set `user_id` on both inserts.

`app/quotes/[id]/actions.ts` (`updateLineItem`, `finalizeQuote`) needs no changes — those only `update` existing rows, and RLS's `auth.uid() = user_id` check already governs which rows are visible/updatable without any code change.

- [ ] **Step 2: Verify the build passes**

Run: `npm run build`
Expected: "Compiled successfully", exit code 0.

- [ ] **Step 3: Commit**

```bash
git add app/quotes/new/actions.ts
git commit -m "feat: scope quote generation to the authenticated user"
```

---

## Task 7: Manual end-to-end QA

Requires the migration from Task 1 already applied. Uses two real, distinct email addresses (or one email with a `+alias`, e.g. `you+test1@gmail.com` / `you+test2@gmail.com`, which most providers treat as distinct inboxes into the same mailbox) to verify account isolation.

- [ ] **Step 1: Start the dev server and confirm route protection**

Run: `npm run dev`
Using the browser skill, navigate to `http://localhost:3000/quotes/new` while logged out.
Expected: redirected to `/login?next=%2Fquotes%2Fnew`.

- [ ] **Step 2: Sign in as test account 1**

On `/login`, enter test email 1, submit.
Expected: "Wir haben dir einen Anmeldelink..." confirmation shown. Retrieve the magic link from the actual email (or Supabase's Auth logs / email testing tool if using a non-real inbox), open it.
Expected: redirected to `/price-list`, header shows the signed-in email + "Abmelden" link.

- [ ] **Step 3: Add price list items and generate a quote**

On `/price-list`, add 2-3 items (e.g. matching the old seed data — "Sanitärinstallation, Arbeitsstunde", Stunde, 65.00, Sanitär). Confirm they save and persist on reload.
Navigate to `/quotes/new`, submit a job description matching those items.
Expected: draft quote generated successfully, same as the original quote generation feature's behavior.

- [ ] **Step 4: Confirm the empty-price-list guard (before adding items, if not already tested)**

If not already naturally exercised: sign in as a brand-new second test account (test email 2) before adding any price list items, go straight to `/quotes/new`, submit a description.
Expected: inline error "Bitte lege zuerst Preislistenpositionen an." — no quote created.

- [ ] **Step 5: Confirm account isolation**

While signed in as test account 2, navigate to `/price-list`.
Expected: empty list (test account 1's items are NOT visible).
Attempt to navigate directly to test account 1's quote URL (`/quotes/<test-account-1-quote-id>`).
Expected: 404 (not found) — RLS hides it.

- [ ] **Step 6: Confirm sign-out**

Click "Abmelden".
Expected: redirected to `/login`; navigating back to `/quotes/new` or `/price-list` redirects to `/login` again (session actually cleared, not just UI-hidden).
