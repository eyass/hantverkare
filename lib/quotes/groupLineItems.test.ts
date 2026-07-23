import { describe, it, expect } from "vitest";
import { groupLineItems } from "./groupLineItems";

type Item = {
  position: number;
  groupLabel: string | null;
  lineTotalCents: number;
};

function makeItem(position: number, groupLabel: string | null, lineTotalCents: number): Item {
  return { position, groupLabel, lineTotalCents };
}

const options = {
  getGroupLabel: (item: Item) => item.groupLabel,
  getLineTotalCents: (item: Item) => item.lineTotalCents,
  getPosition: (item: Item) => item.position,
};

describe("groupLineItems", () => {
  it("returns a single implicit ungrouped group when no item has a group label", () => {
    const items = [makeItem(0, null, 1000), makeItem(1, null, 2000), makeItem(2, null, 500)];
    const result = groupLineItems(items, options);

    expect(result.hasGroups).toBe(false);
    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].label).toBeNull();
    expect(result.groups[0].items).toEqual(items);
    expect(result.groups[0].subtotalCents).toBe(3500);
  });

  it("treats a blank/whitespace-only groupLabel as ungrouped", () => {
    const items = [makeItem(0, "", 1000), makeItem(1, "   ", 2000)];
    const result = groupLineItems(items, options);

    expect(result.hasGroups).toBe(false);
  });

  it("clusters mixed grouped/ungrouped input in first-appearance order with correct subtotals", () => {
    const kitchen1 = makeItem(0, "Küche", 1000);
    const bath1 = makeItem(1, "Bad", 2000);
    const loose = makeItem(2, null, 300);
    const kitchen2 = makeItem(3, "Küche", 1500);
    const bath2 = makeItem(4, "Bad", 500);

    const result = groupLineItems([kitchen1, bath1, loose, kitchen2, bath2], options);

    expect(result.hasGroups).toBe(true);
    expect(result.groups.map((g) => g.label)).toEqual(["Küche", "Bad", null]);

    const kitchenGroup = result.groups[0];
    expect(kitchenGroup.items).toEqual([kitchen1, kitchen2]);
    expect(kitchenGroup.subtotalCents).toBe(2500);

    const bathGroup = result.groups[1];
    expect(bathGroup.items).toEqual([bath1, bath2]);
    expect(bathGroup.subtotalCents).toBe(2500);

    const ungroupedGroup = result.groups[2];
    expect(ungroupedGroup.items).toEqual([loose]);
    expect(ungroupedGroup.subtotalCents).toBe(300);
  });

  it("collects ungrouped items last regardless of their position relative to labeled groups", () => {
    // Ungrouped item appears first by position, but should still render
    // after all labeled groups (the "Weitere Positionen" bucket).
    const loose = makeItem(0, null, 100);
    const kitchen = makeItem(1, "Küche", 1000);

    const result = groupLineItems([loose, kitchen], options);

    expect(result.groups.map((g) => g.label)).toEqual(["Küche", null]);
  });

  it("orders clusters by first-appearance (minimum position) and is stable against non-contiguous positions within a group", () => {
    // "Bad" first appears at position 1 (before "Küche" first appears at
    // position 2), even though "Bad"'s members are scattered
    // non-contiguously (positions 1 and 4) -- cluster order must depend
    // only on each item's own position, never on array/insertion order.
    const items = [
      makeItem(2, "Küche", 100),
      makeItem(1, "Bad", 200),
      makeItem(3, "Küche", 300),
      makeItem(4, "Bad", 400),
    ];
    // Shuffle the array itself to further prove order doesn't depend on
    // input array order, only on `position`.
    const shuffled = [items[2], items[0], items[3], items[1]];

    const result = groupLineItems(shuffled, options);

    expect(result.groups.map((g) => g.label)).toEqual(["Bad", "Küche"]);
    expect(result.groups[0].items.map((i) => i.position)).toEqual([1, 4]);
    expect(result.groups[1].items.map((i) => i.position)).toEqual([2, 3]);
    expect(result.groups[0].subtotalCents).toBe(600);
    expect(result.groups[1].subtotalCents).toBe(400);
  });

  it("handles an empty input array", () => {
    const result = groupLineItems([], options);
    expect(result.hasGroups).toBe(false);
    expect(result.groups).toEqual([{ label: null, items: [], subtotalCents: 0 }]);
  });
});
