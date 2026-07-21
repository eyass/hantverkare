# Business Settings Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/settings` page where the tradesperson enters their business info (company
name, address, VAT ID, tax number) for future quote/invoice branding, upserted as one row
per account.

**Architecture:** A new `business_settings` table (T3: new migration) with owner-scoped
RLS, a server component that loads the current row (or null), a controlled client form,
and a single upsert Server Action.

**Tech Stack:** Next.js (App Router, Server Components), Supabase (Postgres/RLS).

---

## Task 1: Migration — `business_settings` table + RLS

**Files:**
- Create: `supabase/migrations/0004_business_settings.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Business settings: one row per account, used for future quote/invoice branding
-- (issue #11). All fields nullable — a business may not have every field on hand
-- yet (e.g. VAT ID pending registration). No logo field: Supabase Storage setup
-- is out of scope for this first version (YAGNI).

create table public.business_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  company_name text,
  address text,
  vat_id text,
  tax_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.business_settings enable row level security;

create policy "Users can view their own business settings"
  on public.business_settings for select
  using (auth.uid() = user_id);

create policy "Users can insert their own business settings"
  on public.business_settings for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own business settings"
  on public.business_settings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

- [ ] **Step 2: Commit**

```bash
git add supabase/migrations/0004_business_settings.sql
git commit -m "feat: add business_settings table + RLS (#11)"
```

---

## Task 2: Server Action — `saveBusinessSettings`

**Files:**
- Create: `app/settings/actions.ts`

- [ ] **Step 1: Write the upsert action**

Follow `app/price-list/actions.ts`'s conventions: `"use server"`, `createClient()`,
`auth.getUser()` guard, German error strings, `console.error` on failure, discriminated
`{error: string | null}` return.

```ts
"use server";

import { createClient } from "@/lib/supabase/server";

export type BusinessSettingsInput = {
  companyName: string;
  address: string;
  vatId: string;
  taxNumber: string;
};

type ActionResult = { error: string | null };

export async function saveBusinessSettings(
  input: BusinessSettingsInput,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Bitte melde dich an." };
  }

  const { error } = await supabase.from("business_settings").upsert(
    {
      user_id: user.id,
      company_name: input.companyName || null,
      address: input.address || null,
      vat_id: input.vatId || null,
      tax_number: input.taxNumber || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  if (error) {
    console.error("Failed to save business settings:", error);
    return { error: "Einstellungen konnten nicht gespeichert werden." };
  }

  return { error: null };
}
```

- [ ] **Step 2: Commit** (bundled with Task 3 & 4 as one feature commit is fine)

---

## Task 3: Server component — `/settings` page

**Files:**
- Create: `app/settings/page.tsx`

- [ ] **Step 1: Load the current row (or null)**

```tsx
import { createClient } from "@/lib/supabase/server";
import { SettingsForm } from "./SettingsForm";

export default async function SettingsPage() {
  const supabase = await createClient();
  const { data: settings, error } = await supabase
    .from("business_settings")
    .select("company_name, address, vat_id, tax_number")
    .maybeSingle();

  if (error) {
    console.error("Failed to load business settings:", error);
  }

  return <SettingsForm initialSettings={settings ?? null} />;
}
```

---

## Task 4: Client component — `SettingsForm`

**Files:**
- Create: `app/settings/SettingsForm.tsx`

- [ ] **Step 1: Controlled form with submit button**

Mirror `PriceListEditor.tsx`'s input styling (`rounded-md border border-zinc-300 p-2
dark:border-zinc-700 dark:bg-zinc-900`), `useTransition` for pending state, and a plain
error message paragraph. Single "Speichern" button (not save-on-blur), plus a brief
"Gespeichert." success message on success.

```tsx
"use client";

import { useState, useTransition } from "react";
import { saveBusinessSettings } from "./actions";

type BusinessSettings = {
  company_name: string | null;
  address: string | null;
  vat_id: string | null;
  tax_number: string | null;
};

export function SettingsForm({
  initialSettings,
}: {
  initialSettings: BusinessSettings | null;
}) {
  const [companyName, setCompanyName] = useState(initialSettings?.company_name ?? "");
  const [address, setAddress] = useState(initialSettings?.address ?? "");
  const [vatId, setVatId] = useState(initialSettings?.vat_id ?? "");
  const [taxNumber, setTaxNumber] = useState(initialSettings?.tax_number ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await saveBusinessSettings({
        companyName,
        address,
        vatId,
        taxNumber,
      });
      if (result.error !== null) {
        setError(result.error);
        setSaved(false);
        return;
      }
      setError(null);
      setSaved(true);
    });
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Unternehmensdaten</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && !error && <p className="text-sm text-green-600">Gespeichert.</p>}
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1 text-sm">
          Firmenname
          <input
            value={companyName}
            onChange={(e) => {
              setCompanyName(e.target.value);
              setSaved(false);
            }}
            className="rounded-md border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Adresse
          <textarea
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              setSaved(false);
            }}
            rows={3}
            className="rounded-md border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          USt-IdNr.
          <input
            value={vatId}
            onChange={(e) => {
              setVatId(e.target.value);
              setSaved(false);
            }}
            className="rounded-md border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          Steuernummer
          <input
            value={taxNumber}
            onChange={(e) => {
              setTaxNumber(e.target.value);
              setSaved(false);
            }}
            className="rounded-md border border-zinc-300 p-2 dark:border-zinc-700 dark:bg-zinc-900"
          />
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="self-start rounded-full bg-foreground px-5 py-3 text-background disabled:opacity-50"
        >
          Speichern
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/settings/
git commit -m "feat: add /settings page for business info (#11)"
```

---

## Task 5: Verification

- [ ] **Step 1:** `npm run build` — expect "Compiled successfully", exit code 0.
- [ ] **Step 2:** `npm run typecheck` — expect no errors.
- [ ] **Step 3:** `npm run lint` — expect no errors.
- [ ] **Step 4:** `npm test` — expect all existing tests still pass.
- [ ] **Step 5:** Push branch, open PR against `main`, note T3 tier and pending manual
  migration-apply step in the PR body. Do not merge.
