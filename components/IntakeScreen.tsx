"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import VoiceRecorder from "./VoiceRecorder";
import {
  INTAKE_CATEGORY_LABELS,
  INTAKE_CATEGORY_ORDER,
  type LifeSkeleton,
} from "@/lib/types";

interface IntakeScreenProps {
  initialSkeleton: LifeSkeleton;
}

function formatSkeletonSummary(skeleton: LifeSkeleton): string[] {
  const lines: string[] = [];
  if (skeleton.birthDate || skeleton.birthPlace) {
    lines.push(`Born ${skeleton.birthDate ?? "date unknown"} in ${skeleton.birthPlace ?? "place unknown"}`);
  }
  for (const l of skeleton.locations) {
    lines.push(`Lived in ${l.place} (${l.approxStart ?? "?"}-${l.approxEnd ?? "?"})`);
  }
  for (const r of skeleton.relationships) {
    lines.push(`${r.name} - ${r.type} (${r.approxStart ?? "?"}-${r.approxEnd ?? "?"})`);
  }
  for (const t of skeleton.transitions) {
    lines.push(`${t.description}${t.approxDate ? ` (${t.approxDate})` : ""}`);
  }
  return lines;
}

export default function IntakeScreen({ initialSkeleton }: IntakeScreenProps) {
  const router = useRouter();
  const [categoryIndex, setCategoryIndex] = useState(0);
  const [skeleton, setSkeleton] = useState(initialSkeleton);
  const [question, setQuestion] = useState<string | null>(null);
  const [loadingQuestion, setLoadingQuestion] = useState(true);
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const category = INTAKE_CATEGORY_ORDER[categoryIndex];
  const isLastCategory = categoryIndex === INTAKE_CATEGORY_ORDER.length - 1;

  async function fetchQuestion() {
    setLoadingQuestion(true);
    setError(null);
    try {
      const res = await fetch(`/api/intake/question?category=${category}`);
      if (!res.ok) throw new Error("Failed to load question");
      const data = await res.json();
      setQuestion(data.question as string);
    } catch {
      setError("Couldn't load the next question. Try again in a moment.");
    } finally {
      setLoadingQuestion(false);
    }
  }

  useEffect(() => {
    queueMicrotask(() => {
      fetchQuestion();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryIndex]);

  async function submitAnswer() {
    if (!answer.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/intake/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rawText: answer }),
      });
      if (!res.ok) throw new Error("Failed to save answer");
      const data = await res.json();
      setSkeleton(data.skeleton as LifeSkeleton);
      setAnswer("");
      await fetchQuestion();
    } catch {
      setError("Couldn't save that answer. Your text is still in the box below - try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function nextSection() {
    if (isLastCategory) {
      setFinishing(true);
      setError(null);
      try {
        const res = await fetch("/api/intake/complete", { method: "POST" });
        if (!res.ok) throw new Error("Failed to complete intake");
        router.refresh();
      } catch {
        setError("Couldn't finish intake. Try again in a moment.");
        setFinishing(false);
      }
      return;
    }
    setAnswer("");
    setCategoryIndex((i) => i + 1);
  }

  const summary = formatSkeletonSummary(skeleton);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div>
        <p className="text-sm font-medium text-ink-soft">
          Getting the basic skeleton first ({categoryIndex + 1}/{INTAKE_CATEGORY_ORDER.length}) -{" "}
          {INTAKE_CATEGORY_LABELS[category]}
        </p>
      </div>

      <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
        {loadingQuestion || !question ? (
          <p className="text-ink-faint">Thinking of a question&hellip;</p>
        ) : (
          <p className="font-serif text-xl italic leading-relaxed text-ink">{question}</p>
        )}
      </div>

      <div className="relative">
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Type your answer, or record it below… rough and approximate is fine."
          rows={5}
          disabled={loadingQuestion}
          className="w-full resize-none rounded-2xl border border-border bg-card p-5 pb-14 text-[15px] text-ink placeholder:text-ink-faint focus:outline-none"
        />
        <div className="absolute bottom-2 left-2">
          <VoiceRecorder onTranscribed={(text) => setAnswer((prev) => (prev ? `${prev} ${text}` : text))} disabled={loadingQuestion} />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3">
        <button
          onClick={nextSection}
          disabled={finishing}
          className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-ink-soft hover:bg-border-soft disabled:opacity-50"
        >
          {finishing ? "Finishing…" : isLastCategory ? "Finish intake" : "Next section →"}
        </button>
        <button
          onClick={submitAnswer}
          disabled={submitting || loadingQuestion || !answer.trim()}
          className="rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-paper hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Submit answer"}
        </button>
      </div>

      {error && <p className="text-sm text-record">{error}</p>}

      {summary.length > 0 && (
        <div className="mt-2 border-t border-border-soft pt-4">
          <p className="mb-2 text-sm font-medium text-ink-soft">Captured so far</p>
          <ul className="flex flex-col gap-1 text-sm text-ink-soft">
            {summary.map((line, i) => (
              <li key={i}>- {line}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
