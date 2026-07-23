import { describe, it, expect } from "vitest";
import { groupPhotosByLineItem, photosForLineItem } from "./photosByLineItem";

type Photo = { id: string; quote_line_item_id: string | null };

function makePhoto(id: string, lineItemId: string | null): Photo {
  return { id, quote_line_item_id: lineItemId };
}

describe("groupPhotosByLineItem", () => {
  it("returns an empty map when no photo is tagged to a line item", () => {
    const photos = [makePhoto("p1", null), makePhoto("p2", null)];
    const result = groupPhotosByLineItem(photos);
    expect(result.size).toBe(0);
  });

  it("groups photos by their tagged line item id, excluding untagged photos", () => {
    const tagged1 = makePhoto("p1", "li-1");
    const tagged2 = makePhoto("p2", "li-1");
    const otherTagged = makePhoto("p3", "li-2");
    const untagged = makePhoto("p4", null);

    const result = groupPhotosByLineItem([tagged1, otherTagged, untagged, tagged2]);

    expect(result.size).toBe(2);
    expect(result.get("li-1")).toEqual([tagged1, tagged2]);
    expect(result.get("li-2")).toEqual([otherTagged]);
  });

  it("preserves input order within a bucket", () => {
    const first = makePhoto("p1", "li-1");
    const second = makePhoto("p2", "li-1");
    const result = groupPhotosByLineItem([second, first]);
    expect(result.get("li-1")).toEqual([second, first]);
  });
});

describe("photosForLineItem", () => {
  it("returns an empty array for a line item with no tagged photos", () => {
    const byLineItem = groupPhotosByLineItem([makePhoto("p1", "li-1")]);
    expect(photosForLineItem(byLineItem, "li-2")).toEqual([]);
  });

  it("returns the tagged photos for a line item that has them", () => {
    const tagged = makePhoto("p1", "li-1");
    const byLineItem = groupPhotosByLineItem([tagged]);
    expect(photosForLineItem(byLineItem, "li-1")).toEqual([tagged]);
  });
});
