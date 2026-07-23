"use server";

// Server Actions backing TimeEntryForm.tsx (issue #195). The route param for
// app/(app)/jobs/[id]/ is a *quote* id (see page.tsx's doc comment), not a
// scheduled_jobs id, so every action here first resolves the scheduled_jobs
// row for that quote to get the actual job_id time_entries references --
// same lookup app/(app)/quotes/[id]/scheduling-actions.ts already does.

import { createClient } from "@/lib/supabase/server";
import { getCurrentOrg } from "@/lib/organizations/getCurrentOrg";
import { validateHours, validateWorkedOn } from "@/lib/timeTracking/validation";
import { extractTimeEntry, TimeEntryExtractionError } from "@/lib/timeTracking/extractTimeEntry";

export type TimeEntryRow = {
  id: string;
  worked_on: string;
  hours: number;
  note: string | null;
  source: "manual" | "voice";
  created_at: string;
};

export type TimeEntryResult =
  | { error: string; entry?: never }
  | { error: null; entry: TimeEntryRow };

export type LogTimeInput = {
  quoteId: string;
  workedOn: string; // ISO date string, e.g. "2026-07-23"
  hours: number;
  note?: string | null;
  source?: "manual" | "voice";
};

async function resolveJobIdForQuote(
  supabase: Awaited<ReturnType<typeof createClient>>,
  quoteId: string,
): Promise<{ jobId: string | null; error: string | null }> {
  const { data: job, error } = await supabase
    .from("scheduled_jobs")
    .select("id")
    .eq("quote_id", quoteId)
    .maybeSingle();
  if (error) {
    console.error("Failed to resolve scheduled job for quote:", error);
    return { jobId: null, error: "Auftrag konnte nicht gefunden werden." };
  }
  if (!job) {
    return { jobId: null, error: "Für diesen Auftrag wurde noch kein Termin geplant." };
  }
  return { jobId: job.id, error: null };
}

export async function logTimeEntry(input: LogTimeInput): Promise<TimeEntryResult> {
  const hoursCheck = validateHours(input.hours);
  if (hoursCheck.error) {
    return { error: hoursCheck.error };
  }
  const dateCheck = validateWorkedOn(input.workedOn);
  if (dateCheck.error) {
    return { error: dateCheck.error };
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

  const { jobId, error: jobError } = await resolveJobIdForQuote(supabase, input.quoteId);
  if (jobError || !jobId) {
    return { error: jobError ?? "Auftrag konnte nicht gefunden werden." };
  }

  const note = input.note?.trim() || null;

  const { data: entry, error: insertError } = await supabase
    .from("time_entries")
    .insert({
      organization_id: org.organizationId,
      job_id: jobId,
      user_id: user.id,
      worked_on: input.workedOn,
      hours: input.hours,
      note,
      source: input.source ?? "manual",
    })
    .select("id, worked_on, hours, note, source, created_at")
    .single();

  if (insertError || !entry) {
    console.error("Failed to insert time entry:", insertError);
    return { error: "Arbeitszeit konnte nicht gespeichert werden." };
  }

  return { error: null, entry };
}

export type ListTimeEntriesResult = {
  error: string | null;
  entries: TimeEntryRow[];
  totalHours: number;
};

/** Lists all time entries for the job behind a quote, plus their hours total. */
export async function listTimeEntries(quoteId: string): Promise<ListTimeEntriesResult> {
  const supabase = await createClient();

  const { jobId, error: jobError } = await resolveJobIdForQuote(supabase, quoteId);
  if (jobError || !jobId) {
    // No scheduled job yet is not an error state for this list -- just empty.
    return { error: null, entries: [], totalHours: 0 };
  }

  const { data, error } = await supabase
    .from("time_entries")
    .select("id, worked_on, hours, note, source, created_at")
    .eq("job_id", jobId)
    .order("worked_on", { ascending: false });

  if (error) {
    console.error("Failed to list time entries:", error);
    return { error: "Arbeitszeiten konnten nicht geladen werden.", entries: [], totalHours: 0 };
  }

  const entries = data ?? [];
  const totalHours = entries.reduce((sum, entry) => sum + Number(entry.hours), 0);

  return { error: null, entries, totalHours: Math.round(totalHours * 100) / 100 };
}

export type ExtractTimeEntryResult =
  | { error: string; hours?: never; note?: never }
  | { error: null; hours: number; note: string };

/**
 * Runs the transcript through the (much simpler than quote generation)
 * {hours, note} extraction call, so TimeEntryForm can prefill its fields for
 * the user to review/edit before saving -- never auto-saves.
 */
export async function extractTimeEntryFromTranscript(
  transcript: string,
): Promise<ExtractTimeEntryResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Bitte melde dich an." };
  }

  try {
    const extracted = await extractTimeEntry(transcript);
    return { error: null, hours: extracted.hours, note: extracted.note };
  } catch (err) {
    if (err instanceof TimeEntryExtractionError) {
      console.error("Time entry extraction failed:", err);
      return { error: "Konnte Stunden und Notiz nicht aus der Aufnahme erkennen." };
    }
    throw err;
  }
}

export async function deleteTimeEntry(
  entryId: string,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Bitte melde dich an." };
  }

  const { error } = await supabase.from("time_entries").delete().eq("id", entryId);
  if (error) {
    console.error("Failed to delete time entry:", error);
    return { error: "Eintrag konnte nicht gelöscht werden." };
  }
  return { error: null };
}
