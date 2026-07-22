import { describe, it, expect } from "vitest";
import {
  buildVersionSnapshot,
  nextVersionNumber,
  validateTemplateEdit,
  type QuoteTemplateItemForSnapshot,
} from "./versionSnapshot";

describe("nextVersionNumber", () => {
  it("returns 1 for a template with no prior versions", () => {
    expect(nextVersionNumber([])).toBe(1);
  });

  it("returns max + 1 when versions already exist", () => {
    expect(nextVersionNumber([1, 2, 3])).toBe(4);
  });

  it("is resilient to out-of-order input", () => {
    expect(nextVersionNumber([3, 1, 2])).toBe(4);
  });
});

describe("buildVersionSnapshot", () => {
  const items: QuoteTemplateItemForSnapshot[] = [
    { label: "Anfahrt", unit: "Pauschale", quantity: 1, unit_price_cents: 4500, sort_order: 1 },
    { label: "Fliesen legen", unit: "m²", quantity: 12, unit_price_cents: 4500, sort_order: 0 },
  ];

  it("captures the pre-edit name and items, sorted by sort_order", () => {
    const snapshot = buildVersionSnapshot("org-1", "tpl-1", 1, "Badezimmer Standard", items, "user-1");
    expect(snapshot).toEqual({
      organization_id: "org-1",
      template_id: "tpl-1",
      version_number: 1,
      name_snapshot: "Badezimmer Standard",
      items_snapshot: [
        { label: "Fliesen legen", unit: "m²", quantity: 12, unit_price_cents: 4500, sort_order: 0 },
        { label: "Anfahrt", unit: "Pauschale", quantity: 1, unit_price_cents: 4500, sort_order: 1 },
      ],
      edited_by: "user-1",
    });
  });

  it("allows a null editor (e.g. user deleted after editing)", () => {
    const snapshot = buildVersionSnapshot("org-1", "tpl-1", 2, "Name", items, null);
    expect(snapshot.edited_by).toBeNull();
  });
});

describe("validateTemplateEdit", () => {
  const validItems = [{ label: "Fliesen legen", unit: "m²", quantity: 12, unit_price_cents: 4500 }];

  it("trims the name and assigns sort_order by position", () => {
    const result = validateTemplateEdit({ name: "  Neu  ", items: validItems });
    expect(result.error).toBeNull();
    expect(result.name).toBe("Neu");
    expect(result.items).toEqual([
      { label: "Fliesen legen", unit: "m²", quantity: 12, unit_price_cents: 4500, sort_order: 0 },
    ]);
  });

  it("rejects an empty name", () => {
    expect(validateTemplateEdit({ name: "   ", items: validItems }).error).not.toBeNull();
  });

  it("rejects a name over 200 characters", () => {
    expect(validateTemplateEdit({ name: "a".repeat(201), items: validItems }).error).not.toBeNull();
  });

  it("rejects an empty item list", () => {
    expect(validateTemplateEdit({ name: "Name", items: [] }).error).not.toBeNull();
  });

  it("rejects an item with a blank label", () => {
    const items = [{ label: "  ", unit: "m²", quantity: 1, unit_price_cents: 100 }];
    expect(validateTemplateEdit({ name: "Name", items }).error).not.toBeNull();
  });

  it("rejects an item with non-positive quantity", () => {
    const items = [{ label: "X", unit: "m²", quantity: 0, unit_price_cents: 100 }];
    expect(validateTemplateEdit({ name: "Name", items }).error).not.toBeNull();
  });

  it("rejects an item with non-positive unit price", () => {
    const items = [{ label: "X", unit: "m²", quantity: 1, unit_price_cents: 0 }];
    expect(validateTemplateEdit({ name: "Name", items }).error).not.toBeNull();
  });
});
