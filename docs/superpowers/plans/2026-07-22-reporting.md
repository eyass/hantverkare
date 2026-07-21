# Reporting/Analytics Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A `/reports` page summarizing quote-to-signed conversion rate and total revenue from signed quotes.

**Architecture:** A single server component reading `status, total_cents` for all of the signed-in user's `quotes` (RLS-scoped, one query), computing all metrics in plain TypeScript, rendering a grid of stat tiles.

**Tech Stack:** Next.js (App Router, Server Components)

---

## Task 1: `/reports` page

**Files:**
- Create: `app/reports/page.tsx`

- [ ] **Step 1: Create the reports page**

Create `app/reports/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";

function formatEuros(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function formatPercent(ratio: number): string {
  return ratio.toLocaleString("de-DE", { style: "percent", maximumFractionDigits: 1 });
}

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data: quotes, error } = await supabase.from("quotes").select("status, total_cents");
  if (error) {
    console.error("Failed to load quotes for reports:", error);
  }

  const rows = quotes ?? [];
  const totalQuotes = rows.length;
  const draftCount = rows.filter((q) => q.status === "draft").length;
  const finalCount = rows.filter((q) => q.status === "final").length;
  const signedCount = rows.filter((q) => q.status === "signed").length;

  const conversionDenominator = finalCount + signedCount;
  const conversionRate =
    conversionDenominator === 0 ? null : signedCount / conversionDenominator;

  const totalRevenueCents = rows
    .filter((q) => q.status === "signed")
    .reduce((sum, q) => sum + q.total_cents, 0);

  const averageSignedValueCents = signedCount === 0 ? null : totalRevenueCents / signedCount;

  const tiles: { label: string; value: string }[] = [
    { label: "Angebote insgesamt", value: String(totalQuotes) },
    { label: "Entwurf", value: String(draftCount) },
    { label: "Final", value: String(finalCount) },
    { label: "Signiert", value: String(signedCount) },
    {
      label: "Abschlussquote",
      value: conversionRate === null ? "–" : formatPercent(conversionRate),
    },
    { label: "Umsatz (signiert)", value: formatEuros(totalRevenueCents) },
    {
      label: "Ø Wert pro signiertem Angebot",
      value: averageSignedValueCents === null ? "–" : formatEuros(averageSignedValueCents),
    },
  ];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Auswertung</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        {tiles.map((tile) => (
          <div
            key={tile.label}
            className="flex flex-col gap-1 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
          >
            <span className="text-sm text-zinc-600 dark:text-zinc-400">{tile.label}</span>
            <span className="text-2xl font-semibold">{tile.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

Note: `conversionRate` and `averageSignedValueCents` guard division by zero by returning
`null` when the denominator is 0, rendered as "–".

- [ ] **Step 2: Verify**

Run `npm run build`, `npm run typecheck`, `npm run lint`, `npm test`. All must pass clean.

- [ ] **Step 3: Commit and push**

Commit with a `feat:` message, push branch `feat/reporting` to origin, open a PR against
`main` titled "feat: reporting/analytics dashboard". Do not merge.

## Out of scope (see design spec)

- Nav link in `app/layout.tsx` (added centrally by controller afterward).
- Date-range filtering, charts/graphs.
