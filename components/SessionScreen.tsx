"use client";

import { useEffect, useState } from "react";
import QuestionCard from "./QuestionCard";
import VoiceRecorder from "./VoiceRecorder";
import type { Fragment, SavedQuestion, ThemeKey } from "@/lib/types";

interface PendingQuestion {
  question: string;
  targetPeriodId: string;
  targetTheme: ThemeKey;
  followUp: boolean;
}

export default function SessionScreen() {
  const [pending, setPending] = useState<PendingQuestion | null>(null);
  const [loadingQuestion, setLoadingQuestion] = useState(true);
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sessionFragments, setSessionFragments] = useState<Fragment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [directedMode, setDirectedMode] = useState(false);
  const [savedCount, setSavedCount] = useState(0);
  const [viewingSaved, setViewingSaved] = useState<SavedQuestion | null>(null);

  async function fetchNextQuestion(forceEngine = false) {
    setLoadingQuestion(true);
    setError(null);
    try {
      const res = await fetch(`/api/session/question${forceEngine ? "?mode=engine" : ""}`);
      if (!res.ok) throw new Error("Failed to get a question");
      const data = (await res.json()) as PendingQuestion;
      setPending(data);
    } catch {
      setError("Couldn't load the next question. Try again in a moment.");
    } finally {
      setLoadingQuestion(false);
    }
  }

  async function refreshSavedCount() {
    try {
      const res = await fetch("/api/saved-questions");
      if (!res.ok) return;
      const data = await res.json();
      setSavedCount((data.savedQuestions as SavedQuestion[]).length);
    } catch {
      // non-critical - just leave the count as-is
    }
  }

  useEffect(() => {
    // Deferred a tick so the initial loading-state update doesn't happen
    // synchronously within the effect body.
    queueMicrotask(() => {
      fetchNextQuestion();
      refreshSavedCount();
    });
  }, []);

  async function submitAnswer() {
    if (!answer.trim()) return;
    if (!directedMode && !viewingSaved && !pending) return;
    setSubmitting(true);
    setError(null);
    try {
      const payload = viewingSaved
        ? {
            rawText: answer,
            sourceQuestion: viewingSaved.question,
            targetPeriodId: viewingSaved.targetPeriodId,
            targetTheme: viewingSaved.targetTheme,
            selfDirected: viewingSaved.followUp,
            savedQuestionId: viewingSaved.id,
          }
        : directedMode
          ? { rawText: answer, selfDirected: true }
          : {
              rawText: answer,
              sourceQuestion: pending!.question,
              targetPeriodId: pending!.targetPeriodId,
              targetTheme: pending!.targetTheme,
              // Answering a follow-up continues the same thread.
              selfDirected: pending!.followUp,
            };

      const res = await fetch("/api/session/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save answer");
      const data = await res.json();
      setSessionFragments((prev) => [data.fragment as Fragment, ...prev]);
      setAnswer("");
      setDirectedMode(false);
      if (viewingSaved) {
        setViewingSaved(null);
        setSavedCount((c) => Math.max(0, c - 1));
      }
      await fetchNextQuestion();
    } catch {
      setError("Couldn't save that answer. Your text is still in the box below - try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function saveForLater() {
    if (!pending) return;
    setError(null);
    try {
      const res = await fetch("/api/saved-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: pending.question,
          targetPeriodId: pending.targetPeriodId,
          targetTheme: pending.targetTheme,
          followUp: pending.followUp,
        }),
      });
      if (!res.ok) throw new Error("Failed to save question");
      setSavedCount((c) => c + 1);
      await fetchNextQuestion();
    } catch {
      setError("Couldn't save that question for later. Try again.");
    }
  }

  async function openSavedQuestion() {
    setError(null);
    try {
      const res = await fetch("/api/saved-questions");
      if (!res.ok) throw new Error("Failed to load saved questions");
      const data = await res.json();
      const list = data.savedQuestions as SavedQuestion[];
      if (list.length === 0) {
        setSavedCount(0);
        return;
      }
      setDirectedMode(false);
      setViewingSaved(list[0]);
    } catch {
      setError("Couldn't load your saved questions. Try again.");
    }
  }

  async function discardSavedQuestion() {
    if (!viewingSaved) return;
    setError(null);
    try {
      const res = await fetch(`/api/saved-questions?id=${viewingSaved.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to discard question");
      setSavedCount((c) => Math.max(0, c - 1));
      setViewingSaved(null);
    } catch {
      setError("Couldn't discard that question. Try again.");
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-2xl p-6 text-center">
        <p className="text-lg">
          Good session — {sessionFragments.length} fragment{sessionFragments.length === 1 ? "" : "s"} saved.
        </p>
        {savedCount > 0 && (
          <p className="mt-2 text-sm text-neutral-500">
            {savedCount} question{savedCount === 1 ? "" : "s"} saved for later, whenever you&apos;re ready.
          </p>
        )}
        <button
          onClick={() => setDone(false)}
          className="mt-4 rounded-full bg-neutral-800 px-4 py-2 text-sm text-white hover:bg-neutral-700"
        >
          Keep going
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      {savedCount > 0 && !directedMode && !viewingSaved && (
        <button
          onClick={openSavedQuestion}
          className="self-start text-sm text-neutral-500 underline hover:text-neutral-800 dark:hover:text-neutral-200"
        >
          📌 {savedCount} saved for later →
        </button>
      )}

      {directedMode ? (
        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
          <p className="text-xl leading-relaxed">What&apos;s on your mind?</p>
          <p className="mt-1 text-sm text-neutral-500">
            Run with whatever story or memory is on your mind - no need to answer today&apos;s question.
          </p>
        </div>
      ) : viewingSaved ? (
        <>
          <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
            <p className="text-xl leading-relaxed">{viewingSaved.question}</p>
          </div>
          <p className="-mt-4 text-sm text-neutral-500">
            📌 Saved from earlier —{" "}
            <button onClick={() => setViewingSaved(null)} className="underline hover:text-neutral-800 dark:hover:text-neutral-200">
              back to today&apos;s question
            </button>
            {" · "}
            <button onClick={discardSavedQuestion} className="underline hover:text-neutral-800 dark:hover:text-neutral-200">
              discard
            </button>
          </p>
        </>
      ) : (
        <>
          <QuestionCard question={pending?.question ?? null} loading={loadingQuestion} />
          {pending?.followUp && !loadingQuestion && (
            <p className="-mt-4 text-sm text-neutral-500">
              Following up on what you shared —{" "}
              <button onClick={() => fetchNextQuestion(true)} className="underline hover:text-neutral-800 dark:hover:text-neutral-200">
                back to today&apos;s regular questions
              </button>
            </p>
          )}
        </>
      )}

      <textarea
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder={
          directedMode
            ? "Type it out, or record it below…"
            : "Type your answer, or record it below…"
        }
        rows={6}
        disabled={loadingQuestion}
        className="w-full rounded-lg border border-neutral-300 p-3 dark:border-neutral-700 dark:bg-neutral-900"
      />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <VoiceRecorder onTranscribed={(text) => setAnswer((prev) => (prev ? `${prev} ${text}` : text))} disabled={loadingQuestion} />
        <div className="flex flex-wrap items-center gap-2">
          {!directedMode && !viewingSaved && !loadingQuestion && (
            <>
              <button
                onClick={saveForLater}
                className="rounded-full px-4 py-2 text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
              >
                Save for later
              </button>
              <button
                onClick={() => setDirectedMode(true)}
                className="rounded-full px-4 py-2 text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
              >
                Something else on my mind →
              </button>
            </>
          )}
          {directedMode && (
            <button
              onClick={() => setDirectedMode(false)}
              className="rounded-full px-4 py-2 text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
            >
              ← Back to today&apos;s question
            </button>
          )}
          <button
            onClick={() => setDone(true)}
            className="rounded-full px-4 py-2 text-sm text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
          >
            I&apos;m done for now
          </button>
          <button
            onClick={submitAnswer}
            disabled={submitting || loadingQuestion || !answer.trim()}
            className="rounded-full bg-neutral-800 px-5 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Submit answer"}
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {sessionFragments.length > 0 && (
        <div className="mt-4 border-t border-neutral-200 pt-4 text-sm text-neutral-500 dark:border-neutral-800">
          {sessionFragments.length} fragment{sessionFragments.length === 1 ? "" : "s"} saved this session.
        </div>
      )}
    </div>
  );
}
