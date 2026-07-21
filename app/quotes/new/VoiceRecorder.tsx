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
