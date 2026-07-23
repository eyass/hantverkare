/**
 * Multi-room / multi-phase line-item grouping (issue #205) -- shared, pure
 * clustering logic used by QuoteEditor.tsx, app/q/[token]/page.tsx, and
 * QuotePdfDocument.tsx so the "cluster by group_label, order by first
 * appearance, sort within a cluster by position" rule lives in exactly one
 * place instead of being reimplemented three times.
 *
 * See docs/superpowers/specs/2026-07-23-line-item-grouping-design.md.
 *
 * Deliberately generic over the caller's row shape (DB rows use snake_case
 * `group_label`/`line_total_cents`, the AI-generation pipeline uses camelCase
 * `groupLabel`/`lineTotalCents`) -- callers pass small accessor functions
 * instead of this module assuming a specific field-naming convention.
 */

export type LineItemGroup<T> = {
  /** null for the trailing "Weitere Positionen" bucket of ungrouped items. */
  label: string | null;
  items: T[];
  subtotalCents: number;
};

export type GroupedLineItems<T> = {
  /**
   * false when no item on the quote carries a group label -- callers should
   * render exactly as today (flat list, no subtotals, no section headers)
   * in that case. `groups` still contains a single implicit group with all
   * items for callers that prefer to always iterate `groups`.
   */
  hasGroups: boolean;
  groups: LineItemGroup<T>[];
};

export type GroupLineItemsOptions<T> = {
  getGroupLabel: (item: T) => string | null | undefined;
  getLineTotalCents: (item: T) => number;
  getPosition: (item: T) => number;
};

/**
 * Clusters a flat, position-ordered array of line items by group label.
 *
 * - Labeled clusters are ordered by first appearance (the minimum position
 *   among their members), and sorted internally by position -- this stays
 *   stable even when a group's members have non-contiguous positions (e.g.
 *   interleaved with items from other groups), since ordering never depends
 *   on array index, only on each item's own `position`.
 * - Any ungrouped items (no label, or a blank/whitespace-only label) are
 *   always collected last, into a single `label: null` bucket -- "Weitere
 *   Positionen" -- regardless of their position, so a manually-added
 *   ungrouped item never gets sorted in among labeled groups.
 * - When no item has a label at all, the result is a single implicit group
 *   containing everything in position order, with `hasGroups: false` so
 *   callers can fall back to today's flat rendering unchanged.
 */
export function groupLineItems<T>(
  items: T[],
  { getGroupLabel, getLineTotalCents, getPosition }: GroupLineItemsOptions<T>,
): GroupedLineItems<T> {
  const sorted = [...items].sort((a, b) => getPosition(a) - getPosition(b));

  const normalizedLabel = (item: T): string | null => {
    const raw = getGroupLabel(item);
    if (typeof raw !== "string") return null;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const hasGroups = sorted.some((item) => normalizedLabel(item) !== null);

  if (!hasGroups) {
    return {
      hasGroups: false,
      groups: [
        {
          label: null,
          items: sorted,
          subtotalCents: sum(sorted, getLineTotalCents),
        },
      ],
    };
  }

  const labeledOrder: string[] = [];
  const labeledBuckets = new Map<string, T[]>();
  const ungrouped: T[] = [];

  for (const item of sorted) {
    const label = normalizedLabel(item);
    if (label === null) {
      ungrouped.push(item);
      continue;
    }
    let bucket = labeledBuckets.get(label);
    if (!bucket) {
      bucket = [];
      labeledBuckets.set(label, bucket);
      labeledOrder.push(label);
    }
    bucket.push(item);
  }

  // First-appearance order == the order labels were first encountered while
  // walking `sorted` (already position-ordered), i.e. ordered by the
  // minimum position within each cluster.
  const groups: LineItemGroup<T>[] = labeledOrder.map((label) => {
    const bucketItems = labeledBuckets.get(label)!;
    return {
      label,
      items: bucketItems,
      subtotalCents: sum(bucketItems, getLineTotalCents),
    };
  });

  if (ungrouped.length > 0) {
    groups.push({
      label: null,
      items: ungrouped,
      subtotalCents: sum(ungrouped, getLineTotalCents),
    });
  }

  return { hasGroups: true, groups };
}

function sum<T>(items: T[], getLineTotalCents: (item: T) => number): number {
  return items.reduce((total, item) => total + getLineTotalCents(item), 0);
}
