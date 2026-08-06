"use client";

import { useRef, useState } from "react";

interface VoiceRecorderProps {
  onTranscribed: (text: string) => void;
  disabled?: boolean;
}

export default function VoiceRecorder({ onTranscribed, disabled }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function startRecording() {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await sendForTranscription(blob);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      setError("Couldn't access the microphone. Check browser permissions.");
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  }

  async function sendForTranscription(blob: Blob) {
    setTranscribing(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("audio", blob, "answer.webm");
      const res = await fetch("/api/transcribe", { method: "POST", body: formData });
      if (!res.ok) throw new Error("Transcription failed");
      const data = await res.json();
      onTranscribed(data.text as string);
    } catch {
      setError("Transcription failed. Try again, or type your answer instead.");
    } finally {
      setTranscribing(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        disabled={disabled || transcribing}
        onClick={recording ? stopRecording : startRecording}
        className={`rounded-full px-4 py-2 text-sm font-medium transition ${
          recording
            ? "bg-red-600 text-white hover:bg-red-700"
            : "bg-neutral-800 text-white hover:bg-neutral-700"
        } disabled:opacity-50`}
      >
        {recording ? "Stop recording" : transcribing ? "Transcribing…" : "Record answer"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
