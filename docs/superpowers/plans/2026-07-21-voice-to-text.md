# Voice-to-Text Capture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A tradesperson can record a spoken job description in the browser on `/quotes/new`; it's transcribed via OpenAI's Whisper API and populates the existing description textarea, editable before submitting exactly like typed text.

**Architecture:** A new client component `VoiceRecorder` (MediaRecorder API, 120s auto-stop) sends the recorded audio blob to a new Server Action `transcribeAudio`, which forwards it to Whisper and returns the transcript. The transcript is written directly into the existing textarea via a ref, so the unmodified `generateQuoteDraft` action and form submission continue to work unchanged.

**Tech Stack:** Next.js (App Router, Server Actions) · TypeScript · Browser MediaRecorder API · OpenAI Whisper API (`whisper-1`)

---

## File Structure

Created by this plan:
- `app/quotes/new/VoiceRecorder.tsx` — client component: record/stop button, timer, calls `transcribeAudio`

Modified:
- `app/quotes/new/actions.ts` — add `transcribeAudio` Server Action alongside the existing `generateQuoteDraft`
- `app/quotes/new/page.tsx` — add a ref to the textarea, render `<VoiceRecorder>`, wire its transcript callback to set the textarea's value
- `.env.example`, `.github/workflows/ci.yml` — add `OPENAI_API_KEY`

---

## Task 1: `.env.example` + CI wiring for `OPENAI_API_KEY`

**Files:**
- Modify: `.env.example`
- Modify: `.github/workflows/ci.yml`

This adds a new secret/env var — per `.harness/RISK-TIERS.md` this is **T3**. Note: per the project's current standing overrides (`.harness/LOOP.md`), this proceeds straight through without a plan-approval or merge gate; explicit human involvement is still needed to supply the actual OpenAI API key value (a credential only the human can provide), which happens in Task 5's manual QA, not here.

- [ ] **Step 1: Add the env var**

In `.env.example`, append:
```
# OpenAI — from https://platform.openai.com/api-keys. Used for Whisper (speech-to-text).
OPENAI_API_KEY=
```

- [ ] **Step 2: Add a dummy value to CI**

In `.github/workflows/ci.yml`, under the `quality` job's `env:` block, add `OPENAI_API_KEY: dummy-key-for-ci` alongside the existing dummy values:
```yaml
    env:
      NEXT_PUBLIC_SUPABASE_URL: https://example.supabase.co
      NEXT_PUBLIC_SUPABASE_ANON_KEY: dummy-anon-key-for-ci-build
      ANTHROPIC_API_KEY: dummy-key-for-ci
      NEXT_PUBLIC_SITE_URL: http://localhost:3000
      OPENAI_API_KEY: dummy-key-for-ci
```

- [ ] **Step 3: Verify locally**

