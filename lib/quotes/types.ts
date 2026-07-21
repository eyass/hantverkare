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
