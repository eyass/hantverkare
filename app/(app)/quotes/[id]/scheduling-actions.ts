"use server";

// Server Actions backing the "Termin planen" (schedule appointment) section
// on the signed-quote detail page (issue #124), plus the /schedule calendar
// view and the "Anstehende Termine" widget on /quotes read from the
// scheduled_jobs table directly rather than through actions here.
//
// A quote can only be scheduled once it's signed. That rule is enforced here
// in the Server Action, not via a DB constraint/trigger -- see the comment
// in supabase/migrations/0020_job_scheduling.sql for why this repo
// consistently prefers app-level checks for business rules like this one.

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/organizations/getCurrentOrg";
import {
  deleteSyncedGoogleCalendarEvent,
  syncScheduledJobToGoogleCalendar,
} from "@/lib/integrations/googleCalendar/sync";

type ScheduledJobRow = {
  id: string;
  scheduled_start: string;
  scheduled_end: string | null;
  notes: string | null;
  google_calendar_event_id?: string | null;
};

type ScheduleResult =
  | { error: string; job?: never }
  | { error: null; job: ScheduledJobRow };

type ScheduleInput = {
  scheduledStart: string; // ISO string, built client-side from date + time inputs
  scheduledEnd?: string | null;
  notes?: string | null;
};

async function requireSignedQuote(
  supabase: Awaited<ReturnType<typeof createClient>>,
  quoteId: string,
): Promise<{ error: string } | { error: null }> {
  const { data: quote } = await supabase
    .from("quotes")
    .select("status")
    .eq("id", quoteId)
    .maybeSingle();
  if (!quote) {
    return { error: "Angebot nicht gefunden." };
  }
  if (quote.status !== "signed") {
    return { error: "Nur signierte Angebote können geplant werden." };
  }
  return { error: null };
}

/**
 * Creates or replaces the scheduled job for a signed quote. Since quote_id is
 * unique on scheduled_jobs, "replace" here means: if a row already exists for
 * this quote, update it in place instead of trying (and failing on the
 * unique constraint) to insert a second one -- this keeps the one save
 * button in the UI usable for both first-time scheduling and rescheduling.
 */
export async function scheduleJob(quoteId: string, input: ScheduleInput): Promise<ScheduleResult> {
  const start = new Date(input.scheduledStart);
  if (Number.isNaN(start.getTime())) {
    return { error: "Bitte Datum und Uhrzeit angeben." };
  }
  let end: Date | null = null;
  if (input.scheduledEnd) {
    end = new Date(input.scheduledEnd);
    if (Number.isNaN(end.getTime())) {
      return { error: "Ungültige Endzeit." };
    }
    if (end.getTime() <= start.getTime()) {
      return { error: "Die Endzeit muss nach der Startzeit liegen." };
    }
  }

  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Bitte melde dich an." };
  }

  const org = await getCurrentOrg(supabase);
  if (!org) {
    return { error: "Keine Organisation gefunden." };
  }

  const quoteCheck = await requireSignedQuote(supabase, quoteId);
  if (quoteCheck.error) {
    return { error: quoteCheck.error };
  }

  const { data: existing } = await supabase
    .from("scheduled_jobs")
    .select("id, google_calendar_event_id")
    .eq("quote_id", quoteId)
    .maybeSingle();

  const notes = input.notes?.trim() || null;

  if (existing) {
    const { data: job, error: updateError } = await supabase
      .from("scheduled_jobs")
      .update({
        scheduled_start: start.toISOString(),
        scheduled_end: end ? end.toISOString() : null,
        notes,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select("id, scheduled_start, scheduled_end, notes, google_calendar_event_id")
      .single();
    if (updateError || !job) {
      console.error("Failed to update scheduled job:", updateError);
      return { error: "Termin konnte nicht aktualisiert werden." };
    }
    // Best-effort (issue #166): awaited (not fire-and-forget) because
    // serverless functions can be frozen/torn down right after the response
    // is sent, which would silently drop an un-awaited background call. The
    // helper itself never throws and never surfaces an error to the user --
    // a sync failure is only logged.
    await syncScheduledJobToGoogleCalendar({
      id: job.id,
      organizationId: org.organizationId,
      quoteId,
      scheduledStart: job.scheduled_start,
      scheduledEnd: job.scheduled_end,
      notes: job.notes,
      googleCalendarEventId: job.google_calendar_event_id,
    });
    return { error: null, job };
  }

  const { data: job, error: insertError } = await supabase
    .from("scheduled_jobs")
    .insert({
      organization_id: org.organizationId,
      quote_id: quoteId,
      user_id: user.id,
      scheduled_start: start.toISOString(),
      scheduled_end: end ? end.toISOString() : null,
      notes,
    })
    .select("id, scheduled_start, scheduled_end, notes, google_calendar_event_id")
    .single();

  if (insertError || !job) {
    console.error("Failed to create scheduled job:", insertError);
    return { error: "Termin konnte nicht gespeichert werden." };
  }

  // Best-effort (issue #166): see the comment above the other call site.
  await syncScheduledJobToGoogleCalendar({
    id: job.id,
    organizationId: org.organizationId,
    quoteId,
    scheduledStart: job.scheduled_start,
    scheduledEnd: job.scheduled_end,
    notes: job.notes,
    googleCalendarEventId: job.google_calendar_event_id,
  });

  return { error: null, job };
}

/** Cancels (deletes) the scheduled job for a quote, if any. */
export async function cancelScheduledJob(quoteId: string): Promise<{ error: string | null }> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Bitte melde dich an." };
  }

  const org = await getCurrentOrg(supabase);
  if (!org) {
    return { error: "Keine Organisation gefunden." };
  }

  // Read the synced event id before deleting the row -- it only lives here,
  // so once the row is gone there'd be nothing left to tell Google which
  // event to remove.
  const { data: existing } = await supabase
    .from("scheduled_jobs")
    .select("google_calendar_event_id")
    .eq("quote_id", quoteId)
    .maybeSingle();

  const { error: deleteError } = await supabase
    .from("scheduled_jobs")
    .delete()
    .eq("quote_id", quoteId);
  if (deleteError) {
    console.error("Failed to cancel scheduled job:", deleteError);
    return { error: "Termin konnte nicht storniert werden." };
  }

  // Best-effort (issue #166): see the sync comment in scheduleJob above.
  await deleteSyncedGoogleCalendarEvent(org.organizationId, existing?.google_calendar_event_id ?? null);

  return { error: null };
}
