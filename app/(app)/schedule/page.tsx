import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

// Lightweight schedule/calendar view (issue #124): a simple upcoming-jobs
// list grouped by day, not an interactive month grid or drag/drop board --
// this feature is explicitly scoped as lightweight. Past jobs are included
// so the tradesperson can look back at what was done, but the page leads
// with what's coming up.

type ScheduledJobRow = {
  id: string;
  scheduled_start: string;
  scheduled_end: string | null;
  notes: string | null;
  quote_id: string;
  quotes: { customer_description: string } | null;
};

function formatDateHeading(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatTimeRange(start: string, end: string | null): string {
  const startLabel = new Date(start).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  if (!end) return startLabel;
  const endLabel = new Date(end).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
  return `${startLabel} – ${endLabel}`;
}

function dateKey(iso: string): string {
  return new Date(iso).toDateString();
}

export default async function SchedulePage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("scheduled_jobs")
    .select("id, scheduled_start, scheduled_end, notes, quote_id, quotes(customer_description)")
    .order("scheduled_start", { ascending: true });

  if (error) {
    console.error("Failed to load scheduled jobs:", error);
  }

  const jobs = (data ?? []) as unknown as ScheduledJobRow[];

  const now = new Date();
  const upcoming = jobs.filter((job) => new Date(job.scheduled_start) >= now);
  const past = jobs.filter((job) => new Date(job.scheduled_start) < now);

  function groupByDay(list: ScheduledJobRow[]): { key: string; heading: string; jobs: ScheduledJobRow[] }[] {
    const groups = new Map<string, ScheduledJobRow[]>();
    for (const job of list) {
      const key = dateKey(job.scheduled_start);
      const existing = groups.get(key);
      if (existing) {
        existing.push(job);
      } else {
        groups.set(key, [job]);
      }
    }
    return Array.from(groups.entries()).map(([key, jobsForDay]) => ({
      key,
      heading: formatDateHeading(jobsForDay[0].scheduled_start),
      jobs: jobsForDay,
    }));
  }

  const upcomingGroups = groupByDay(upcoming);
  const pastGroups = groupByDay([...past].reverse());

  function renderGroups(groups: ReturnType<typeof groupByDay>) {
    return groups.map((group) => (
      <div key={group.key} className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">{group.heading}</h2>
        <div className="overflow-hidden rounded-2xl border border-[#e9edf2] bg-white">
          {group.jobs.map((job, index) => (
            <Link
              key={job.id}
              href={`/quotes/${job.quote_id}`}
              className={`flex items-center justify-between gap-4 p-4 transition-colors hover:bg-[#f4f6f8] ${
                index !== 0 ? "border-t border-[#e9edf2]" : ""
              }`}
            >
              <div className="flex flex-col gap-1">
                <span className="text-sm font-medium text-[#0f172a]">
                  {job.quotes?.customer_description ?? "Auftrag"}
                </span>
                {job.notes && <span className="text-xs text-[#64748b]">{job.notes}</span>}
              </div>
              <span className="font-mono text-sm font-semibold text-[#0f172a]">
                {formatTimeRange(job.scheduled_start, job.scheduled_end)}
              </span>
            </Link>
          ))}
        </div>
      </div>
    ));
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <h1 className="text-2xl font-semibold text-[#0f172a]">Termine</h1>

      {upcomingGroups.length === 0 ? (
        <p className="text-sm text-[#64748b]">
          Noch keine anstehenden Termine. Termine werden auf der Angebotsseite eines signierten Angebots geplant.
        </p>
      ) : (
        <div className="flex flex-col gap-5">{renderGroups(upcomingGroups)}</div>
      )}

      {pastGroups.length > 0 && (
        <details className="flex flex-col gap-3">
          <summary className="cursor-pointer text-sm font-medium text-[#64748b]">
            Vergangene Termine ({past.length})
          </summary>
          <div className="mt-3 flex flex-col gap-5">{renderGroups(pastGroups)}</div>
        </details>
      )}
    </div>
  );
}
