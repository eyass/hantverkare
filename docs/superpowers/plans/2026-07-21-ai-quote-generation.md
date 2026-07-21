# AI Quote Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A tradesperson types a free-text job description, AI (Claude) generates a priced, editable draft quote against a seeded German price list (with 19% VAT), which can be edited inline and then finalized.

**Architecture:** Two new Next.js pages (`/quotes/new`, `/quotes/[id]`) backed by Server Actions that call the Anthropic API (tool-use for structured output), a pure pricing-math module, and two new Supabase tables (`quotes`, `quote_line_items`) plus a seeded read-only `price_list_items` table. No auth yet — RLS enabled with open policies.

**Tech Stack:** Next.js (App Router, Server Actions) · TypeScript · `@anthropic-ai/sdk` · Supabase (Postgres/RLS) · Vitest (unit tests)

---

## File Structure

Created by this plan:
- `lib/quotes/types.ts` — shared `LineItem`/`PricedLineItem`/`QuoteTotals` types
- `lib/quotes/pricing.ts` + `lib/quotes/pricing.test.ts` — pure pricing math (VAT, totals)
- `lib/quotes/generateLineItems.ts` + `lib/quotes/generateLineItems.test.ts` — Claude tool-use call + response parsing/validation
- `app/quotes/new/page.tsx` — job description form
- `app/quotes/new/actions.ts` — `generateQuoteDraft` Server Action
- `app/quotes/[id]/page.tsx` — server component fetching a quote + its line items
- `app/quotes/[id]/QuoteEditor.tsx` — client component: editable line-item table, finalize button
- `app/quotes/[id]/actions.ts` — `updateLineItem`, `finalizeQuote` Server Actions
- `supabase/migrations/0002_quotes.sql` — `price_list_items`, `quotes`, `quote_line_items` tables + seed data
- `vitest.config.ts` — test runner config

Modified:
- `package.json` — add `@anthropic-ai/sdk`, `vitest`, a `test` script
- `.env.example` — add `ANTHROPIC_API_KEY`
- `.github/workflows/ci.yml` — run `npm test` in the quality job

---

## Task 1: Add dependencies and configure the test runner

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install dependencies**

Run: `cd /Users/eyass/Documents/hantverkare && npm install @anthropic-ai/sdk && npm install -D vitest`
Expected: both added to `package.json` (`dependencies` and `devDependencies` respectively).

- [ ] **Step 2: Add the test script**

In `package.json`, add to `"scripts"`:
```json
"test": "vitest run"
```

- [ ] **Step 3: Create `vitest.config.ts`**

Create `vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
});
```

- [ ] **Step 4: Verify the test runner works with no tests yet**

Run: `npm test`
Expected: "No test files found" (exit code 1 is fine here — no test files exist yet; this just confirms vitest itself runs).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add @anthropic-ai/sdk and vitest"
```

---

## Task 2: Database schema — quotes, line items, seeded price list

**Files:**
- Create: `supabase/migrations/0002_quotes.sql`

This touches `supabase/migrations/` — per `.harness/RISK-TIERS.md` this is **T3**. Flag it clearly in the PR and stop for explicit human approval before merging (do not auto-merge).

- [ ] **Step 1: Create the migration**

Create `supabase/migrations/0002_quotes.sql`:
```sql
-- Read-only (from the app's perspective) seeded price list a tradesperson's
-- quotes are generated against.
create table if not exists public.price_list_items (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  unit text not null,
  unit_price_cents integer not null,
  category text not null
);

alter table public.price_list_items enable row level security;

create policy "Price list items are viewable by everyone"
  on public.price_list_items for select
  using (true);

-- No auth yet in this prototype: quotes are not scoped to a user. Policies are
-- intentionally open — revisit once quotes are tied to a real account.
create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  customer_description text not null,
  status text not null default 'draft' check (status in ('draft', 'final')),
  subtotal_cents integer not null default 0,
  vat_cents integer not null default 0,
  total_cents integer not null default 0,
  created_at timestamptz not null default now(),
  finalized_at timestamptz
);

alter table public.quotes enable row level security;

create policy "Quotes are viewable by everyone"
  on public.quotes for select
  using (true);

