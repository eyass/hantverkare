# Price List Creation Wizard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user with an empty price list pick a trade and bulk-insert a curated, editable starter set of line items in one action, instead of typing every row by hand.

**Architecture:** Two new global (non-org-scoped) read-only reference tables, `price_list_templates` and `price_list_template_items`, seeded by migration. `PriceListEditor`'s page shows a new `PriceListWizard` component instead of the empty table when the org has zero price list items; the wizard's "Übernehmen" step calls one new server action, `createPriceListItemsFromTemplate`, that re-validates the selection server-side against the DB and bulk-inserts into the existing `price_list_items` table.

**Tech Stack:** Next.js App Router (server components + server actions), Supabase (Postgres/RLS), TypeScript, Vitest.

Design doc: `docs/superpowers/specs/2026-07-22-price-list-wizard-design.md`

---

## File structure

- Create: `supabase/migrations/0011_price_list_templates.sql` — new tables + RLS + seed data
- Create: `lib/priceList/templateSelection.ts` — pure, testable validation logic for turning a client selection into rows to insert
- Create: `lib/priceList/templateSelection.test.ts` — unit tests for the above
- Modify: `app/(app)/price-list/actions.ts` — add `createPriceListItemsFromTemplate` server action
- Create: `app/(app)/price-list/PriceListWizard.tsx` — new client component (trade picker + review checklist)
- Modify: `app/(app)/price-list/page.tsx` — fetch templates and branch to the wizard when items is empty

---

### Task 1: Migration — template tables + seed data

**Files:**
- Create: `supabase/migrations/0011_price_list_templates.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- Price list creation wizard: curated starter templates per trade.
-- These are GLOBAL reference tables (not organization_id-scoped) -- every
-- user reads the same catalog. Read-only from the app: no insert/update/
-- delete policy for any client role. Edit templates by running SQL directly
-- in the Supabase SQL editor.

create table public.price_list_templates (
  id uuid primary key default gen_random_uuid(),
  trade_key text not null unique,
  trade_label text not null,
  sort_order integer not null default 0
);
alter table public.price_list_templates enable row level security;

create policy "Authenticated users can view price list templates"
  on public.price_list_templates for select
  to authenticated using (true);

create table public.price_list_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.price_list_templates(id) on delete cascade,
  label text not null,
  unit text not null,
  default_unit_price_cents integer not null,
  category text not null,
  sort_order integer not null default 0
);
alter table public.price_list_template_items enable row level security;

create policy "Authenticated users can view price list template items"
  on public.price_list_template_items for select
  to authenticated using (true);

-- Seed data. Prices are starting estimates sourced from public German trade
-- price guides (2026) -- sanity-check against your own market before relying
-- on them; they are not verified quotes.

insert into public.price_list_templates (trade_key, trade_label, sort_order) values
  ('maler', 'Maler', 1),
  ('elektriker', 'Elektriker', 2),
  ('sanitaer_heizung', 'Sanitär & Heizung', 3),
  ('bodenleger', 'Bodenleger', 4);

insert into public.price_list_template_items (template_id, label, unit, default_unit_price_cents, category, sort_order)
select t.id, item.label, item.unit, item.price_cents, item.category, item.sort_order
from public.price_list_templates t
join (
  values
    ('maler', 'Wände streichen (Innenraum)', 'm²', 1200, 'Malerarbeiten', 1),
    ('maler', 'Decke streichen', 'm²', 1400, 'Malerarbeiten', 2),
    ('maler', 'Tapezieren', 'm²', 1600, 'Malerarbeiten', 3),
    ('maler', 'Untergrund spachteln', 'm²', 900, 'Malerarbeiten', 4),
    ('maler', 'Fenster/Türen lackieren', 'Stück', 8500, 'Malerarbeiten', 5),
    ('maler', 'Anfahrt', 'Pauschale', 4500, 'Sonstiges', 6),
    ('maler', 'Abdeckarbeiten', 'Pauschale', 6000, 'Sonstiges', 7),
    ('elektriker', 'Steckdose setzen/tauschen', 'Stück', 4500, 'Elektroinstallation', 1),
    ('elektriker', 'Lichtschalter setzen/tauschen', 'Stück', 4000, 'Elektroinstallation', 2),
    ('elektriker', 'Deckenleuchte anschließen', 'Stück', 6500, 'Elektroinstallation', 3),
    ('elektriker', 'Sicherungskasten prüfen/warten', 'Pauschale', 12000, 'Elektroinstallation', 4),
    ('elektriker', 'Kabel verlegen (Unterputz)', 'm', 1800, 'Elektroinstallation', 5),
    ('elektriker', 'Std. Arbeitszeit', 'Std.', 7500, 'Arbeitszeit', 6),
    ('elektriker', 'Anfahrt', 'Pauschale', 4500, 'Sonstiges', 7),
    ('sanitaer_heizung', 'Wasserhahn tauschen', 'Stück', 9500, 'Sanitär', 1),
    ('sanitaer_heizung', 'WC tauschen', 'Stück', 35000, 'Sanitär', 2),
    ('sanitaer_heizung', 'Heizkörper entlüften', 'Stück', 3500, 'Heizung', 3),
    ('sanitaer_heizung', 'Rohrleitung erneuern', 'm', 4500, 'Sanitär', 4),
    ('sanitaer_heizung', 'Heizungswartung', 'Pauschale', 15000, 'Heizung', 5),
    ('sanitaer_heizung', 'Std. Arbeitszeit', 'Std.', 8000, 'Arbeitszeit', 6),
    ('sanitaer_heizung', 'Anfahrt', 'Pauschale', 4500, 'Sonstiges', 7),
    ('bodenleger', 'Laminat verlegen', 'm²', 2500, 'Bodenbelagsarbeiten', 1),
    ('bodenleger', 'Vinylboden verlegen', 'm²', 2800, 'Bodenbelagsarbeiten', 2),
    ('bodenleger', 'Alten Belag entfernen', 'm²', 900, 'Bodenbelagsarbeiten', 3),
    ('bodenleger', 'Untergrund ausgleichen', 'm²', 1100, 'Bodenbelagsarbeiten', 4),
    ('bodenleger', 'Sockelleisten montieren', 'm', 700, 'Bodenbelagsarbeiten', 5),
    ('bodenleger', 'Anfahrt', 'Pauschale', 4500, 'Sonstiges', 6)
) as item(trade_key, label, unit, price_cents, category, sort_order)
  on item.trade_key = t.trade_key;
```

