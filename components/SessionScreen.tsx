"use client";

import { useEffect, useState } from "react";
import VoiceRecorder from "./VoiceRecorder";
import PhotoAttach from "./PhotoAttach";
import type { Fragment, SavedQuestion, ThemeKey } from "@/lib/types";

interface PendingQuestion {
  question: string;
  targetPeriodId: string;
  targetTheme: ThemeKey;
  followUp: boolean;
}

function threadQuestionText(fragment: Fragment): string {
  return fragment.selfDirected && fragment.sourceQuestion.startsWith("(Scott's own topic")
    ? "Something on your mind"
    : fragment.sourceQuestion;
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
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoResetKey, setPhotoResetKey] = useState(0);

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

  async function uploadPhotoIfAny(): Promise<string[]> {
    if (!photoFile) return [];
    const formData = new FormData();
    formData.append("image", photoFile);
    const res = await fetch("/api/photos", { method: "POST", body: formData });
    if (!res.ok) throw new Error("Failed to upload photo");
    const data = await res.json();
    return [data.photo.id as string];
  }

  async function submitAnswer() {
    if (!answer.trim()) return;
    if (!directedMode && !viewingSaved && !pending) return;
    setSubmitting(true);
    setError(null);
    try {
      const photoIds = await uploadPhotoIfAny();
      const payload = viewingSaved
        ? {
            rawText: answer,
            sourceQuestion: viewingSaved.question,
            targetPeriodId: viewingSaved.targetPeriodId,
            targetTheme: viewingSaved.targetTheme,
            selfDirected: viewingSaved.followUp,
            savedQuestionId: viewingSaved.id,
            photoIds,
          }
        : directedMode
          ? { rawText: answer, selfDirected: true, photoIds }
          : {
              rawText: answer,
              sourceQuestion: pending!.question,
              targetPeriodId: pending!.targetPeriodId,
              targetTheme: pending!.targetTheme,
              // Answering a follow-up continues the same thread.
              selfDirected: pending!.followUp,
              photoIds,
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
      setPhotoFile(null);
      setPhotoResetKey((k) => k + 1);
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
        <p className="font-serif text-lg italic text-ink">
          Good session — {sessionFragments.length} fragment{sessionFragments.length === 1 ? "" : "s"} saved.
        </p>
        {savedCount > 0 && (
          <p className="mt-2 text-sm text-ink-soft">
            {savedCount} question{savedCount === 1 ? "" : "s"} saved for later, whenever you&apos;re ready.
          </p>
        )}
        <button
          onClick={() => setDone(false)}
          className="mt-4 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-paper hover:opacity-90"
        >
          Keep going
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between gap-3">
        {savedCount > 0 ? (
          <button onClick={openSavedQuestion} className="flex items-center gap-1.5 text-sm text-accent2 hover:opacity-80">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 3h9a2 2 0 0 1 2 2v16l-6.5-4L4 21V5a2 2 0 0 1 2-2z" />
            </svg>
            {savedCount} saved for later &rarr;
          </button>
        ) : (
          <span />
        )}
        <button
          onClick={() => setDone(true)}
          className="rounded-full border border-border px-4 py-2 text-sm font-semibold text-ink-soft hover:bg-border-soft"
        >
          Finished
        </button>
      </div>

      {directedMode ? (
        <div className="rounded-2xl rounded-bl-md border border-border bg-card p-6 shadow-sm">
          <p className="font-serif text-xl italic text-ink">What&apos;s on your mind?</p>
          <p className="mt-1 text-sm text-ink-soft">
            Run with whatever story or memory is on your mind - no need to answer today&apos;s question.
          </p>
        </div>
      ) : viewingSaved ? (
        <>
          <div className="rounded-2xl rounded-bl-md border border-border bg-card p-6 shadow-sm">
            <p className="font-serif text-xl italic text-ink">{viewingSaved.question}</p>
          </div>
          <p className="-mt-2 text-sm text-ink-soft">
            Saved from earlier —{" "}
            <button onClick={() => setViewingSaved(null)} className="underline hover:text-ink">
              back to today&apos;s question
            </button>
            {" · "}
            <button onClick={discardSavedQuestion} className="underline hover:text-ink">
              discard
            </button>
          </p>
        </>
      ) : (
        <>
          {sessionFragments.length > 0 && (
            <div className="flex flex-col gap-5">
              {[...sessionFragments].reverse().map((fragment) => (
                <div key={fragment.id} className="flex flex-col gap-3">
                  <div className="flex justify-start">
                    <div className="max-w-[78%] rounded-2xl rounded-bl-md bg-border-soft px-5 py-4">
                      <p className="font-serif text-[15px] italic leading-relaxed text-ink">{threadQuestionText(fragment)}</p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="max-w-[78%] rounded-2xl rounded-br-md bg-accent-soft px-5 py-4">
                      <p className="text-[15px] leading-relaxed text-ink">{fragment.cleanedText}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-start">
            <div className="relative max-w-[78%] rounded-2xl rounded-bl-md border border-border bg-card px-6 py-5 pb-10 shadow-[0_1px_2px_rgba(30,20,10,0.04),0_8px_22px_rgba(43,36,32,0.06)]">
              {loadingQuestion || !pending ? (
                <p className="text-ink-faint">Thinking of a question&hellip;</p>
              ) : (
                <p className="font-serif text-lg italic leading-relaxed text-ink">{pending.question}</p>
              )}
              {!loadingQuestion && pending && (
                <button
                  onClick={saveForLater}
                  aria-label="Save for later"
                  title="Save for later"
                  className="absolute bottom-1.5 right-1.5 flex h-[30px] w-[30px] items-center justify-center rounded-full text-accent2 hover:bg-accent2-soft"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                </button>
              )}
            </div>
          </div>

          {pending?.followUp && !loadingQuestion && (
            <p className="text-sm text-ink-soft">
              Following up on what you shared —{" "}
              <button onClick={() => fetchNextQuestion(true)} className="underline hover:text-ink">
                back to today&apos;s regular questions
              </button>
            </p>
          )}
        </>
      )}

      <div className="relative">
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder="Type your answer, or record it below…"
          rows={5}
          disabled={loadingQuestion}
          className="w-full resize-none rounded-2xl border border-border bg-card p-5 pb-14 text-[15px] text-ink placeholder:text-ink-faint focus:outline-none"
        />
        <div className="absolute bottom-2 left-2 flex items-center gap-0.5">
          <VoiceRecorder onTranscribed={(text) => setAnswer((prev) => (prev ? `${prev} ${text}` : text))} disabled={loadingQuestion} />
          <PhotoAttach key={photoResetKey} onChange={setPhotoFile} disabled={loadingQuestion || submitting} />
        </div>
      </div>

      <div className={`flex items-center gap-3 ${viewingSaved ? "justify-end" : "justify-between"}`}>
        {!viewingSaved &&
          (directedMode ? (
            <button
              onClick={() => setDirectedMode(false)}
              className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-ink-soft hover:bg-border-soft"
            >
              &larr; Back to today&apos;s question
            </button>
          ) : (
            <button
              onClick={() => setDirectedMode(true)}
              className="rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-ink-soft hover:bg-border-soft"
            >
              Something else on my mind &rarr;
            </button>
          ))}
        <button
          onClick={submitAnswer}
          disabled={submitting || loadingQuestion || !answer.trim()}
          className="rounded-full bg-ink px-6 py-2.5 text-sm font-semibold text-paper hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? "Saving…" : "Submit answer"}
        </button>
      </div>

      {error && <p className="text-sm text-record">{error}</p>}
    </div>
  );
}
