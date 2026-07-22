"use client";

import { useRouter } from "next/navigation";

type CustomerOption = {
  id: string;
  name: string;
};

/**
 * Customer picker for the shared multi-trade timeline mode (issue #161).
 * Plain client component that just navigates to `/schedule?customer=<id>` --
 * no client state beyond the select itself, the server component owns all
 * the data fetching/grouping.
 */
export function CustomerTimelineFilter({
  customers,
  selectedCustomerId,
}: {
  customers: CustomerOption[];
  selectedCustomerId: string | null;
}) {
  const router = useRouter();

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-[#e9edf2] bg-white p-4">
      <label htmlFor="customer-timeline-select" className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">
        Kunden-Zeitleiste (mehrere Gewerke)
      </label>
      <select
        id="customer-timeline-select"
        className="rounded-lg border border-[#e9edf2] bg-white px-3 py-2 text-sm text-[#0f172a]"
        value={selectedCustomerId ?? ""}
        onChange={(event) => {
          const value = event.target.value;
          router.push(value ? `/schedule?customer=${value}` : "/schedule");
        }}
      >
        <option value="">Alle Termine (kein Kunde ausgewählt)</option>
        {customers.map((customer) => (
          <option key={customer.id} value={customer.id}>
            {customer.name}
          </option>
        ))}
      </select>
      <p className="text-xs text-[#64748b]">
        Zeigt alle geplanten Termine für einen Kunden gemeinsam an, damit Termine mehrerer
        Gewerke/Helfer für dasselbe Objekt an einem Ort sichtbar sind.
      </p>
    </div>
  );
}