create policy "Anyone can insert quotes"
  on public.quotes for insert
  with check (true);

create policy "Anyone can update quotes"
  on public.quotes for update
  using (true)
  with check (true);

create table if not exists public.quote_line_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references public.quotes(id) on delete cascade,
  description text not null,
  quantity numeric not null check (quantity > 0),
  unit text not null,
  unit_price_cents integer not null check (unit_price_cents > 0),
  line_total_cents integer not null,
  position integer not null
);

alter table public.quote_line_items enable row level security;

create policy "Line items are viewable by everyone"
  on public.quote_line_items for select
  using (true);

create policy "Anyone can insert line items"
  on public.quote_line_items for insert
  with check (true);

create policy "Anyone can update line items"
  on public.quote_line_items for update
  using (true)
  with check (true);

-- Seed a sample German Handwerker (Sanitär/Elektro-focused) price list, giving
-- the AI real pricing context to match job descriptions against.
insert into public.price_list_items (label, unit, unit_price_cents, category) values
  ('Sanitärinstallation, Arbeitsstunde', 'Stunde', 6500, 'Sanitär'),
  ('Wasserhahn montieren', 'Stück', 4500, 'Sanitär'),
  ('Spüle austauschen', 'Stück', 8000, 'Sanitär'),
  ('Rohrverlegung, Meter', 'Meter', 3200, 'Sanitär'),
  ('Abfluss reinigen', 'Stück', 5500, 'Sanitär'),
  ('Elektroinstallation, Arbeitsstunde', 'Stunde', 7000, 'Elektro'),
  ('Steckdose installieren', 'Stück', 4000, 'Elektro'),
  ('Anfahrtspauschale', 'Pauschale', 3500, 'Allgemein');
```

- [ ] **Step 2: Apply the migration**

Ask the human to run this SQL in the Supabase SQL editor for the linked project (same process as `0001_init.sql`).
Verify: `price_list_items`, `quotes`, and `quote_line_items` tables exist in Supabase → Table Editor, `price_list_items` has 8 seeded rows, and all three tables show RLS enabled.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0002_quotes.sql
git commit -m "feat: add quotes, quote_line_items, price_list_items schema + seed data"
```

---

## Task 3: Pricing math module (TDD)

**Files:**
- Create: `lib/quotes/types.ts`
- Create: `lib/quotes/pricing.ts`
- Test: `lib/quotes/pricing.test.ts`

- [ ] **Step 1: Create the shared types**

Create `lib/quotes/types.ts`:
```ts
export type LineItem = {
  description: string;
  quantity: number;
  unit: string;
  unitPriceCents: number;
};

export type PricedLineItem = LineItem & {
  lineTotalCents: number;
};

export type QuoteTotals = {
  subtotalCents: number;
  vatCents: number;
  totalCents: number;
};
```

- [ ] **Step 2: Write the failing test**

