# Voice-to-Text Job Description Capture — Design Spec

## Context

Closes [issue #6](https://github.com/eyass/hantverkare/issues/6). Matches Bliqat's core
"describe the job in 30 seconds" flow: a tradesperson records a spoken job description
on-site instead of typing, which feeds into the existing `/quotes/new` generation flow
(shipped and auth-scoped).

Per the project's current standing override (`.harness/LOOP.md` SCOPE phase), this spec
was written by deciding every scope question autonomously rather than asking — each
decision below is documented with its reasoning, the way a clarifying-question answer
would be, so the choice is auditable even though it wasn't asked.

## Decisions made autonomously

- **Recording surface: in-browser via the MediaRecorder API.** No native/mobile app
  exists for this project — the web app is the only client, so browser-based recording
  is the only option that doesn't require building a new platform.
- **Transcription provider: OpenAI's Whisper API (`whisper-1`).** Claude's API is
  text-only (no audio input), so a dedicated speech-to-text service is required.
  Whisper has strong German transcription quality, a simple REST API, and is
  cost-effective for short recordings — a reasonable default without needing to
  evaluate every STT vendor for a first version of this feature.
- **Transcript lands in the existing editable textarea, not auto-submitted.** Keeps
  the same "review before you generate a quote" pattern the typed-description flow
  already has (and that generateQuoteDraft already expects) — the transcript pre-fills
  the field, the tradesperson can fix any misheard words, then submits exactly like
  today.
- **Risk tier: T3.** Adding `OPENAI_API_KEY` is a new secret/env var, which
  `.harness/RISK-TIERS.md`'s routing rules place at T3 regardless of how small the
  feature otherwise is.
- **Max recording length: 120 seconds, enforced client-side (auto-stop).** Bounds
  upload size and Whisper API cost per request; well beyond what a 30-second job
  description needs, per Bliqat's own framing of the flow.
- **Audio format: `audio/webm;codecs=opus`**, the MediaRecorder default in Chromium
  and Firefox and a format Whisper accepts directly — no client-side transcoding needed.
- **No database changes.** Recordings aren't stored — audio is captured, transcribed,
  and discarded once the transcript lands in the textarea. Only the resulting text
  (typed or transcribed) is ever persisted, exactly as today.

## Out of scope

- Server-side audio storage/retention (transcribe-and-discard only)
- Any transcription provider other than Whisper (no multi-provider abstraction — YAGNI
  for a first version)
- Auto-submitting the quote generation immediately after transcription (explicitly
  decided against above)
- Mobile/native app recording (no such app exists in this project)

## Architecture

- A new client component `VoiceRecorder` rendered inside `app/quotes/new/page.tsx`
  (currently a server component — this addition requires no server-side change to that
  file itself, just embedding the new client component alongside the existing form).
- `VoiceRecorder` uses `navigator.mediaDevices.getUserMedia({ audio: true })` +
  `MediaRecorder` to record. A record/stop button toggles state; a visible timer counts
  up and auto-stops at 120s.
- On stop, the recorded `Blob` is sent to a new Server Action `transcribeAudio` (in
  `app/quotes/new/actions.ts`, alongside the existing `generateQuoteDraft`) via
  `FormData` (Server Actions can accept `File`/`Blob` data in `FormData`, no separate
  API route needed).
- `transcribeAudio` sends the audio to OpenAI's Whisper API (`POST
  https://api.openai.com/v1/audio/transcriptions`, `model=whisper-1`,
  `language=de` since the app is German-market-only), returns the transcript text (or
  an error).
- The existing `<textarea name="description">` on `/quotes/new` becomes a controlled
  input shared between the typed-text path and the voice path: recording success sets
  its value to the transcript (editable afterward), exactly like typing would have.

## Data flow

1. Tradesperson clicks "Aufnehmen" (record). Browser prompts for mic permission if not
   already granted.
2. Recording starts; a visible timer counts up; clicking "Stopp" (or hitting 120s)
   ends recording and produces a `Blob`.
3. The Server Action `transcribeAudio` receives the blob, forwards it to Whisper,
   returns `{ text: string } | { error: string }`.
4. On success, the textarea's value is set to the transcript; the tradesperson can edit
   it before clicking "Angebot erstellen" (unchanged existing button/flow).
5. On failure, an inline error shows next to the recorder; the textarea is left
   untouched (whatever was there before, typed or blank, stays).

## Error handling

- **Mic permission denied**: `getUserMedia` rejects — show an inline error ("Mikrofonzugriff
  wurde verweigert.") without attempting to record.
- **No mic available** (e.g. desktop without one): same inline-error path, generic
  message since the browser doesn't reliably distinguish "denied" from "not present."
- **Recording produces silence/empty transcript**: Whisper may return an empty or
  near-empty string; treat a transcript that's empty after trimming as an error
  ("Keine Sprache erkannt, bitte erneut versuchen.") rather than silently clearing the
  textarea.
- **Whisper API failure** (network, auth, rate limit): caught server-side, logged with
  `console.error`, generic German error returned to the client — matches the existing
  `QuoteGenerationError` handling pattern in `generateQuoteDraft`.
- **Recording auto-stopped at 120s**: not an error — the partial recording is still
  transcribed and used normally.

## Testing

- No pure/deterministic logic exists to unit test here beyond trivial timer-formatting
  (e.g. seconds → `mm:ss`) — small enough not to warrant a dedicated test file; a single
  inline test for that formatting function is enough if it ends up being more than a
  one-liner.
- Manual end-to-end QA via the browser skill: grant mic permission, record a short
  German job description, confirm the transcript populates the textarea correctly and
  the existing generate-quote flow still works from there; test the permission-denied
  path; test hitting the 120s auto-stop.
