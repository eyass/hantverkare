/**
 * Pure helper for grouping a quote's photos by the line item they're tagged
 * to (issue #208) -- shared by app/q/[token]/page.tsx and
 * QuotePdfDocument.tsx so the "match photo.quote_line_item_id to a line
 * item's id" rule lives in one place.
 *
 * Photos with a null `quote_line_item_id` are general job photos and are
 * deliberately excluded from the result -- callers keep rendering those
 * exactly as they do today, wherever they currently render, unchanged.
 */

export type PhotoLike = {
  quote_line_item_id: string | null;
};

/**
 * Returns a Map from line item id to the (possibly multiple) photos tagged
 * to it, preserving the input photo order within each bucket.
 */
export function groupPhotosByLineItem<T extends PhotoLike>(photos: T[]): Map<string, T[]> {
  const byLineItem = new Map<string, T[]>();
  for (const photo of photos) {
    if (!photo.quote_line_item_id) continue;
    const bucket = byLineItem.get(photo.quote_line_item_id);
    if (bucket) {
      bucket.push(photo);
    } else {
      byLineItem.set(photo.quote_line_item_id, [photo]);
    }
  }
  return byLineItem;
}

/** Convenience accessor for a single line item -- returns [] when untagged. */
export function photosForLineItem<T extends PhotoLike>(
  byLineItem: Map<string, T[]>,
  lineItemId: string,
): T[] {
  return byLineItem.get(lineItemId) ?? [];
}
