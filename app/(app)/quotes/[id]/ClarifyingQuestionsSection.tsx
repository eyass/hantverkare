"use client";

import { useState, useTransition } from "react";
import { VoiceRecorder, type RecordedNote } from "../new/VoiceRecorder";
import { regenerateQuoteDraft, resolveClarifyingQuestions } from "./actions";

/**
 * Shown on the quote draft/review screen when the AI returned clarifying
 * questions instead of silently guessing at a missing critical detail
 * (issue #194). Reuses the existing VoiceRecorder + text-input pattern from
 * app/(app)/quotes/new/ rather than inventing a new capture UI -- the
 * follow-up answer is appended to the original description and the draft
 * is regenerated from the combined text.
 */
export function ClarifyingQuestionsSection({
  quoteId,
  questions,
}: {
  quoteId: string;
  questions: string[];
}) {
  const [resolved, setResolved] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (resolved || questions.length === 0) {
    return null;
  }

  function handleNoteRecorded(note: RecordedNote) {
    setText((prev) => (prev ? `${prev}\n\n${note.text}` : note.text));
  }

  function handleSkip() {
    setError(null);
    startTransition(async () => {
      const result = await resolveClarifyingQuestions(quoteId);
      if (result.error) {
        setError(result.error);
        return;
      }
      setResolved(true);
    });
  }

  function handleSubmit() {
    if (text.trim().length === 0) {
      setError("Bitte ergänze eine Beschreibung oder nimm eine Sprachnotiz auf.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await regenerateQuoteDraft(quoteId, text);
      if (result.error !== null) {
        setError(result.error);
        return;
      }
      setIsAdding(false);
      setText("");
      if (result.clarifyingQuestions.length === 0) {
        setResolved(true);
      }
      // A refresh picks up the updated line items/totals/questions from the
      // server (revalidatePath already ran in the action).
      window.location.reload();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-[#fde68a] bg-[#fffbeb] p-4">
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-[#92400e]">
          Die KI hat ein paar Rückfragen, um das Angebot genauer zu machen:
        </span>
        <ul className="list-disc pl-5 text-sm text-[#78350f]">
          {questions.map((question, index) => (
            <li key={index}>{question}</li>
          ))}
        </ul>
      </div>

      {error && <p className="text-sm text-[#dc2626]">{error}</p>}

      {isAdding ? (
        <div className="flex flex-col gap-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Details ergänzen, z. B. 6 Quadratmeter, oder Sprachnotiz aufnehmen"
            rows={3}
            className="w-full rounded-xl border border-[#e9edf2] bg-white p-3 text-sm text-[#0f172a] placeholder:text-[#94a3b8] focus:border-[#2563eb] focus:outline-none"
          />
          <VoiceRecorder onNoteRecorded={handleNoteRecorded} />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isPending}
              className="rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {isPending ? "Wird aktualisiert…" : "Angebot aktualisieren"}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAdding(false);
                setText("");
                setError(null);
              }}
              disabled={isPending}
              className="rounded-lg border border-[#e9edf2] px-4 py-2 text-sm font-medium text-[#0f172a] disabled:opacity-50"
            >
              Abbrechen
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setIsAdding(true)}
            disabled={isPending}
            className="rounded-lg bg-[#2563eb] px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            Details ergänzen
          </button>
          <button
            type="button"
            onClick={handleSkip}
            disabled={isPending}
            className="rounded-lg border border-[#e9edf2] bg-white px-4 py-2 text-sm font-medium text-[#0f172a] disabled:opacity-50"
          >
            {isPending ? "Wird gespeichert…" : "Überspringen — meine Schätzung verwenden"}
          </button>
        </div>
      )}
    </div>
  );
}
