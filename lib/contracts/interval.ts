// Pure date-math for recurring contracts (issue #126). Kept free of any
// Supabase/env dependency, same rationale as lib/quotes/expiry.ts: unit
// testable in isolation, and reused identically by the "convert to contract"
// action and the contract-renewal cron.

export type ContractInterval = "monthly" | "quarterly" | "yearly";

export const CONTRACT_INTERVALS: ContractInterval[] = ["monthly", "quarterly", "yearly"];

export const CONTRACT_INTERVAL_LABELS: Record<ContractInterval, string> = {
  monthly: "Monatlich",
  quarterly: "Vierteljährlich",
  yearly: "Jährlich",
};

function monthsForInterval(interval: ContractInterval): number {
  switch (interval) {
    case "monthly":
      return 1;
    case "quarterly":
      return 3;
    case "yearly":
      return 12;
  }
}

/**
 * Advances `from` by one contract interval, using calendar-month arithmetic
 * (not a fixed day count) so "monthly from Jan 31" behaves the way a human
 * expects across months of varying length -- delegated to the JS Date engine
 * via setMonth, which normalizes overflow (e.g. Jan 31 + 1 month -> Mar 3,
 * the same rollover every JS Date consumer already expects).
 */
export function computeNextDueDate(
  interval: ContractInterval,
  from: Date = new Date(),
): Date {
  const next = new Date(from.getTime());
  next.setMonth(next.getMonth() + monthsForInterval(interval));
  return next;
}

export function isValidContractInterval(value: string): value is ContractInterval {
  return (CONTRACT_INTERVALS as string[]).includes(value);
}
