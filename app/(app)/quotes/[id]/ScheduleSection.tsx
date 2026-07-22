"use client";

// "Termin planen" section (issue #124): only rendered for signed quotes (see
// QuoteEditor.tsx). Deliberately simple date + time inputs rather than a
// drag-and-drop calendar widget -- this feature is explicitly scoped as
// lightweight, not a dispatch board.

import { useState, useTransition } from "react";
import { scheduleJob, cancelScheduledJob } from "./scheduling-actions";

type ScheduledJob = {
  id: string;
  scheduled_start: string;
  scheduled_end: string | null;
  notes: string | null;
};

function toDateInputValue(iso: string): string {
  const d = new Date(iso);
  return d.toISOString().slice(0, 10);
}

function toTimeInputValue(iso: string): string {
  const d = new Date(iso);
  return d.toTimeString().slice(0, 5);
}

function combineDateAndTime(date: string, time: string): string {
  // Both inputs are local browser time; letting `new Date` parse
  // "YYYY-MM-DDTHH:mm" interprets it in the browser's local timezone, which
  // is then converted to UTC via toISOString() server-side before storage.
  // There is no explicit per-organization timezone concept in this app yet
  // (out of scope for #124 -- see PR description), so this simply uses
  // whatever timezone the browser/server default to.
  return `${date}T${time}`;
}

export function ScheduleSection({
  quoteId,
  job: initialJob,
}: {
  quoteId: string;
  job: ScheduledJob | null;
}) {
  const [job, setJob] = useState(initialJob);
  const [date, setDate] = useState(job ? toDateInputValue(job.scheduled_start) : "");
  const [startTime, setStartTime] = useState(job ? toTimeInputValue(job.scheduled_start) : "");
  const [endTime, setEndTime] = useState(job?.scheduled_end ? toTimeInputValue(job.scheduled_end) : "");
  const [notes, setNotes] = useState(job?.notes ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    if (!date || !startTime) {
      setError("Bitte Datum und Uhrzeit angeben.");
      return;
    }
    const scheduledStart = combineDateAndTime(date, startTime);
    const scheduledEnd = endTime ? combineDateAndTime(date, endTime) : null;

    startTransition(async () => {
      const result = await scheduleJob(quoteId, {
        scheduledStart,
        scheduledEnd,
        notes,
      });
      if (result.error !== null) {
        setError(result.error);
        return;
      }
      setError(null);
      setJob(result.job);
    });
  }

  function handleCancel() {
    startTransition(async () => {
      const result = await cancelScheduledJob(quoteId);
      if (result.error !== null) {
        setError(result.error);
        return;
      }
      setError(null);
      setJob(null);
      setDate("");
      setStartTime("");
      setEndTime("");
      setNotes("");
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#e9edf2] bg-[#f8fafc] p-4">
      <h2 className="text-sm font-semibold text-[#0f172a]">Termin planen</h2>
      <p className="text-xs text-[#64748b]">
        Wann findet der Auftrag vor Ort statt? Der Kunde erhält am Vortag automatisch eine Erinnerung.
      </p>

      {error && <p className="text-sm text-[#dc2626]">{error}</p>}

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3">
        <label className="flex flex-col gap-1 text-xs text-[#64748b]">
          Datum
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            disabled={isPending}
            className="rounded-xl border border-[#e9edf2] bg-white p-2.5 text-sm text-[#0f172a] outline-none focus:border-[#2563eb] disabled:opacity-50"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[#64748b]">
          Start
          <input
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            disabled={isPending}
            className="rounded-xl border border-[#e9edf2] bg-white p-2.5 text-sm text-[#0f172a] outline-none focus:border-[#2563eb] disabled:opacity-50"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-[#64748b]">
          Ende (optional)
          <input
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            disabled={isPending}
            className="rounded-xl border border-[#e9edf2] bg-white p-2.5 text-sm text-[#0f172a] outline-none focus:border-[#2563eb] disabled:opacity-50"
          />
        </label>
      </div>

      <input
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        placeholder="Notiz (optional), z. B. Zugang zum Objekt"
        disabled={isPending}
        className="w-full rounded-xl border border-[#e9edf2] bg-white p-2.5 text-sm text-[#0f172a] outline-none focus:border-[#2563eb] disabled:opacity-50"
      />

      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="rounded-full bg-[#2563eb] px-5 py-2.5 text-sm font-medium text-white shadow-[0_6px_16px_rgba(37,99,235,0.3)] transition-colors hover:bg-[#1d4ed8] disabled:opacity-50"
        >
          {job ? "Termin aktualisieren" : "Termin speichern"}
        </button>
        {job && (
          <button
            onClick={handleCancel}
            disabled={isPending}
            className="rounded-full border border-[#e9edf2] bg-white px-5 py-2.5 text-sm font-medium text-[#0f172a] transition-colors hover:bg-[#f4f6f8] disabled:opacity-50"
          >
            Termin stornieren
          </button>
        )}
      </div>
    </div>
  );
}