- [ ] **Step 2: Verify RLS is read-only for authenticated users**

Run this against your local/dev Supabase (SQL editor or `psql`), as an
authenticated (non-service-role) session:

```sql
select trade_key, trade_label from public.price_list_templates order by sort_order;
-- expect: 4 rows returned

insert into public.price_list_templates (trade_key, trade_label) values ('test', 'Test');
-- expect: error (new row violates row-level security policy) -- no insert policy exists
```

Expected: the `select` returns 4 rows; the `insert` fails with an RLS policy
violation error. This confirms the catalog is read-only from any client role.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0011_price_list_templates.sql
git commit -m "feat: add price list template tables and seed data"
```

---

### Task 2: Pure validation logic for template selections

**Files:**
- Create: `lib/priceList/templateSelection.ts`
- Test: `lib/priceList/templateSelection.test.ts`

This isolates the "did the client send us something valid" logic from the
server action, so it can be unit tested without mocking Supabase — same
pattern as `lib/organizations/permissions.ts`.

- [ ] **Step 1: Write the failing test**

Create `lib/priceList/templateSelection.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { buildRowsToInsert, type TemplateItemRow, type Selection } from "./templateSelection";

const templateItems: TemplateItemRow[] = [
  { id: "item-1", template_id: "tpl-1", label: "Wände streichen", unit: "m²", category: "Malerarbeiten" },
  { id: "item-2", template_id: "tpl-1", label: "Decke streichen", unit: "m²", category: "Malerarbeiten" },
  { id: "item-3", template_id: "tpl-2", label: "Steckdose setzen", unit: "Stück", category: "Elektroinstallation" },
];