Create `lib/quotes/pricing.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { priceLineItem, computeTotals } from "./pricing";

describe("priceLineItem", () => {
  it("multiplies quantity by unit price", () => {
    const result = priceLineItem({
      description: "Wasserhahn montieren",
      quantity: 2,
      unit: "Stunde",
      unitPriceCents: 5000,
    });
    expect(result.lineTotalCents).toBe(10000);
  });

  it("rounds fractional cents to the nearest integer", () => {
    const result = priceLineItem({
      description: "Rohrverlegung",
      quantity: 1.5,
      unit: "Meter",
      unitPriceCents: 3333,
    });
    expect(result.lineTotalCents).toBe(5000); // 1.5 * 3333 = 4999.5 -> 5000
  });
});

describe("computeTotals", () => {
  it("computes subtotal, 19% VAT, and total across line items", () => {
    const items = [
      priceLineItem({ description: "A", quantity: 1, unit: "Stück", unitPriceCents: 10000 }),
      priceLineItem({ description: "B", quantity: 2, unit: "Stunde", unitPriceCents: 5000 }),
    ];
    const totals = computeTotals(items);
    expect(totals.subtotalCents).toBe(20000); // 10000 + (2 * 5000)
    expect(totals.vatCents).toBe(3800); // 19% of 20000
    expect(totals.totalCents).toBe(23800);
  });

  it("returns zeros for an empty list", () => {
    const totals = computeTotals([]);
    expect(totals).toEqual({ subtotalCents: 0, vatCents: 0, totalCents: 0 });
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- pricing`
Expected: FAIL — `Cannot find module './pricing'` (the module doesn't exist yet).

- [ ] **Step 4: Implement the pricing module**

Create `lib/quotes/pricing.ts`:
```ts
import type { LineItem, PricedLineItem, QuoteTotals } from "./types";

const VAT_RATE = 0.19;

export function priceLineItem(item: LineItem): PricedLineItem {
  return {
    ...item,
    lineTotalCents: Math.round(item.quantity * item.unitPriceCents),
  };
}

export function computeTotals(items: PricedLineItem[]): QuoteTotals {
  const subtotalCents = items.reduce((sum, item) => sum + item.lineTotalCents, 0);
  const vatCents = Math.round(subtotalCents * VAT_RATE);
  const totalCents = subtotalCents + vatCents;
  return { subtotalCents, vatCents, totalCents };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- pricing`
Expected: PASS, 4 tests passing.

- [ ] **Step 6: Commit**

```bash
git add lib/quotes/types.ts lib/quotes/pricing.ts lib/quotes/pricing.test.ts
git commit -m "feat: add pure pricing math module (VAT, totals)"
```

---

## Task 4: Claude quote generation module (TDD on the parsing/validation path)

**Files:**
- Create: `lib/quotes/generateLineItems.ts`
- Test: `lib/quotes/generateLineItems.test.ts`

Only the parse/validation logic is unit tested here (deterministic, no network call). The actual Anthropic API call is exercised in Task 8's manual QA.

- [ ] **Step 1: Write the failing test**

Create `lib/quotes/generateLineItems.test.ts`:
```ts
import { describe, it, expect } from "vitest";
import { parseLineItemsToolInput, QuoteGenerationError } from "./generateLineItems";

describe("parseLineItemsToolInput", () => {
  it("parses a well-formed tool input into line items", () => {
    const input = {
      lineItems: [
        { description: "Spüle austauschen", quantity: 1, unit: "Stück", unitPriceCents: 8000 },
        { description: "Sanitärinstallation", quantity: 2, unit: "Stunde", unitPriceCents: 6500 },
      ],
    };
    const result = parseLineItemsToolInput(input);
    expect(result).toEqual(input.lineItems);
  });

  it("throws when lineItems is missing", () => {
    expect(() => parseLineItemsToolInput({})).toThrow(QuoteGenerationError);
  });

  it("throws when lineItems is empty", () => {
    expect(() => parseLineItemsToolInput({ lineItems: [] })).toThrow(QuoteGenerationError);
  });

  it("throws when a line item is missing a required field", () => {
    const input = { lineItems: [{ description: "Test", quantity: 1, unit: "Stück" }] };
    expect(() => parseLineItemsToolInput(input)).toThrow(QuoteGenerationError);
  });

  it("throws when quantity is zero or negative", () => {
    const input = {
      lineItems: [{ description: "Test", quantity: 0, unit: "Stück", unitPriceCents: 1000 }],
    };
    expect(() => parseLineItemsToolInput(input)).toThrow(QuoteGenerationError);
  });

  it("throws when unitPriceCents is zero or negative", () => {
    const input = {
      lineItems: [{ description: "Test", quantity: 1, unit: "Stück", unitPriceCents: 0 }],
    };
    expect(() => parseLineItemsToolInput(input)).toThrow(QuoteGenerationError);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npm test -- generateLineItems`
Expected: FAIL — `Cannot find module './generateLineItems'`.

- [ ] **Step 3: Implement the module**

Create `lib/quotes/generateLineItems.ts`:
```ts
import Anthropic from "@anthropic-ai/sdk";
import type { LineItem } from "./types";

export class QuoteGenerationError extends Error {}

export type PriceListItem = {
  label: string;
  unit: string;
  unitPriceCents: number;
  category: string;
};

const LINE_ITEMS_TOOL = {
  name: "submit_line_items",
  description:
    "Submit the structured list of quote line items extracted from the job description.",
  input_schema: {
    type: "object" as const,
    properties: {
      lineItems: {
        type: "array" as const,
        items: {
          type: "object" as const,
          properties: {
            description: { type: "string" as const },
            quantity: { type: "number" as const },
            unit: { type: "string" as const },
            unitPriceCents: { type: "integer" as const },
          },
          required: ["description", "quantity", "unit", "unitPriceCents"],
        },
      },
    },
    required: ["lineItems"],
  },
};

export function parseLineItemsToolInput(input: unknown): LineItem[] {
  if (
    typeof input !== "object" ||
    input === null ||
    !("lineItems" in input) ||
    !Array.isArray((input as { lineItems: unknown }).lineItems)
  ) {
    throw new QuoteGenerationError("Malformed tool input: missing lineItems array");
  }

  const rawItems = (input as { lineItems: unknown[] }).lineItems;
  if (rawItems.length === 0) {
    throw new QuoteGenerationError("AI returned zero line items");
  }

  return rawItems.map((raw, index) => {
    if (
      typeof raw !== "object" ||
      raw === null ||
      typeof (raw as Record<string, unknown>).description !== "string" ||
      typeof (raw as Record<string, unknown>).quantity !== "number" ||
      typeof (raw as Record<string, unknown>).unit !== "string" ||
      typeof (raw as Record<string, unknown>).unitPriceCents !== "number"
    ) {
      throw new QuoteGenerationError(`Malformed line item at index ${index}`);
    }

    const item = raw as LineItem;
    if (item.quantity <= 0 || item.unitPriceCents <= 0) {
      throw new QuoteGenerationError(`Invalid quantity or price at index ${index}`);
    }
    return item;
  });
}

function buildPrompt(description: string, priceList: PriceListItem[]): string {
  const priceListText = priceList
    .map(
      (p) =>
        `- ${p.label} (${p.category}): ${(p.unitPriceCents / 100).toFixed(2)} EUR / ${p.unit}`,
    )
    .join("\n");

  return `You are pricing a job for a German Handwerker (tradesperson) using their price list below. Given the job description, produce a list of line items with realistic quantities and unit prices drawn from the price list (or a reasonable estimate if nothing matches). All prices are in EUR cents.

Price list:
${priceListText}

Job description:
${description}`;
}

export async function generateLineItems(
  description: string,
  priceList: PriceListItem[],
): Promise<LineItem[]> {
  const anthropic = new Anthropic();

  let response;
  try {
    response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 2048,
      tools: [LINE_ITEMS_TOOL],
      tool_choice: { type: "tool", name: "submit_line_items" },
      messages: [{ role: "user", content: buildPrompt(description, priceList) }],
    });
  } catch (err) {
    throw new QuoteGenerationError(`Anthropic API call failed: ${(err as Error).message}`);
  }

  const toolUse = response.content.find((block) => block.type === "tool_use");
  if (!toolUse || toolUse.type !== "tool_use") {
    throw new QuoteGenerationError("AI response did not include tool use");
  }

  return parseLineItemsToolInput(toolUse.input);
}
```

Note: `new Anthropic()` is called inside the function body, not at module scope, so importing this module (as the test does) never constructs a client or requires `ANTHROPIC_API_KEY` to be set.

- [ ] **Step 4: Run the test to verify it passes**

Run: `npm test -- generateLineItems`
Expected: PASS, 6 tests passing.

- [ ] **Step 5: Commit**

```bash
git add lib/quotes/generateLineItems.ts lib/quotes/generateLineItems.test.ts
git commit -m "feat: add Claude tool-use quote generation + response validation"
```

---

## Task 5: `.env.example` + CI wiring for the Anthropic key

**Files:**
- Modify: `.env.example`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Add the env var**

In `.env.example`, append:
```
# Anthropic — from https://console.anthropic.com/settings/keys
ANTHROPIC_API_KEY=
```

- [ ] **Step 2: Add a dummy value to CI and run tests there**

In `.github/workflows/ci.yml`, under the `quality` job's `env:` block, add `ANTHROPIC_API_KEY: dummy-key-for-ci` alongside the existing Supabase dummy values, and add `- run: npm test` after the existing `- run: npm run build` step:

```yaml
  quality:
    name: Lint · Typecheck · Build
    runs-on: ubuntu-latest
    env:
      NEXT_PUBLIC_SUPABASE_URL: https://example.supabase.co
      NEXT_PUBLIC_SUPABASE_ANON_KEY: dummy-anon-key-for-ci-build
      ANTHROPIC_API_KEY: dummy-key-for-ci
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm run build
      - run: npm test
```

- [ ] **Step 3: Verify locally**

Run: `npm test`
Expected: PASS, all 10 tests (4 from pricing + 6 from generateLineItems) passing.

- [ ] **Step 4: Commit**

```bash
git add .env.example .github/workflows/ci.yml
git commit -m "ci: run unit tests, document ANTHROPIC_API_KEY"
```

---

## Task 6: `/quotes/new` — job description form + generation action

**Files:**
- Create: `app/quotes/new/actions.ts`
- Create: `app/quotes/new/page.tsx`

- [ ] **Step 1: Create the Server Action**

Create `app/quotes/new/actions.ts`:
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

  const supabase = await createClient();
  const { data: priceList, error: priceListError } = await supabase
    .from("price_list_items")
    .select("label, unit, unit_price_cents, category");
  if (priceListError || !priceList) {
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
    return { error: "Positionen konnten nicht gespeichert werden." };
  }

  redirect(`/quotes/${quote.id}`);
}
```

- [ ] **Step 2: Create the form page**

Create `app/quotes/new/page.tsx`:
```tsx
"use client";

