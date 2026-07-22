function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE");
}

export type WarrantyRecord = {
  id: string;
  warranty_start_date: string;
  warranty_period_months: number;
  warranty_expiry_date: string;
};

// Read-only: a warranty record is auto-generated at signing time
// (app/q/[token]/actions.ts::signQuote) -- there is no manual create action,
// unlike InvoiceSection's "Rechnung erstellen" button. If it's missing here
// on a signed quote, generation failed best-effort at signing time (logged
// server-side); there is deliberately no UI to retroactively create one,
// since scope/line items must be taken from what was true at signing.
export function WarrantySection({ warranty }: { warranty: WarrantyRecord | null }) {
  if (!warranty) return null;

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#e9edf2] bg-[#f8fafc] p-4">
      <h2 className="text-sm font-semibold text-[#0f172a]">Gewährleistung</h2>
      <dl className="flex flex-col gap-1.5 text-sm">
        <div className="flex justify-between">
          <dt className="text-[#64748b]">Beginn</dt>
          <dd className="font-mono text-[#0f172a]">{formatDate(warranty.warranty_start_date)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-[#64748b]">Dauer</dt>
          <dd className="font-mono text-[#0f172a]">{warranty.warranty_period_months} Monate</dd>
        </div>
        <div className="flex justify-between border-t border-[#e9edf2] pt-1.5 font-semibold">
          <dt className="text-[#0f172a]">Ablaufdatum</dt>
          <dd className="font-mono text-[#0f172a]">{formatDate(warranty.warranty_expiry_date)}</dd>
        </div>
      </dl>
    </div>
  );
}