Run: `npm run build`
Expected: "Compiled successfully", exit code 0 (this task doesn't reference the env var in code yet, so nothing should behave differently — this step just confirms nothing else broke).

- [ ] **Step 4: Commit**

```bash
git add .env.example .github/workflows/ci.yml
git commit -m "ci: document OPENAI_API_KEY for Whisper transcription"
```

---

## Task 2: `transcribeAudio` Server Action

**Files:**
- Modify: `app/quotes/new/actions.ts`

- [ ] **Step 1: Append the new action**

The current end of `app/quotes/new/actions.ts` (after the existing `generateQuoteDraft` function's closing brace) gets this appended:
```ts

export type TranscribeResult = { error: string; text?: never } | { error: null; text: string };

export async function transcribeAudio(formData: FormData): Promise<TranscribeResult> {
  const audio = formData.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return { error: "Keine Aufnahme empfangen." };
  }

  const whisperFormData = new FormData();
  whisperFormData.set("file", audio, "recording.webm");
  whisperFormData.set("model", "whisper-1");
  whisperFormData.set("language", "de");

  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: whisperFormData,
    });
  } catch (err) {
    console.error("Whisper API request failed:", err);
    return { error: "Transkription fehlgeschlagen. Bitte versuche es erneut." };
  }

  if (!response.ok) {
    const errorBody = await response.text();
    console.error("Whisper API error:", response.status, errorBody);
    return { error: "Transkription fehlgeschlagen. Bitte versuche es erneut." };
  }

  const data = await response.json();
  const text = typeof data.text === "string" ? data.text.trim() : "";
  if (text.length === 0) {
    return { error: "Keine Sprache erkannt, bitte erneut versuchen." };
  }

  return { error: null, text };
}
```

No new imports needed — `fetch`, `FormData`, and `Blob` are all globally available in the Next.js server runtime.

- [ ] **Step 2: Verify the build passes**

Run: `npm run build`
Expected: "Compiled successfully", exit code 0.

- [ ] **Step 3: Commit**

```bash
git add app/quotes/new/actions.ts
git commit -m "feat: add transcribeAudio Server Action (Whisper API)"
```

---

## Task 3: `VoiceRecorder` client component

**Files:**
- Create: `app/quotes/new/VoiceRecorder.tsx`

- [ ] **Step 1: Create the component**

Create `app/quotes/new/VoiceRecorder.tsx`:
```tsx
"use client";

import { useRef, useState } from "react";
import { transcribeAudio } from "./actions";

const MAX_RECORDING_SECONDS = 120;

export function VoiceRecorder({ onTranscript }: { onTranscript: (text: string) => void }) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  function stopTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function stopStream() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  async function handleRecordingComplete() {
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    chunksRef.current = [];
    setIsTranscribing(true);
    setError(null);

    const formData = new FormData();
    formData.set("audio", blob, "recording.webm");

    const result = await transcribeAudio(formData);
    setIsTranscribing(false);

    if (result.error !== null) {
      setError(result.error);
      return;
    }
    onTranscript(result.text);
  }

  async function startRecording() {
    setError(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Mikrofonzugriff wurde verweigert.");
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };
    recorder.onstop = () => {
      stopStream();
      stopTimer();
      handleRecordingComplete();
    };
    mediaRecorderRef.current = recorder;
    recorder.start();
    setIsRecording(true);
    setSeconds(0);

    timerRef.current = setInterval(() => {
      setSeconds((prev) => {
        const next = prev + 1;
        if (next >= MAX_RECORDING_SECONDS) {
          mediaRecorderRef.current?.stop();
        }
        return next;
      });
    }, 1000);
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setIsRecording(false);
  }

  function formatTime(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isTranscribing}
          className="rounded-full border border-zinc-300 px-4 py-2 text-sm disabled:opacity-50 dark:border-zinc-700"
        >
          {isRecording ? "Stopp" : "🎤 Aufnehmen"}
        </button>
        {isRecording && (
          <span className="text-sm text-zinc-600 dark:text-zinc-400">{formatTime(seconds)}</span>
        )}
        {isTranscribing && (
          <span className="text-sm text-zinc-600 dark:text-zinc-400">Wird transkribiert…</span>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Verify the build passes**

Run: `npm run build`
Expected: "Compiled successfully", exit code 0.

- [ ] **Step 3: Commit**

```bash
git add app/quotes/new/VoiceRecorder.tsx
git commit -m "feat: add VoiceRecorder client component"
```

---

## Task 4: Wire `VoiceRecorder` into `/quotes/new`

**Files:**
- Modify: `app/quotes/new/page.tsx`

- [ ] **Step 1: Update the page**

The current `app/quotes/new/page.tsx` is:
```tsx
"use client";

import { useActionState } from "react";
import { generateQuoteDraft, type GenerateQuoteState } from "./actions";

const initialState: GenerateQuoteState = { error: null };

export default function NewQuotePage() {
  const [state, formAction, isPending] = useActionState(generateQuoteDraft, initialState);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">Neues Angebot</h1>
      <form action={formAction} className="flex flex-col gap-4">
        <label htmlFor="description" className="text-sm font-medium">
          Auftragsbeschreibung
        </label>
        <textarea
          id="description"
          name="description"
          required
          rows={6}
          maxLength={2000}
          placeholder="Beschreibe den Auftrag, z. B. Küchenspüle austauschen, neuen Wasserhahn montieren, 2 Stunden Arbeit"
          className="w-full rounded-md border border-zinc-300 p-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          type="submit"
          disabled={isPending}
          className="self-start rounded-full bg-foreground px-5 py-3 text-background disabled:opacity-50"
        >
          {isPending ? "Angebot wird erstellt…" : "Angebot erstellen"}
        </button>
      </form>
    </div>
  );
}
```

Replace it with:
```tsx
"use client";

import { useActionState, useRef } from "react";
import { generateQuoteDraft, type GenerateQuoteState } from "./actions";
import { VoiceRecorder } from "./VoiceRecorder";

const initialState: GenerateQuoteState = { error: null };

export default function NewQuotePage() {
  const [state, formAction, isPending] = useActionState(generateQuoteDraft, initialState);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleTranscript(text: string) {
    if (textareaRef.current) {
      textareaRef.current.value = text;
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-8">
      <h1 className="text-2xl font-semibold">Neues Angebot</h1>
      <form action={formAction} className="flex flex-col gap-4">
        <label htmlFor="description" className="text-sm font-medium">
          Auftragsbeschreibung
        </label>
        <textarea
          ref={textareaRef}
          id="description"
          name="description"
          required
          rows={6}
          maxLength={2000}
          placeholder="Beschreibe den Auftrag, z. B. Küchenspüle austauschen, neuen Wasserhahn montieren, 2 Stunden Arbeit"
          className="w-full rounded-md border border-zinc-300 p-3 text-base dark:border-zinc-700 dark:bg-zinc-900"
        />
        <VoiceRecorder onTranscript={handleTranscript} />
        {state.error && <p className="text-sm text-red-600">{state.error}</p>}
        <button
          type="submit"
          disabled={isPending}
          className="self-start rounded-full bg-foreground px-5 py-3 text-background disabled:opacity-50"
        >
          {isPending ? "Angebot wird erstellt…" : "Angebot erstellen"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 2: Verify the build passes**

Run: `npm run build`
Expected: "Compiled successfully", exit code 0.

- [ ] **Step 3: Commit**

```bash
git add app/quotes/new/page.tsx
git commit -m "feat: wire VoiceRecorder into /quotes/new"
```

---

## Task 5: Manual end-to-end QA

Requires a real `OPENAI_API_KEY` in `.env.local` — ask the human for one if not already
present (same pattern as the Anthropic and Supabase keys: a credential only the human
can supply, not a design choice).

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Using the browser skill, navigate to `http://localhost:3000/quotes/new` (already
authenticated from prior QA, or sign in first).
Expected: page loads with the existing textarea plus a new "🎤 Aufnehmen" button below it.

- [ ] **Step 2: Record and transcribe a job description**

Click "Aufnehmen", grant microphone permission if prompted, speak a short German job
description (e.g. "Küchenspüle austauschen, neuen Wasserhahn montieren"), click "Stopp".
Expected: a "Wird transkribiert…" indicator appears briefly, then the textarea's value
updates to the transcript. No page reload occurs.

- [ ] **Step 3: Confirm the transcript is editable and submits normally**

Edit the transcribed text slightly, then click "Angebot erstellen".
Expected: behaves exactly like the typed-text flow — quote generates and redirects to
`/quotes/[id]`, same as before this feature existed.

- [ ] **Step 4: Test the permission-denied path**

Using the browser skill's ability to deny permission prompts (or a fresh
browser-profile/site-settings reset to force the prompt again), deny microphone access
when clicking "Aufnehmen".
Expected: inline error "Mikrofonzugriff wurde verweigert." appears; no crash; the
textarea is untouched.

- [ ] **Step 5: Test the 120-second auto-stop**

Start a recording and let it run without manually stopping.
Expected: recording automatically stops at 2:00 (visible in the timer), transcription
proceeds normally with whatever audio was captured.