describe("buildRowsToInsert", () => {
  it("builds rows for a valid selection from the given template", () => {
    const selections: Selection[] = [
      { templateItemId: "item-1", unitPriceCents: 1200 },
      { templateItemId: "item-2", unitPriceCents: 1400 },
    ];
    const result = buildRowsToInsert("tpl-1", templateItems, selections);
    expect(result.error).toBeNull();
    expect(result.rows).toEqual([
      { label: "Wände streichen", unit: "m²", unit_price_cents: 1200, category: "Malerarbeiten" },
      { label: "Decke streichen", unit: "m²", unit_price_cents: 1400, category: "Malerarbeiten" },
    ]);
  });

  it("rejects a templateItemId that does not belong to the given template", () => {
    const selections: Selection[] = [{ templateItemId: "item-3", unitPriceCents: 4500 }];
    const result = buildRowsToInsert("tpl-1", templateItems, selections);
    expect(result.error).not.toBeNull();
    expect(result.rows).toBeUndefined();
  });

  it("rejects a templateItemId that does not exist at all", () => {
    const selections: Selection[] = [{ templateItemId: "does-not-exist", unitPriceCents: 4500 }];
    const result = buildRowsToInsert("tpl-1", templateItems, selections);
    expect(result.error).not.toBeNull();
  });

  it("rejects a non-positive edited price", () => {
    const selections: Selection[] = [{ templateItemId: "item-1", unitPriceCents: 0 }];
    const result = buildRowsToInsert("tpl-1", templateItems, selections);
    expect(result.error).not.toBeNull();
  });

  it("rejects a non-integer edited price", () => {
    const selections: Selection[] = [{ templateItemId: "item-1", unitPriceCents: 12.5 }];
    const result = buildRowsToInsert("tpl-1", templateItems, selections);
    expect(result.error).not.toBeNull();
  });

  it("returns an empty row list for an empty selection (no-op)", () => {
    const result = buildRowsToInsert("tpl-1", templateItems, []);
    expect(result.error).toBeNull();
    expect(result.rows).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run lib/priceList/templateSelection.test.ts`
Expected: FAIL — `Cannot find module './templateSelection'`

- [ ] **Step 3: Write the implementation**

Create `lib/priceList/templateSelection.ts`:

```ts
export type TemplateItemRow = {
  id: string;
  template_id: string;
  label: string;
  unit: string;
  category: string;
};

export type Selection = {
  templateItemId: string;
  unitPriceCents: number;
};

export type PriceListItemRowToInsert = {
  label: string;
  unit: string;
  unit_price_cents: number;
  category: string;
};

type BuildResult =
  | { error: null; rows: PriceListItemRowToInsert[] }
  | { error: string; rows?: never };

/**
 * Turns a client-supplied template selection into rows ready to insert into
 * price_list_items. Only the templateItemId and the (user-editable) price
 * come from the client -- label/unit/category are always re-read from the
 * server-trusted templateItems array, never from client input.
 */
export function buildRowsToInsert(
  templateId: string,
  templateItems: TemplateItemRow[],
  selections: Selection[],
): BuildResult {
  const rows: PriceListItemRowToInsert[] = [];

  for (const selection of selections) {
    const item = templateItems.find((candidate) => candidate.id === selection.templateItemId);
    if (!item || item.template_id !== templateId) {
      return { error: "Ungültige Auswahl." };
    }
    if (!Number.isInteger(selection.unitPriceCents) || selection.unitPriceCents <= 0) {
      return { error: "Preis muss größer als 0 sein." };
    }
    rows.push({
      label: item.label,
      unit: item.unit,
      unit_price_cents: selection.unitPriceCents,
      category: item.category,
    });
  }

  return { error: null, rows };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run lib/priceList/templateSelection.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/priceList/templateSelection.ts lib/priceList/templateSelection.test.ts
git commit -m "feat: add pure validation for price list template selections"
```

---

### Task 3: Server action to bulk-insert from a template

**Files:**
- Modify: `app/(app)/price-list/actions.ts`

- [ ] **Step 1: Add the new action**

Append to `app/(app)/price-list/actions.ts` (keep all existing exports
unchanged):

```ts
import { buildRowsToInsert, type Selection } from "@/lib/priceList/templateSelection";

export async function createPriceListItemsFromTemplate(
  templateId: string,
  selections: Selection[],
): Promise<{ error: string | null }> {
  if (selections.length === 0) {
    return { error: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Bitte melde dich an." };
  }

  const org = await getCurrentOrg(supabase);
  if (!org) {
    return { error: "Keine Organisation gefunden." };
  }

  const { data: templateItems, error: fetchError } = await supabase
    .from("price_list_template_items")
    .select("id, template_id, label, unit, category")
    .eq("template_id", templateId);
  if (fetchError || !templateItems) {
    console.error("Failed to load price list template items:", fetchError);
    return { error: "Vorlage konnte nicht geladen werden." };
  }

  const result = buildRowsToInsert(templateId, templateItems, selections);
  if (result.error !== null) {
    return { error: result.error };
  }

  const rowsWithOwner = result.rows.map((row) => ({
    ...row,
    organization_id: org.organizationId,
    user_id: user.id,
  }));

  const { error: insertError } = await supabase.from("price_list_items").insert(rowsWithOwner);
  if (insertError) {
    console.error("Failed to bulk-insert price list items from template:", insertError);
    return { error: "Positionen konnten nicht angelegt werden." };
  }

  return { error: null };
}
```

Note: `createClient` and `getCurrentOrg` are already imported at the top of
this file (used by the existing actions) — no new imports needed for those.

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add app/\(app\)/price-list/actions.ts
git commit -m "feat: add server action to bulk-insert price list items from a template"
```

---

### Task 4: Fetch templates and branch to the wizard on the page

**Files:**
- Modify: `app/(app)/price-list/page.tsx`

- [ ] **Step 1: Rewrite the page**

Replace the full contents of `app/(app)/price-list/page.tsx`:

```tsx
import { createClient } from "@/lib/supabase/server";
import { PriceListEditor } from "./PriceListEditor";
import { PriceListWizard, type TemplateWithItems } from "./PriceListWizard";

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

  if ((items ?? []).length > 0) {
    return <PriceListEditor items={items ?? []} />;
  }

  const { data: templates, error: templatesError } = await supabase
    .from("price_list_templates")
    .select(
      "id, trade_key, trade_label, sort_order, price_list_template_items(id, label, unit, default_unit_price_cents, category, sort_order)",
    )
    .order("sort_order")
    .order("sort_order", { referencedTable: "price_list_template_items" });

  if (templatesError) {
    console.error("Failed to load price list templates:", templatesError);
  }

  const normalizedTemplates: TemplateWithItems[] = (templates ?? []).map((template) => ({
    id: template.id,
    tradeKey: template.trade_key,
    tradeLabel: template.trade_label,
    items: template.price_list_template_items.map((item) => ({
      id: item.id,
      label: item.label,
      unit: item.unit,
      defaultUnitPriceCents: item.default_unit_price_cents,
      category: item.category,
    })),
  }));

  return <PriceListWizard templates={normalizedTemplates} />;
}
```

- [ ] **Step 2: Typecheck (expect a failure — PriceListWizard doesn't exist yet)**

Run: `npm run typecheck`
Expected: FAIL — `Cannot find module './PriceListWizard'`. This is expected;
Task 5 creates it. Do not commit yet.

---

### Task 5: The wizard component

**Files:**
- Create: `app/(app)/price-list/PriceListWizard.tsx`

- [ ] **Step 1: Write the component**

```tsx
"use client";

import { useState, useTransition } from "react";
import { PriceListEditor } from "./PriceListEditor";
import { createPriceListItemsFromTemplate } from "./actions";

export type TemplateItem = {
  id: string;
  label: string;
  unit: string;
  defaultUnitPriceCents: number;
  category: string;
};

export type TemplateWithItems = {
  id: string;
  tradeKey: string;
  tradeLabel: string;
  items: TemplateItem[];
};

function centsToEuroString(cents: number): string {
  return (cents / 100).toFixed(2);
}

const inputClass =
  "w-24 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-sm text-[#0f172a] outline-none transition-colors focus:border-[#e9edf2] focus:bg-[#f4f6f8]";

export function PriceListWizard({ templates }: { templates: TemplateWithItems[] }) {
  const [step, setStep] = useState<"pick" | "review" | "blank">("pick");
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateWithItems | null>(null);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);
  const [isPending, startTransition] = useTransition();

  function pickTemplate(template: TemplateWithItems) {
    setSelectedTemplate(template);
    setChecked(Object.fromEntries(template.items.map((item) => [item.id, true])));
    setPrices(Object.fromEntries(template.items.map((item) => [item.id, item.defaultUnitPriceCents])));
    setStep("review");
  }

  function handleApply() {
    if (!selectedTemplate) return;
    const selections = selectedTemplate.items
      .filter((item) => checked[item.id])
      .map((item) => ({ templateItemId: item.id, unitPriceCents: prices[item.id] }));

    startTransition(async () => {
      const result = await createPriceListItemsFromTemplate(selectedTemplate.id, selections);
      if (result.error !== null) {
        setError(result.error);
        return;
      }
      setError(null);
      setApplied(true);
    });
  }

  if (step === "blank" || applied) {
    return <PriceListEditor items={[]} />;
  }

  if (step === "review" && selectedTemplate) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
        <h1 className="text-2xl font-semibold text-[#0f172a]">{selectedTemplate.tradeLabel}</h1>
        {error && <p className="text-sm text-[#dc2626]">{error}</p>}
        <div className="overflow-hidden rounded-2xl border border-[#e9edf2] bg-white">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#e9edf2] text-xs font-medium uppercase tracking-wide text-[#94a3b8]">
                <th className="px-4 py-3"></th>
                <th className="px-4 py-3">Bezeichnung</th>
                <th className="px-4 py-3">Einheit</th>
                <th className="px-4 py-3">Preis (EUR)</th>
              </tr>
            </thead>
            <tbody>
              {selectedTemplate.items.map((item) => (
                <tr key={item.id} className="border-b border-[#e9edf2] last:border-b-0">
                  <td className="px-4 py-2">
                    <input
                      type="checkbox"
                      checked={checked[item.id] ?? false}
                      onChange={(e) =>
                        setChecked((prev) => ({ ...prev, [item.id]: e.target.checked }))
                      }
                    />
                  </td>
                  <td className="px-4 py-2">{item.label}</td>
                  <td className="px-4 py-2">{item.unit}</td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      value={centsToEuroString(prices[item.id] ?? item.defaultUnitPriceCents)}
                      onChange={(e) =>
                        setPrices((prev) => ({
                          ...prev,
                          [item.id]: Math.round(Number(e.target.value) * 100),
                        }))
                      }
                      className={`font-mono ${inputClass}`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setStep("pick")}
            className="rounded-full border border-[#e9edf2] px-5 py-2.5 text-sm font-medium text-[#0f172a]"
          >
            Zurück
          </button>
          <button
            onClick={handleApply}
            disabled={isPending}
            className="rounded-full bg-[#2563eb] px-5 py-2.5 text-sm font-medium text-white shadow-[0_6px_16px_rgba(37,99,235,0.3)] transition-colors hover:bg-[#1d4ed8] disabled:opacity-50"
          >
            Übernehmen
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold text-[#0f172a]">Preisliste einrichten</h1>
      <p className="text-sm text-[#64748b]">
        Wähle dein Gewerk für eine vorausgefüllte Preisliste, die du vor dem Speichern anpassen
        kannst.
      </p>
      <div className="grid grid-cols-2 gap-3">
        {templates.map((template) => (
          <button
            key={template.id}
            onClick={() => pickTemplate(template)}
            className="rounded-2xl border border-[#e9edf2] bg-white p-6 text-left text-sm font-medium text-[#0f172a] transition-colors hover:border-[#2563eb]"
          >
            {template.tradeLabel}
          </button>
        ))}
        <button
          onClick={() => setStep("blank")}
          className="rounded-2xl border border-dashed border-[#e9edf2] bg-white p-6 text-left text-sm font-medium text-[#64748b] transition-colors hover:border-[#2563eb]"
        >
          Leer starten
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 3: Lint**

Run: `npm run lint`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add app/\(app\)/price-list/page.tsx app/\(app\)/price-list/PriceListWizard.tsx
git commit -m "feat: add price list creation wizard UI"
```

---

### Task 6: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: all tests pass, including the 6 new tests in
`lib/priceList/templateSelection.test.ts`

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: build succeeds with no errors

- [ ] **Step 3: Manual QA checklist (add to `docs/MANUAL-STEPS-PENDING.md`)**

Append this section to `docs/MANUAL-STEPS-PENDING.md`:

```markdown
## Price list wizard — visual QA needed

- [ ] Apply migration `0011_price_list_templates.sql` in the Supabase SQL editor
  (after 0010).
- [ ] `/price-list` with zero items shows the trade-picker wizard, not the empty table.
- [ ] Picking a trade shows its checklist with all items checked and default prices filled in.
- [ ] Unchecking an item excludes it from the inserted list.
- [ ] Editing a price in the review step is reflected in the saved item.
- [ ] "Zurück" returns to the trade picker without losing template data.
- [ ] "Leer starten" goes straight to the existing manual editor.
- [ ] `/price-list` with existing items shows the normal editor, no wizard.
```

- [ ] **Step 4: Commit**

```bash
git add docs/MANUAL-STEPS-PENDING.md
git commit -m "docs: add price list wizard QA checklist to manual steps tracker"
```

---

## Self-review notes

- Spec coverage: migration/schema (Task 1), wizard flow trade picker + review
  checklist (Task 5), server action with server-side re-validation (Task 3),
  page branching on empty list (Task 4), testing section (Tasks 2 and 6) —
  all covered.
- Server-trust boundary: `buildRowsToInsert` only accepts label/unit/category
  from the server-fetched `templateItems`, never from the client selection —
  matches the spec's requirement explicitly.
- Type consistency: `Selection`/`TemplateItemRow` from Task 2 are imported
  unchanged into Task 3's action; `TemplateWithItems`/`TemplateItem` from
  Task 5 are imported unchanged into Task 4's page.
