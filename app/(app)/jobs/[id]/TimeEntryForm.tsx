"use client";

// Manual timesheet entry form + a "Stattdessen aufnehmen" (record instead)
// voice path (issue #195). Reuses the existing VoiceRecorder + Whisper
// transcription component from the quote-creation flow (its transcribeAudio
// Server Action is a plain exported function, importable from here) rather
// than rewriting audio capture. After transcription, a lightweight AI call
// extracts {hours, note} to prefill the form -- the user always reviews and
// confirms before saving, so a wrong guess just means editing a field, not a
// silently-wrong timesheet entry.

import { useState, useTransition } from "react";
import { VoiceRecorder, type RecordedNote } from "@/app/(app)/quotes/new/VoiceRecorder";
import {
  logTimeEntry,
  extractTimeEntryFromTranscript,
  type TimeEntryRow,
} from "./time-entry-actions";

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

export function TimeEntryForm({
  quoteId,
  onEntryAdded,
}: {
  quoteId: string;
  onEntryAdded: (entry: TimeEntryRow) => void;
}) {
  const [mode, setMode] = useState<"form" | "voice">("form");
  const [workedOn, setWorkedOn] = useState(todayIsoDate());
  const [hours, setHours] = useState("");
  const [note, setNote] = useState("");
  const [source, setSource] = useState<"manual" | "voice">("manual");
  const [error, setError] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleVoiceNote(recorded: RecordedNote) {
    setError(null);
    setIsExtracting(true);
    const result = await extractTimeEntryFromTranscript(recorded.text);
    setIsExtracting(false);
    if (result.error !== null) {
      setError(result.error);
      // Fall back to letting the user type the note manually; still record
      // that it came from a voice attempt so they don't lose the transcript.
      setNote(recorded.text);
      setSource("voice");
      setMode("form");
      return;
    }
    setHours(String(result.hours));
    setNote(result.note);
    setSource("voice");
    setMode("form");
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const parsedHours = Number.parseFloat(hours.replace(",", "."));
    if (!Number.isFinite(parsedHours)) {
      setError("Bitte eine gültige Stundenzahl angeben.");
      return;
    }

    startTransition(async () => {
      const result = await logTimeEntry({
        quoteId,
        workedOn,
        hours: parsedHours,
        note: note.trim() || null,
        source,
      });
      if (result.error !== null) {
        setError(result.error);
        return;
      }
      onEntryAdded(result.entry);
      setHours("");
      setNote("");
      setSource("manual");
      setWorkedOn(todayIsoDate());
    });
  }

  if (mode === "voice") {
    return (
      <div className="flex flex-col gap-3 rounded-2xl border border-[#e9edf2] bg-white p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-[#0f172a]">Arbeitszeit aufnehmen</h3>
          <button
            type="button"
            onClick={() => setMode("form")}
            className="text-sm text-[#64748b] underline"
          >
            Abbrechen
          </button>
        </div>
        <p className="text-sm text-[#64748b]">
          Sag kurz, wie viele Stunden du gearbeitet hast und woran.
        </p>
        <VoiceRecorder onNoteRecorded={handleVoiceNote} />
        {isExtracting && (
          <p className="text-sm text-[#94a3b8]">Stunden und Notiz werden erkannt…</p>
        )}
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 rounded-2xl border border-[#e9edf2] bg-white p-4"
    >
      <h3 className="text-sm font-semibold text-[#0f172a]">Arbeitszeit erfassen</h3>
      {error && <p className="text-sm text-[#dc2626]">{error}</p>}
      <div className="flex flex-col gap-1">
        <label htmlFor="worked-on" className="text-xs font-medium text-[#64748b]">
          Datum
        </label>
        <input
          id="worked-on"
          type="date"
          value={workedOn}
          onChange={(event) => setWorkedOn(event.target.value)}
          required
          className="rounded-lg border border-[#e9edf2] px-3 py-2 text-sm text-[#0f172a]"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="hours" className="text-xs font-medium text-[#64748b]">
          Stunden
        </label>
        <input
          id="hours"
          type="number"
          step="0.25"
          min="0.25"
          max="24"
          inputMode="decimal"
          value={hours}
          onChange={(event) => setHours(event.target.value)}
          placeholder="z. B. 3.5"
          required
          className="rounded-lg border border-[#e9edf2] px-3 py-2 text-sm text-[#0f172a]"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="note" className="text-xs font-medium text-[#64748b]">
          Notiz (optional)
        </label>
        <textarea
          id="note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={2}
          className="rounded-lg border border-[#e9edf2] px-3 py-2 text-sm text-[#0f172a]"
        />
      </div>
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 rounded-full bg-[#2563eb] px-5 py-2.5 text-sm font-medium text-white shadow-[0_6px_16px_rgba(37,99,235,0.3)] transition-colors hover:bg-[#1d4ed8] disabled:opacity-50"
        >
          {isPending ? "Wird gespeichert…" : "Speichern"}
        </button>
        <button
          type="button"
          onClick={() => setMode("voice")}
          className="rounded-full border border-[#e9edf2] px-5 py-2.5 text-sm font-medium text-[#0f172a] transition-colors hover:bg-[#f8fafc]"
        >
          Stattdessen aufnehmen
        </button>
      </div>
    </form>
  );
}
