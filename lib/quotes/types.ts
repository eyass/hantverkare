export type LineItem = {
  description: string;
  quantity: number;
  unit: string;
  unitPriceCents: number;
};

/**
 * Optional internal-only cost (materials/own labor) for a line item — what the
 * tradesperson actually pays, as distinct from unitPriceCents (what the
 * customer is charged). Never surfaced on the customer-facing quote page.
 */
export type LineItemCost = {
  costCents: number | null;
};

export type PricedLineItem = LineItem & {
  lineTotalCents: number;
};

export type QuoteTotals = {
  subtotalCents: number;
  vatCents: number;
  totalCents: number;
};