import { useActionState } from "react";
import { generateQuoteDraft, type GenerateQuoteState } from "./actions";

const initialState: GenerateQuoteState = { error: null };

export default function NewQuotePage() {
  const [state, formAction, isPending] = useActionState(generateQuoteDraft, initialState);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">Neues Angebot</h1>
      <form action={formAction} className="flex flex-col gap-4">
        <textarea
          name="description"
          required
          rows={6}
          placeholder="Beschreibe den Auftrag, z. B. Küchenspüle austauschen, neuen Wasserhahn montieren, 2 Stunden Arbeit"
          className="w-full rounded-md border border-zinc-300 p-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          type="submit"
          disabled={isPending}
          className="self-start rounded-full bg-foreground px-5 py-3 text-background disabled:opacity-50"
        >
          {isPending ? "Angebot wird erstellt…" : "Angebot erstellen"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Verify the build passes**

Run: `npm run build`
Expected: "Compiled successfully", exit code 0.

- [ ] **Step 4: Commit**

```bash
git add app/quotes/new
git commit -m "feat: add /quotes/new job description form + generation action"
```

---

## Task 7: `/quotes/[id]` — editable quote view + finalize

**Files:**
- Create: `app/quotes/[id]/actions.ts`
- Create: `app/quotes/[id]/QuoteEditor.tsx`
- Create: `app/quotes/[id]/page.tsx`

- [ ] **Step 1: Create the Server Actions**

Create `app/quotes/[id]/actions.ts`:
```ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { priceLineItem, computeTotals } from "@/lib/quotes/pricing";

type UpdateLineItemInput = {
  description: string;
  quantity: number;
  unit: string;
  unitPriceCents: number;
};

type LineItemRow = {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price_cents: number;
  line_total_cents: number;
  position: number;
};

type UpdateLineItemResult =
  | { error: string; lineItems?: never; totals?: never }
  | {
      error: null;
      lineItems: LineItemRow[];
      totals: { subtotalCents: number; vatCents: number; totalCents: number };
    };

export async function updateLineItem(
  quoteId: string,
  lineItemId: string,
  input: UpdateLineItemInput,
): Promise<UpdateLineItemResult> {
  if (input.quantity <= 0 || input.unitPriceCents <= 0) {
    return { error: "Menge und Preis müssen größer als 0 sein." };
  }

  const supabase = await createClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select("status")
    .eq("id", quoteId)
    .single();
  if (!quote || quote.status !== "draft") {
    return { error: "Angebot ist bereits final und kann nicht mehr bearbeitet werden." };
  }

  const priced = priceLineItem({
    description: input.description,
    quantity: input.quantity,
    unit: input.unit,
    unitPriceCents: input.unitPriceCents,
  });

  const { error: updateError } = await supabase
    .from("quote_line_items")
    .update({
      description: priced.description,
      quantity: priced.quantity,
      unit: priced.unit,
      unit_price_cents: priced.unitPriceCents,
      line_total_cents: priced.lineTotalCents,
    })
    .eq("id", lineItemId)
    .eq("quote_id", quoteId);
  if (updateError) {
    return { error: "Position konnte nicht gespeichert werden." };
  }

  const { data: allItems, error: fetchError } = await supabase
    .from("quote_line_items")
    .select("id, description, quantity, unit, unit_price_cents, line_total_cents, position")
    .eq("quote_id", quoteId)
    .order("position");
  if (fetchError || !allItems) {
    return { error: "Positionen konnten nicht geladen werden." };
  }

  const totals = computeTotals(
    allItems.map((item) => ({
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unitPriceCents: item.unit_price_cents,
      lineTotalCents: item.line_total_cents,
    })),
  );

  const { error: totalsError } = await supabase
    .from("quotes")
    .update({
      subtotal_cents: totals.subtotalCents,
      vat_cents: totals.vatCents,
      total_cents: totals.totalCents,
    })
    .eq("id", quoteId);
  if (totalsError) {
    return { error: "Summen konnten nicht aktualisiert werden." };
  }

  return { error: null, lineItems: allItems, totals };
}

export async function finalizeQuote(quoteId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select("status")
    .eq("id", quoteId)
    .single();
  if (!quote || quote.status !== "draft") {
    return { error: "Angebot ist bereits final." };
  }

  const { error } = await supabase
    .from("quotes")
    .update({ status: "final", finalized_at: new Date().toISOString() })
    .eq("id", quoteId);
  if (error) {
    return { error: "Angebot konnte nicht finalisiert werden." };
  }

  return { error: null };
}
```

- [ ] **Step 2: Create the client editor component**

Create `app/quotes/[id]/QuoteEditor.tsx`:
```tsx
"use client";

import { useState, useTransition } from "react";
import { updateLineItem, finalizeQuote } from "./actions";

type LineItem = {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  unit_price_cents: number;
  line_total_cents: number;
  position: number;
};

type Quote = {
  id: string;
  customer_description: string;
  status: string;
  subtotal_cents: number;
  vat_cents: number;
  total_cents: number;
};

function formatEuros(cents: number): string {
  return (cents / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

export function QuoteEditor({ quote, lineItems }: { quote: Quote; lineItems: LineItem[] }) {
  const [items, setItems] = useState(lineItems);
  const [totals, setTotals] = useState({
    subtotalCents: quote.subtotal_cents,
    vatCents: quote.vat_cents,
    totalCents: quote.total_cents,
  });
  const [status, setStatus] = useState(quote.status);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const isDraft = status === "draft";

  function handleFieldChange(
    itemId: string,
    field: "description" | "quantity" | "unit_price_cents",
    value: string,
  ) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? {
              ...item,
              [field]: field === "quantity" || field === "unit_price_cents" ? Number(value) : value,
            }
          : item,
      ),
    );
  }

  function handleBlurSave(item: LineItem) {
    startTransition(async () => {
      const result = await updateLineItem(quote.id, item.id, {
        description: item.description,
        quantity: item.quantity,
        unit: item.unit,
        unitPriceCents: item.unit_price_cents,
      });
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setItems(result.lineItems);
      setTotals(result.totals);
    });
  }

  function handleFinalize() {
    startTransition(async () => {
      const result = await finalizeQuote(quote.id);
      if (result.error) {
        setError(result.error);
        return;
      }
      setError(null);
      setStatus("final");
    });
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold">Angebot {status === "final" ? "(final)" : "(Entwurf)"}</h1>
      <p className="text-zinc-600 dark:text-zinc-400">{quote.customer_description}</p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <table className="w-full border-collapse text-left text-sm">
        <thead>
          <tr className="border-b border-zinc-300 dark:border-zinc-700">
            <th className="py-2">Beschreibung</th>
            <th className="py-2">Menge</th>
            <th className="py-2">Einheit</th>
            <th className="py-2">Einzelpreis</th>
            <th className="py-2">Gesamt</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id} className="border-b border-zinc-200 dark:border-zinc-800">
              <td className="py-2">
                <input
                  value={item.description}
                  disabled={!isDraft}
                  onChange={(e) => handleFieldChange(item.id, "description", e.target.value)}
                  onBlur={() => handleBlurSave(item)}
                  className="w-full bg-transparent disabled:opacity-70"
                />
              </td>
              <td className="py-2">
                <input
                  type="number"
                  value={item.quantity}
                  disabled={!isDraft}
                  onChange={(e) => handleFieldChange(item.id, "quantity", e.target.value)}
                  onBlur={() => handleBlurSave(item)}
                  className="w-20 bg-transparent disabled:opacity-70"
                />
              </td>
              <td className="py-2">{item.unit}</td>
              <td className="py-2">
                <input
                  type="number"
                  value={item.unit_price_cents / 100}
                  disabled={!isDraft}
                  onChange={(e) =>
                    handleFieldChange(item.id, "unit_price_cents", String(Number(e.target.value) * 100))
                  }
                  onBlur={() => handleBlurSave(item)}
                  className="w-24 bg-transparent disabled:opacity-70"
                />
              </td>
              <td className="py-2">{formatEuros(item.line_total_cents)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-col items-end gap-1 text-sm">
        <p>Zwischensumme: {formatEuros(totals.subtotalCents)}</p>
        <p>MwSt. (19%): {formatEuros(totals.vatCents)}</p>
        <p className="text-base font-semibold">Gesamt: {formatEuros(totals.totalCents)}</p>
      </div>
      {isDraft && (
        <button
          onClick={handleFinalize}
          disabled={isPending}
          className="self-end rounded-full bg-foreground px-5 py-3 text-background disabled:opacity-50"
        >
          Angebot finalisieren
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Create the server page**

Create `app/quotes/[id]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { QuoteEditor } from "./QuoteEditor";

export default async function QuotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: quote } = await supabase
    .from("quotes")
    .select("id, customer_description, status, subtotal_cents, vat_cents, total_cents")
    .eq("id", id)
    .single();
  if (!quote) notFound();

  const { data: lineItems } = await supabase
    .from("quote_line_items")
    .select("id, description, quantity, unit, unit_price_cents, line_total_cents, position")
    .eq("quote_id", id)
    .order("position");

  return <QuoteEditor quote={quote} lineItems={lineItems ?? []} />;
}
```

- [ ] **Step 4: Verify the build passes**

Run: `npm run build`
Expected: "Compiled successfully", exit code 0.

- [ ] **Step 5: Commit**

```bash
git add app/quotes/[id]
git commit -m "feat: add editable quote view with finalize action"
```

---

## Task 8: Manual end-to-end QA

Requires a real `ANTHROPIC_API_KEY` in `.env.local` (ask the human for one if not already present — same pattern as the Supabase service role key).

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: server starts at `http://localhost:3000`.

- [ ] **Step 2: Generate a quote**

Using the browser skill, navigate to `http://localhost:3000/quotes/new`, enter a realistic German job description (e.g. "Küchenspüle austauschen, neuen Wasserhahn montieren, Abfluss reinigen"), submit.
Expected: redirects to `/quotes/<id>` showing an editable draft with 2-4 line items, subtotal, 19% VAT, and total, all in German with EUR formatting.

- [ ] **Step 3: Edit a line item**

Change a quantity or unit price on one row, tab/click away to blur.
Expected: the row's total and the overall subtotal/VAT/total update; no console errors.

- [ ] **Step 4: Finalize**

Click "Angebot finalisieren".
Expected: page switches to read-only ("(final)" label), inputs become disabled, no further edits possible. Reloading the page preserves the final state.

- [ ] **Step 5: Confirm the generation error path**

Temporarily set `ANTHROPIC_API_KEY` in `.env.local` to an invalid value, restart the dev server, submit a new job description at `/quotes/new`.
Expected: an inline German error message is shown, no quote row is created (verify via Supabase Table Editor that no new draft row appeared).
Restore the real `ANTHROPIC_API_KEY` afterward and restart the dev server.
