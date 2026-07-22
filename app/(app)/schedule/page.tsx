import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentOrg } from "@/lib/organizations/getCurrentOrg";
import { getOrgMembers } from "@/lib/organizations/getOrgMembers";
import { CustomerTimelineFilter } from "./CustomerTimelineFilter";

// Lightweight schedule/calendar view (issue #124): a simple upcoming-jobs
// list grouped by day, not an interactive month grid or drag/drop board --
// this feature is explicitly scoped as lightweight. Past jobs are included
// so the tradesperson can look back at what was done, but the page leads
// with what's coming up.
//
// Issue #161 adds an optional "customer timeline" mode on top of the same
// page (rather than a separate route): pick a customer via `?customer=<id>`
// and every scheduled job tied to quotes for that customer is shown together,
// each labelled with the assigned trade/helper (quotes.assigned_to, #128),
// so overlapping/conflicting slots across trades on the same job are visible
// in one place. This is purely a read-only filter+label layer over the same
// org-scoped `scheduled_jobs`/`quotes` RLS from #124/#128 -- no new access.

type ScheduledJobRow = {
  id: string;
  scheduled_start: string;
  scheduled_end: string | null;
  notes: string | null;
  quote_id: string;
  quotes: { customer_description: string; assigned_to: string | null; customer_id: string | null } | null;
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

/** Two [start, end) ranges overlap; a null end is treated as a point-in-time slot. */
function rangesOverlap(aStart: string, aEnd: string | null, bStart: string, bEnd: string | null): boolean {
  const aS = new Date(aStart).getTime();
  const aE = aEnd ? new Date(aEnd).getTime() : aS;
  const bS = new Date(bStart).getTime();
  const bE = bEnd ? new Date(bEnd).getTime() : bS;
  return aS < bE && bS < aE;
}

/** Ids of jobs whose time range overlaps at least one other job in the list -- used to
 * flag scheduling conflicts in the customer timeline view (issue #161). */
function findConflictingJobIds(list: ScheduledJobRow[]): Set<string> {
  const conflicting = new Set<string>();
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      if (rangesOverlap(list[i].scheduled_start, list[i].scheduled_end, list[j].scheduled_start, list[j].scheduled_end)) {
        conflicting.add(list[i].id);
        conflicting.add(list[j].id);
      }
    }
  }
  return conflicting;
}

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ customer?: string }>;
}) {
  const { customer: customerId } = await searchParams;
  const supabase = await createClient();

  // Customer options for the timeline filter -- any customer the caller can
  // see (existing customers RLS), not just ones with jobs already scheduled,
  // so a tradesperson can jump straight to a property before anything else
  // has been scheduled for it yet.
  const { data: customerOptions, error: customerOptionsError } = await supabase
    .from("customers")
    .select("id, name")
    .order("name");
  if (customerOptionsError) {
    console.error("Failed to load customers for timeline filter:", customerOptionsError);
  }

  if (customerId) {
    return (
      <CustomerTimelineView
        customerId={customerId}
        customerOptions={customerOptions ?? []}
      />
    );
  }

  const { data, error } = await supabase
    .from("scheduled_jobs")
    .select("id, scheduled_start, scheduled_end, notes, quote_id, quotes(customer_description, assigned_to, customer_id)")
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

      <CustomerTimelineFilter customers={customerOptions ?? []} selectedCustomerId={null} />

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

/**
 * Shared multi-trade timeline for a single customer/property (issue #161).
 * Every scheduled job tied to that customer's quotes is shown together in one
 * day-grouped list, each row labelled with the assigned trade/helper so
 * conflicting slots across trades are visible before they happen.
 */
async function CustomerTimelineView({
  customerId,
  customerOptions,
}: {
  customerId: string;
  customerOptions: { id: string; name: string }[];
}) {
  const supabase = await createClient();

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id, name")
    .eq("id", customerId)
    .maybeSingle();
  if (customerError) {
    console.error("Failed to load customer for timeline:", customerError);
  }

  const { data, error } = await supabase
    .from("scheduled_jobs")
    .select(
      "id, scheduled_start, scheduled_end, notes, quote_id, quotes!inner(customer_description, assigned_to, customer_id)",
    )
    .eq("quotes.customer_id", customerId)
    .order("scheduled_start", { ascending: true });
  if (error) {
    console.error("Failed to load customer timeline jobs:", error);
  }

  const jobs = (data ?? []) as unknown as ScheduledJobRow[];

  // Resolve assigned_to user ids to emails for display. Best-effort: if the
  // caller has no org (shouldn't happen past the (app) layout) this just
  // renders jobs with no assignee label instead of failing the page.
  const org = await getCurrentOrg(supabase);
  const members = org ? await getOrgMembers(createAdminClient(), org.organizationId) : [];
  const memberEmailByUserId = new Map(members.map((member) => [member.userId, member.email]));

  const conflictingJobIds = findConflictingJobIds(jobs);

  const groups = (() => {
    const byDay = new Map<string, ScheduledJobRow[]>();
    for (const job of jobs) {
      const key = dateKey(job.scheduled_start);
      const existing = byDay.get(key);
      if (existing) existing.push(job);
      else byDay.set(key, [job]);
    }
    return Array.from(byDay.entries()).map(([key, jobsForDay]) => ({
      key,
      heading: formatDateHeading(jobsForDay[0].scheduled_start),
      jobs: jobsForDay,
    }));
  })();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold text-[#0f172a]">
          Zeitleiste{customer ? `: ${customer.name}` : ""}
        </h1>
        <Link href="/schedule" className="text-sm font-medium text-[#2563eb] hover:text-[#1d4ed8]">
          Zurück zu allen Terminen
        </Link>
      </div>

      <CustomerTimelineFilter customers={customerOptions} selectedCustomerId={customerId} />

      {conflictingJobIds.size > 0 && (
        <div className="rounded-2xl border border-[#fecaca] bg-[#fef2f2] p-4 text-sm text-[#b91c1c]">
          Achtung: mindestens zwei Termine überschneiden sich zeitlich -- unten rot markiert.
        </div>
      )}

      {groups.length === 0 ? (
        <p className="text-sm text-[#64748b]">
          Für diesen Kunden sind noch keine Termine geplant.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {groups.map((group) => (
            <div key={group.key} className="flex flex-col gap-2">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-[#94a3b8]">{group.heading}</h2>
              <div className="overflow-hidden rounded-2xl border border-[#e9edf2] bg-white">
                {group.jobs.map((job, index) => {
                  const isConflicting = conflictingJobIds.has(job.id);
                  const assignedEmail = job.quotes?.assigned_to
                    ? memberEmailByUserId.get(job.quotes.assigned_to) ?? "Zugewiesen (unbekannt)"
                    : null;
                  return (
                    <Link
                      key={job.id}
                      href={`/quotes/${job.quote_id}`}
                      className={`flex items-center justify-between gap-4 p-4 transition-colors hover:bg-[#f4f6f8] ${
                        index !== 0 ? "border-t border-[#e9edf2]" : ""
                      } ${isConflicting ? "bg-[#fef2f2]" : ""}`}
                    >
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium text-[#0f172a]">
                          {job.quotes?.customer_description ?? "Auftrag"}
                        </span>
                        <div className="flex flex-wrap items-center gap-2">
                          {assignedEmail && (
                            <span className="rounded-full bg-[#eff6ff] px-2 py-0.5 text-xs font-medium text-[#2563eb]">
                              {assignedEmail}
                            </span>
                          )}
                          {isConflicting && (
                            <span className="rounded-full bg-[#fee2e2] px-2 py-0.5 text-xs font-semibold text-[#b91c1c]">
                              Konflikt
                            </span>
                          )}
                        </div>
                        {job.notes && <span className="text-xs text-[#64748b]">{job.notes}</span>}
                      </div>
                      <span className="font-mono text-sm font-semibold text-[#0f172a]">
                        {formatTimeRange(job.scheduled_start, job.scheduled_end)}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
