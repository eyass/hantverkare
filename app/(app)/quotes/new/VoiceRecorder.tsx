"use client";

import { useEffect, useRef, useState } from "react";
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
  const mimeTypeRef = useRef<string>("audio/webm");

  useEffect(() => {
    return () => {
      stopTimer();
      stopStream();
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.onstop = null;
        mediaRecorderRef.current.ondataavailable = null;
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

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

  function pickSupportedMimeType(): string | null {
    const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
    for (const candidate of candidates) {
      if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  async function handleRecordingComplete() {
    const blob = new Blob(chunksRef.current, { type: mimeTypeRef.current });
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
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      return;
    }
    setError(null);

    if (typeof MediaRecorder === "undefined") {
      setError("Sprachaufnahme wird in diesem Browser nicht unterstützt.");
      return;
    }

    const mimeType = pickSupportedMimeType();
    if (!mimeType) {
      setError("Sprachaufnahme wird in diesem Browser nicht unterstützt.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Mikrofonzugriff wurde verweigert.");
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];
    mimeTypeRef.current = mimeType;

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType });
    } catch (err) {
      console.error("Failed to create MediaRecorder:", err);
      setError("Sprachaufnahme wird in diesem Browser nicht unterstützt.");
      stopStream();
      return;
    }

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
    <div className="flex flex-col items-center gap-3 py-4">
      <div className="relative flex h-[150px] w-[150px] items-center justify-center">
        {isRecording && (
          <>
            <span
              className="voice-orb-ring absolute inset-0 rounded-full bg-[#2563eb]"
              style={{ animationDelay: "0s" }}
              aria-hidden="true"
            />
            <span
              className="voice-orb-ring absolute inset-0 rounded-full bg-[#2563eb]"
              style={{ animationDelay: "0.9s" }}
              aria-hidden="true"
            />
          </>
        )}
        <button
          type="button"
          onClick={isRecording ? stopRecording : startRecording}
          disabled={isTranscribing}
          aria-label={isRecording ? "Aufnahme stoppen" : "Aufnahme starten"}
          className="relative z-10 flex h-[130px] w-[130px] items-center justify-center rounded-full bg-[#2563eb] text-white shadow-[0_6px_16px_rgba(37,99,235,0.3)] transition-transform disabled:opacity-50 disabled:cursor-not-allowed hover:not-disabled:scale-[1.03]"
        >
          {isRecording ? (
            <span className="h-8 w-8 rounded-md bg-white" aria-hidden="true" />
          ) : (
            <svg
              viewBox="0 0 24 24"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="h-11 w-11"
              aria-hidden="true"
            >
              <path
                d="M12 15a3.5 3.5 0 0 0 3.5-3.5v-5a3.5 3.5 0 0 0-7 0v5A3.5 3.5 0 0 0 12 15Z"
                fill="white"
              />
              <path
                d="M6.5 11.5a5.5 5.5 0 0 0 11 0M12 17v3"
                stroke="white"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          )}
        </button>
      </div>
      <div className="flex flex-col items-center gap-1 text-center">
        {isRecording && (
          <span className="font-mono text-sm text-[#64748b]">{formatTime(seconds)}</span>
        )}
        {isTranscribing && (
          <span className="text-sm text-[#94a3b8]">Wird transkribiert…</span>
        )}
        {!isRecording && !isTranscribing && (
          <span className="text-sm text-[#94a3b8]">Tippen zum Aufnehmen</span>
        )}
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
