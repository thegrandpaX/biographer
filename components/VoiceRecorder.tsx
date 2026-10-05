"use client";

import { useEffect, useRef, useState } from "react";

interface VoiceRecorderProps {
  onTranscribed: (text: string) => void;
  disabled?: boolean;
}

// The Web Speech API has no official TypeScript lib types and its
// constructor is still vendor-prefixed in some browsers - minimal local
// typing for just what this component uses.
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionErrorEventLike {
  error: string;
}

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionConstructor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const IGNORED_ERRORS = new Set(["no-speech", "aborted"]);

export default function VoiceRecorder({ onTranscribed, disabled }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [interimText, setInterimText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const manualStopRef = useRef(false);

  useEffect(() => {
    return () => {
      manualStopRef.current = true;
      recognitionRef.current?.stop();
    };
  }, []);

  function startRecording() {
    setError(null);
    const SpeechRecognitionCtor = getSpeechRecognitionConstructor();
    if (!SpeechRecognitionCtor) {
      setError("Voice input isn't supported in this browser - try Chrome or Edge, or type your answer instead.");
      return;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = navigator.language || "en-US";

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0].transcript;
        if (result.isFinal) {
          onTranscribed(transcript.trim());
        } else {
          interim += transcript;
        }
      }
      setInterimText(interim);
    };

    recognition.onerror = (event) => {
      if (IGNORED_ERRORS.has(event.error)) return;
      setError(
        event.error === "not-allowed" || event.error === "service-not-allowed"
          ? "Microphone access was blocked. Check browser permissions."
          : "Voice recognition hit a snag. Try again, or type your answer instead."
      );
    };

    recognition.onend = () => {
      setInterimText("");
      // Some browsers end recognition after a pause even in continuous
      // mode - keep listening until the user actually clicks stop.
      if (manualStopRef.current) {
        setRecording(false);
        return;
      }
      try {
        recognition.start();
      } catch {
        setRecording(false);
      }
    };

    manualStopRef.current = false;
    recognitionRef.current = recognition;
    recognition.start();
    setRecording(true);
  }

  function stopRecording() {
    manualStopRef.current = true;
    recognitionRef.current?.stop();
  }

  return (
    <div className="flex items-center gap-[18px]">
      <button
        type="button"
        disabled={disabled}
        onClick={recording ? stopRecording : startRecording}
        aria-label={recording ? "Stop recording" : "Start recording"}
        title={recording ? "Stop recording" : "Start recording"}
        className={`flex h-[72px] w-[72px] flex-none items-center justify-center rounded-full transition disabled:opacity-50 ${
          recording
            ? "bg-record text-paper shadow-[0_0_0_8px_rgba(229,83,61,0.16)]"
            : "bg-accent text-on-accent shadow-[0_0_0_8px_var(--accent-glow-soft)]"
        }`}
      >
        {recording ? (
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <rect x="6" y="6" width="12" height="12" rx="2" />
          </svg>
        ) : (
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <rect x="9" y="2" width="6" height="12" rx="3" />
            <path d="M5 11a7 7 0 0 0 14 0" />
            <path d="M12 18v4" />
          </svg>
        )}
      </button>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-lg font-semibold">{recording ? "Listening… tap to stop" : "Tap to talk"}</span>
        <span className="text-sm text-ink-soft">
          Your words appear below as you speak. Edit anything before saving.
        </span>
        {interimText && <span className="text-sm italic text-ink-faint">{interimText}</span>}
        {error && <span className="text-sm text-record">{error}</span>}
      </div>
    </div>
  );
}
