"use client";

// Running hours total + entry list + capture form for a job (issue #195).
// Lives on the job detail page (app/(app)/jobs/[id]/page.tsx), which is keyed
// by quote id -- entries themselves are looked up via the scheduled_jobs row
// behind that quote (see time-entry-actions.ts's resolveJobIdForQuote).

import { useState, useTransition } from "react";
import { TimeEntryForm } from "./TimeEntryForm";
import { deleteTimeEntry, type TimeEntryRow } from "./time-entry-actions";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE");
}

function formatHours(hours: number): string {
  return hours.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function TimeTrackingSection({
  quoteId,
  initialEntries,
  initialTotalHours,
}: {
  quoteId: string;
  initialEntries: TimeEntryRow[];
  initialTotalHours: number;
}) {
  const [entries, setEntries] = useState(initialEntries);
  const [totalHours, setTotalHours] = useState(initialTotalHours);
  const [isPending, startTransition] = useTransition();

  function handleEntryAdded(entry: TimeEntryRow) {
    setEntries((prev) => [entry, ...prev]);
    setTotalHours((prev) => Math.round((prev + Number(entry.hours)) * 100) / 100);
  }

  function handleDelete(entry: TimeEntryRow) {
    startTransition(async () => {
      const result = await deleteTimeEntry(entry.id);
      if (result.error) {
        return;
      }
      setEntries((prev) => prev.filter((e) => e.id !== entry.id));
      setTotalHours((prev) => Math.round((prev - Number(entry.hours)) * 100) / 100);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between rounded-2xl border border-[#e9edf2] bg-[#f8fafc] p-4">
        <h2 className="text-sm font-semibold text-[#0f172a]">Arbeitszeit</h2>
        <span className="font-mono text-lg font-semibold text-[#0f172a]">
          {formatHours(totalHours)} Std.
        </span>
      </div>

      <TimeEntryForm quoteId={quoteId} onEntryAdded={handleEntryAdded} />

      {entries.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-[#e9edf2] bg-white">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-[#e9edf2] bg-[#f8fafc] text-xs uppercase tracking-wide text-[#94a3b8]">
                <th className="px-4 py-3 font-medium">Datum</th>
                <th className="px-4 py-3 font-medium">Stunden</th>
                <th className="px-4 py-3 font-medium">Notiz</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b border-[#e9edf2] last:border-b-0">
                  <td className="px-4 py-3">{formatDate(entry.worked_on)}</td>
                  <td className="px-4 py-3 font-mono">{formatHours(Number(entry.hours))}</td>
                  <td className="px-4 py-3 text-[#64748b]">{entry.note ?? "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleDelete(entry)}
                      className="text-xs text-[#94a3b8] underline hover:text-[#dc2626] disabled:opacity-50"
                    >
                      Löschen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
