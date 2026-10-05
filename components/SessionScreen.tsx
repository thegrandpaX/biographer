"use client";

import { useEffect, useState } from "react";
import VoiceRecorder from "./VoiceRecorder";
import PhotoAttach from "./PhotoAttach";
import { SEED_LIFE_PERIODS, THEME_LABELS, type Fragment, type SavedQuestion, type ThemeKey } from "@/lib/types";

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

function periodLabel(periodId: string): string {
  return SEED_LIFE_PERIODS.find((p) => p.id === periodId)?.label ?? periodId;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

const PILL_BUTTON =
  "flex h-11 items-center gap-2 rounded-full border border-border bg-card-raised px-4 text-sm font-medium text-ink-mid hover:bg-card-active disabled:opacity-50";

export default function SessionScreen() {
  const [pending, setPending] = useState<PendingQuestion | null>(null);
  const [loadingQuestion, setLoadingQuestion] = useState(true);
  const [answer, setAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sessionFragments, setSessionFragments] = useState<Fragment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [directedMode, setDirectedMode] = useState(false);
  const [savedList, setSavedList] = useState<SavedQuestion[]>([]);
  const [viewingSaved, setViewingSaved] = useState<SavedQuestion | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoResetKey, setPhotoResetKey] = useState(0);

  async function fetchNextQuestion(
    opts: { forceEngine?: boolean; excludePeriod?: string; avoidQuestion?: string } = {}
  ) {
    setLoadingQuestion(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (opts.excludePeriod) {
        params.set("mode", "newTopic");
        params.set("excludePeriod", opts.excludePeriod);
      } else if (opts.forceEngine) {
        params.set("mode", "engine");
      }
      if (opts.avoidQuestion) params.set("avoidQuestion", opts.avoidQuestion);
      const qs = params.toString();
      const res = await fetch(`/api/session/question${qs ? `?${qs}` : ""}`);
      if (!res.ok) throw new Error("Failed to get a question");
      const data = (await res.json()) as PendingQuestion;
      setPending(data);
    } catch {
      setError("Couldn't load the next question. Try again in a moment.");
    } finally {
      setLoadingQuestion(false);
    }
  }

  async function refreshSaved() {
    try {
      const res = await fetch("/api/saved-questions");
      if (!res.ok) return;
      const data = await res.json();
      setSavedList(data.savedQuestions as SavedQuestion[]);
    } catch {
      // non-critical - just leave the list as-is
    }
  }

  useEffect(() => {
    // Deferred a tick so the initial loading-state update doesn't happen
    // synchronously within the effect body.
    queueMicrotask(() => {
      fetchNextQuestion();
      refreshSaved();
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
        const answeredId = viewingSaved.id;
        setSavedList((prev) => prev.filter((q) => q.id !== answeredId));
        setViewingSaved(null);
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
      const data = await res.json();
      setSavedList((prev) => [...prev, data.savedQuestion as SavedQuestion]);
      await fetchNextQuestion();
    } catch {
      setError("Couldn't save that question for later. Try again.");
    }
  }

  async function newTopic() {
    setAnswer("");
    setPhotoFile(null);
    setPhotoResetKey((k) => k + 1);
    // Set the period aside for a while so the engine doesn't just circle
    // back to it on the very next question.
    if (pending?.targetPeriodId) {
      try {
        await fetch("/api/session/snooze", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ periodId: pending.targetPeriodId }),
        });
      } catch {
        // non-critical - the one-question skip below still applies
      }
    }
    await fetchNextQuestion({ excludePeriod: pending?.targetPeriodId, avoidQuestion: pending?.question });
  }

  function answerSavedNow(saved: SavedQuestion) {
    setError(null);
    setDirectedMode(false);
    setViewingSaved(saved);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function discardSaved(saved: SavedQuestion) {
    setError(null);
    try {
      const res = await fetch(`/api/saved-questions?id=${saved.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to discard question");
      setSavedList((prev) => prev.filter((q) => q.id !== saved.id));
      if (viewingSaved?.id === saved.id) setViewingSaved(null);
    } catch {
      setError("Couldn't discard that question. Try again.");
    }
  }

  const fragmentCountLabel = `${sessionFragments.length} FRAGMENT${sessionFragments.length === 1 ? "" : "S"} THIS SESSION`;

  if (done) {
    return (
      <div className="mx-auto flex max-w-xl flex-col items-center gap-4 px-5 py-24 text-center">
        <h1 className="text-[32px] font-medium leading-tight [font-stretch:92%]">
          Good session — {sessionFragments.length} fragment{sessionFragments.length === 1 ? "" : "s"} saved.
        </h1>
        {savedList.length > 0 && (
          <p className="text-[15px] text-ink-soft">
            {savedList.length} question{savedList.length === 1 ? "" : "s"} saved for later, whenever you&apos;re ready.
          </p>
        )}
        <button
          onClick={() => setDone(false)}
          className="mt-2 h-12 rounded-full bg-accent px-7 text-[15px] font-bold text-on-accent hover:opacity-90"
        >
          Keep going
        </button>
      </div>
    );
  }

  // The question currently on screen, whichever mode we're in.
  const shownPeriodId = viewingSaved ? viewingSaved.targetPeriodId : pending?.targetPeriodId;
  const shownTheme = viewingSaved ? viewingSaved.targetTheme : pending?.targetTheme;
  const showMeta = !directedMode && !loadingQuestion && Boolean(shownPeriodId && shownTheme);

  return (
    <div className="flex flex-col">
      <div className="mx-auto flex w-full max-w-[1280px] items-center justify-end gap-5 px-5 pt-5 sm:px-10">
        <span className="meta-label text-xs text-ink-soft">{fragmentCountLabel}</span>
        <button
          onClick={() => setDone(true)}
          className="h-11 rounded-full border border-border-strong px-5 text-sm font-semibold text-ink hover:bg-card-raised"
        >
          Finished
        </button>
      </div>

      <main className="mx-auto flex w-full max-w-[1280px] flex-wrap items-start gap-14 px-5 pb-16 pt-8 sm:px-10 sm:pt-10">
        <section aria-label="Current question" className="flex min-w-0 flex-[999_1_560px] flex-col gap-8">
          <div className="flex flex-col gap-5">
            {showMeta && shownPeriodId && shownTheme && (
              <div className="meta-label flex flex-wrap items-center gap-x-[18px] gap-y-2.5 text-xs text-ink-soft">
                <span className="text-accent">QUESTION {pad(sessionFragments.length + 1)}</span>
                <span>{periodLabel(shownPeriodId)}</span>
                <span aria-hidden="true" className="text-border-strong">/</span>
                <span>{THEME_LABELS[shownTheme]}</span>
              </div>
            )}

            {directedMode ? (
              <>
                <h1 className="max-w-[24ch] text-balance text-[32px] font-medium leading-[1.12] tracking-[-0.01em] [font-stretch:92%] sm:text-[46px]">
                  What&apos;s on your mind?
                </h1>
                <p className="max-w-prose text-[15px] text-ink-soft">
                  Run with whatever story or memory is on your mind - no need to answer today&apos;s question.
                </p>
              </>
            ) : viewingSaved ? (
              <>
                <h1 className="max-w-[24ch] text-pretty text-[32px] font-medium leading-[1.12] tracking-[-0.01em] [font-stretch:92%] sm:text-[46px]">
                  {viewingSaved.question}
                </h1>
                <p className="flex flex-wrap items-center gap-x-1 text-sm text-ink-soft">
                  Saved from earlier —
                  <button onClick={() => setViewingSaved(null)} className="min-h-11 px-1 underline hover:text-ink">
                    back to today&apos;s question
                  </button>
                  ·
                  <button onClick={() => discardSaved(viewingSaved)} className="min-h-11 px-1 underline hover:text-ink">
                    discard
                  </button>
                </p>
              </>
            ) : (
              <>
                {loadingQuestion || !pending ? (
                  <h1 className="text-[28px] font-medium leading-[1.12] text-ink-faint [font-stretch:92%]">
                    Thinking of a question&hellip;
                  </h1>
                ) : (
                  <h1 className="max-w-[24ch] text-pretty text-[32px] font-medium leading-[1.12] tracking-[-0.01em] [font-stretch:92%] sm:text-[46px]">
                    {pending.question}
                  </h1>
                )}

                {pending?.followUp && !loadingQuestion && (
                  <p className="flex flex-wrap items-center gap-x-1 text-sm text-ink-soft">
                    Following up on what you shared —
                    <button
                      onClick={() => fetchNextQuestion({ forceEngine: true, avoidQuestion: pending?.question })}
                      className="min-h-11 px-1 underline hover:text-ink"
                    >
                      back to today&apos;s regular questions
                    </button>
                  </p>
                )}

                {!loadingQuestion && pending && (
                  <div className="flex flex-wrap gap-2.5">
                    <button type="button" onClick={saveForLater} className={PILL_BUTTON}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M6 3h12v18l-6-4-6 4z" />
                      </svg>
                      Save for later
                    </button>
                    <button type="button" onClick={newTopic} disabled={loadingQuestion} className={PILL_BUTTON}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12h14" />
                        <path d="M13 6l6 6-6 6" />
                      </svg>
                      New topic
                      <span className="font-normal text-ink-faint">· sets this period aside a week</span>
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex flex-col rounded-[20px] border border-border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-6 pb-5 pt-6">
              <VoiceRecorder
                onTranscribed={(text) => setAnswer((prev) => (prev ? `${prev} ${text}` : text))}
                disabled={loadingQuestion}
              />
              <PhotoAttach key={photoResetKey} onChange={setPhotoFile} disabled={loadingQuestion || submitting} />
            </div>

            <div className="flex flex-col gap-2.5 px-6 py-5">
              <label htmlFor="answer" className="meta-label text-xs text-ink-soft">
                Your answer
              </label>
              <textarea
                id="answer"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Type your answer, or tap the mic and just talk…"
                rows={7}
                disabled={loadingQuestion}
                className="w-full resize-y border-none bg-transparent p-0 font-serif text-xl leading-[1.6] text-ink outline-none"
              />
            </div>

            <div
              className={`flex flex-wrap items-center gap-3 px-6 pb-6 pt-4 ${viewingSaved ? "justify-end" : "justify-between"}`}
            >
              {!viewingSaved &&
                (directedMode ? (
                  <button
                    onClick={() => setDirectedMode(false)}
                    className="h-12 px-1 text-[15px] font-medium text-ink-mid underline decoration-border-strong underline-offset-4 hover:text-ink"
                  >
                    &larr; Back to today&apos;s question
                  </button>
                ) : (
                  <button
                    onClick={() => setDirectedMode(true)}
                    className="h-12 px-1 text-[15px] font-medium text-ink-mid underline decoration-border-strong underline-offset-4 hover:text-ink"
                  >
                    Something else on my mind &rarr;
                  </button>
                ))}
              <button
                onClick={submitAnswer}
                disabled={submitting || loadingQuestion || !answer.trim()}
                className="h-[52px] rounded-full bg-accent px-7 text-[15px] font-bold tracking-[0.01em] text-on-accent hover:opacity-90 disabled:opacity-50"
              >
                {submitting ? "Saving…" : "Save answer"}
              </button>
            </div>
          </div>

          {error && <p className="text-sm text-record">{error}</p>}
        </section>

        <aside aria-label="Session" className="flex min-w-0 flex-[1_1_300px] flex-col gap-10">
          <div className="flex flex-col">
            <h2 className="meta-label mb-3 text-xs font-medium text-ink-soft">This session</h2>
            {sessionFragments.length === 0 ? (
              <p className="border-t border-border py-4 text-[15px] text-ink-faint">
                Your answers this session will appear here.
              </p>
            ) : (
              sessionFragments.map((fragment, i) => (
                <article key={fragment.id} className="flex flex-col gap-2 border-t border-border py-4">
                  <span className="meta-label text-[11px] text-ink-faint">
                    {pad(sessionFragments.length - i)} ·{" "}
                    {fragment.selfDirected
                      ? "Your own topic"
                      : `${periodLabel(fragment.periodId)} · ${THEME_LABELS[fragment.theme]}`}
                  </span>
                  <p className="text-[15px] leading-[1.45] text-ink-soft">{threadQuestionText(fragment)}</p>
                  <p className="whitespace-pre-wrap font-serif text-base leading-[1.55] text-ink">
                    {fragment.cleanedText}
                  </p>
                </article>
              ))
            )}
          </div>

          <div className="flex flex-col">
            <h2 className="meta-label mb-3 flex items-center gap-2.5 text-xs font-medium text-ink-soft">
              Saved for later
              <span className="rounded-full bg-ink-soft px-2 py-px text-paper">{savedList.length}</span>
            </h2>
            {savedList.length === 0 ? (
              <p className="border-t border-border py-4 text-[15px] text-ink-faint">
                Nothing saved yet. Use &ldquo;Save for later&rdquo; on a question you want to come back to.
              </p>
            ) : (
              savedList.map((saved) => (
                <div key={saved.id} className="flex flex-col gap-2.5 border-t border-border py-4">
                  <p className="text-[15px] leading-[1.45] text-ink-mid">{saved.question}</p>
                  <div className="flex gap-4">
                    <button
                      onClick={() => answerSavedNow(saved)}
                      className="h-11 text-sm font-semibold text-accent hover:opacity-80"
                    >
                      Answer now &rarr;
                    </button>
                    <button
                      onClick={() => discardSaved(saved)}
                      className="h-11 text-sm text-ink-faint hover:text-ink-soft"
                    >
                      Discard
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </aside>
      </main>
    </div>
  );
}
