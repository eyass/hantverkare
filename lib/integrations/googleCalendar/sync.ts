// Best-effort one-way sync (app -> Google Calendar) of scheduled_jobs rows
// (issue #166). Called from the scheduling Server Actions after a successful
// write to scheduled_jobs -- never the other way around, and never allowed to
// throw: a Google API outage or a disconnected/unconfigured org must not
// block the tradesperson from scheduling/rescheduling/cancelling a job in the
// app itself, which is the actual product this feature sits on top of.

import { createAdminClient } from "@/lib/supabase/admin";
import {
  deleteGoogleCalendarEvent,
  isGoogleCalendarConfigured,
  upsertGoogleCalendarEvent,
} from "./client";

type OrgGoogleCalendarConfig = {
  refreshToken: string;
  calendarId: string;
};

// Uses the admin client deliberately: google_calendar_refresh_token has no
// client-facing SELECT policy (see 0037_google_calendar_sync.sql), and this
// runs inside a Server Action already past its own org/auth checks -- same
// "admin client for a column members can't read directly" pattern as billing.
async function getOrgGoogleCalendarConfig(
  organizationId: string,
): Promise<OrgGoogleCalendarConfig | null> {
  if (!isGoogleCalendarConfigured()) {
    return null;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organizations")
    .select("google_calendar_refresh_token, google_calendar_id")
    .eq("id", organizationId)
    .maybeSingle();

  if (error) {
    console.error("Google Calendar sync: failed to load org config:", error);
    return null;
  }
  if (!data?.google_calendar_refresh_token) {
    return null; // org has never connected Google Calendar -- normal, silent no-op
  }

  return {
    refreshToken: data.google_calendar_refresh_token,
    calendarId: data.google_calendar_id || "primary",
  };
}

export type SyncableScheduledJob = {
  id: string;
  organizationId: string;
  quoteId: string;
  scheduledStart: string;
  scheduledEnd: string | null;
  notes: string | null;
  googleCalendarEventId: string | null;
};

/**
 * Creates or updates the Google Calendar event for a scheduled job, and
 * stamps the returned event id back onto the scheduled_jobs row. Swallows
 * all errors -- logs and returns, never throws.
 */
export async function syncScheduledJobToGoogleCalendar(
  job: SyncableScheduledJob,
): Promise<void> {
  try {
    const config = await getOrgGoogleCalendarConfig(job.organizationId);
    if (!config) {
      return;
    }

    const admin = createAdminClient();

    // customer_description is the only descriptive text quotes carry (see
    // 0002_quotes.sql) -- used as both the event title and body so the
    // tradesperson can tell jobs apart in Google Calendar without switching
    // back to the app.
    const { data: quote } = await admin
      .from("quotes")
      .select("customer_description")
      .eq("id", job.quoteId)
      .maybeSingle();

    const summary = quote?.customer_description
      ? `Auftrag: ${quote.customer_description.slice(0, 80)}`
      : "Geplanter Auftrag";
    const description = [quote?.customer_description, job.notes].filter(Boolean).join("\n\n");

    // No explicit end time is allowed in scheduled_jobs (scheduled_end is
    // nullable); Google Calendar requires one, so default to a one-hour slot
    // when the tradesperson didn't specify an end time.
    const endIso =
      job.scheduledEnd ?? new Date(new Date(job.scheduledStart).getTime() + 60 * 60 * 1000).toISOString();

    const eventId = await upsertGoogleCalendarEvent(
      config.refreshToken,
      config.calendarId,
      { summary, description: description || null, startIso: job.scheduledStart, endIso },
      job.googleCalendarEventId,
    );

    if (!eventId) {
      return; // already logged inside upsertGoogleCalendarEvent
    }

    if (eventId !== job.googleCalendarEventId) {
      const { error } = await admin
        .from("scheduled_jobs")
        .update({ google_calendar_event_id: eventId })
        .eq("id", job.id);
      if (error) {
        console.error("Google Calendar sync: failed to save event id:", error);
      }
    }
  } catch (err) {
    console.error("Google Calendar sync: unexpected error, ignoring (best-effort):", err);
  }
}

/**
 * Deletes the Google Calendar event for a cancelled scheduled job, if one was
 * ever synced. Swallows all errors -- best-effort, same as the sync above.
 */
export async function deleteSyncedGoogleCalendarEvent(
  organizationId: string,
  googleCalendarEventId: string | null,
): Promise<void> {
  if (!googleCalendarEventId) {
    return;
  }
  try {
    const config = await getOrgGoogleCalendarConfig(organizationId);
    if (!config) {
      return;
    }
    await deleteGoogleCalendarEvent(config.refreshToken, config.calendarId, googleCalendarEventId);
  } catch (err) {
    console.error("Google Calendar sync: unexpected error on delete, ignoring:", err);
  }
}
