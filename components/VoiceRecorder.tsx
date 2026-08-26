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
    <div className="relative">
      {(interimText || error) && (
        <div className="absolute bottom-full left-0 mb-1.5 w-max max-w-[240px]">
          {interimText && <p className="text-xs italic text-ink-faint">{interimText}</p>}
          {error && <p className="text-xs text-record">{error}</p>}
        </div>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={recording ? stopRecording : startRecording}
        aria-label={recording ? "Stop recording" : "Record answer"}
        title={recording ? "Stop recording" : "Record answer"}
        className={`flex h-[38px] w-[38px] items-center justify-center rounded-full transition disabled:opacity-50 ${
          recording ? "bg-accent-soft" : "hover:bg-border-soft"
        }`}
      >
        <svg
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          stroke={recording ? "var(--record)" : "var(--accent)"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
          <path d="M19 10v1a7 7 0 0 1-14 0v-1" />
          <line x1="12" y1="18" x2="12" y2="22" />
        </svg>
      </button>
    </div>
  );
}
