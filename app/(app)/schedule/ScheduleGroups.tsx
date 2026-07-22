"use client";

import Link from "next/link";
import { useFieldMode } from "@/lib/field-mode/FieldModeProvider";

export type ScheduleGroup = {
  key: string;
  heading: string;
  jobs: {
    id: string;
    quote_id: string;
    notes: string | null;
    customerDescription: string | null;
    timeRangeLabel: string;
  }[];
};

/**
 * Client component so it can read the field-mode preference (issue #164) --
 * larger row padding and text for one-tap navigation to a job's quote with
 * gloves or dirty hands on-site. Pure display sizing; the underlying data
 * and links are unchanged from the server-rendered version.
 */
export function ScheduleGroups({ groups }: { groups: ScheduleGroup[] }) {
  const { fieldMode } = useFieldMode();

  return (
    <>
      {groups.map((group) => (
        <div key={group.key} className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">{group.heading}</h2>
          <div className="overflow-hidden rounded-2xl border border-[#e9edf2] bg-white">
            {group.jobs.map((job, index) => (
              <Link
                key={job.id}
                href={`/quotes/${job.quote_id}`}
                className={`flex items-center justify-between gap-4 transition-colors hover:bg-[#f4f6f8] ${
                  fieldMode ? "p-6" : "p-4"
                } ${index !== 0 ? "border-t border-[#e9edf2]" : ""}`}
              >
                <div className="flex flex-col gap-1">
                  <span className={`font-medium text-[#0f172a] ${fieldMode ? "text-lg" : "text-sm"}`}>
                    {job.customerDescription ?? "Auftrag"}
                  </span>
                  {job.notes && (
                    <span className={`text-[#64748b] ${fieldMode ? "text-sm" : "text-xs"}`}>{job.notes}</span>
                  )}
                </div>
                <span className={`font-mono font-semibold text-[#0f172a] ${fieldMode ? "text-lg" : "text-sm"}`}>
                  {job.timeRangeLabel}
                </span>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
