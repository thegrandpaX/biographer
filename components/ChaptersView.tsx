"use client";

import { useEffect, useRef, useState } from "react";
import type { Chapter } from "@/lib/types";

interface ConsolidateUpdate {
  periodId: string;
  title: string;
  fragmentsWoven: number;
  isNew: boolean;
}

interface PeriodSummary {
  id: string;
  label: string;
  fragmentCount: number;
  newCount: number;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function ChaptersView() {
  const [chapters, setChapters] = useState<Chapter[] | null>(null);
  const [periods, setPeriods] = useState<PeriodSummary[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [consolidating, setConsolidating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const asideRef = useRef<HTMLElement>(null);
  const articleRef = useRef<HTMLElement>(null);

  async function fetchChapters() {
    try {
      const res = await fetch("/api/chapters");
      if (!res.ok) throw new Error("Failed to load chapters");
      const data = await res.json();
      const loadedChapters = data.chapters as Chapter[];
      const loadedPeriods = data.periods as PeriodSummary[];
      setChapters(loadedChapters);
      setPeriods(loadedPeriods);
      // Keep the current selection if it's still valid, otherwise open the
      // first period that has a chapter (or just the first period).
      setSelectedId((current) => {
        if (current && loadedPeriods.some((p) => p.id === current)) return current;
        const firstWithChapter = loadedPeriods.find((p) => loadedChapters.some((c) => c.periodId === p.id));
        return (firstWithChapter ?? loadedPeriods[0])?.id ?? null;
      });
    } catch {
      setError("Couldn't load chapters.");
    }
  }

  useEffect(() => {
    // Deferred a tick so the initial loading-state update doesn't happen
    // synchronously within the effect body.
    queueMicrotask(() => {
      fetchChapters();
    });
  }, []);

  async function runConsolidation() {
    setConsolidating(true);
    setStatusMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/chapters/consolidate", { method: "POST" });
      if (!res.ok) throw new Error("Consolidation failed");
      const data = await res.json();
      const updates = data.updates as ConsolidateUpdate[];
      const fragmentsWoven = updates.reduce((sum, u) => sum + u.fragmentsWoven, 0);
      setStatusMessage(
        updates.length === 0
          ? "Nothing new to consolidate - every chapter is already up to date."
          : `${plural(updates.length, "chapter")} updated (${plural(fragmentsWoven, "fragment")} woven in).`
      );
      await fetchChapters();
    } catch {
      setError("Couldn't run consolidation. Try again in a moment.");
    } finally {
      setConsolidating(false);
    }
  }

  if (!chapters && !error) {
    return <p className="px-5 py-14 text-ink-faint sm:px-10">Loading…</p>;
  }

  const totalNew = periods.reduce((sum, p) => sum + p.newCount, 0);
  const periodsWithNew = periods.filter((p) => p.newCount > 0).length;
  const selectedIndex = periods.findIndex((p) => p.id === selectedId);
  const selected = selectedIndex >= 0 ? periods[selectedIndex] : null;
  const selectedChapter = chapters?.find((c) => c.periodId === selectedId) ?? null;
  const prev = selectedIndex > 0 ? periods[selectedIndex - 1] : null;
  const next = selectedIndex >= 0 && selectedIndex < periods.length - 1 ? periods[selectedIndex + 1] : null;

  function select(id: string) {
    setSelectedId(id);
    // Side by side, the chapter is already beside the contents - go to the
    // top. Stacked (phone), the chapter sits below the contents, so bring it
    // into view instead of leaving the reader at the list.
    const article = articleRef.current;
    const aside = asideRef.current;
    const stacked = article && aside && article.offsetTop >= aside.offsetTop + aside.offsetHeight - 5;
    if (stacked) {
      article.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      window.scrollTo({ top: 0 });
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-[1280px] flex-wrap items-start gap-16 px-5 pb-20 pt-14 sm:px-10">
      <aside ref={asideRef} aria-label="Contents" className="flex min-w-0 flex-[1_1_300px] flex-col gap-8">
        <div className="flex flex-col gap-3.5 rounded-2xl border border-border bg-card p-5">
          <span className="meta-label text-xs text-accent">
            {totalNew === 0
              ? "Everything is woven in"
              : `${totalNew} new fragment${totalNew === 1 ? "" : "s"} waiting`}
          </span>
          <p className="text-sm leading-[1.5] text-ink-soft">
            {totalNew === 0
              ? "No new fragments since the last pass. "
              : `Spread across ${plural(periodsWithNew, "period")}. `}
            Consolidation works them into the existing chapters without rewriting what&apos;s already there.
          </p>
          <button
            onClick={runConsolidation}
            disabled={consolidating}
            className="h-12 rounded-full bg-accent text-[15px] font-bold text-on-accent hover:opacity-90 disabled:opacity-50"
          >
            {consolidating ? "Consolidating…" : "Run consolidation"}
          </button>
          {statusMessage && <p className="text-sm text-accent">{statusMessage}</p>}
          {error && <p className="text-sm text-record">{error}</p>}
        </div>

        <nav aria-label="Chapters" className="flex flex-col">
          <h2 className="meta-label mb-2 text-xs font-medium text-ink-soft">Contents</h2>
          {periods.map((period, i) => {
            const chapter = chapters?.find((c) => c.periodId === period.id);
            const active = period.id === selectedId;
            return (
              <button
                key={period.id}
                onClick={() => select(period.id)}
                aria-current={active ? "true" : undefined}
                className={`-mx-3 grid min-h-11 grid-cols-[36px_minmax(0,1fr)] gap-x-2 gap-y-1 rounded-xl px-3 py-3.5 text-left ${
                  active ? "bg-card-active" : "border-t border-border hover:bg-card"
                }`}
              >
                <span className={`meta-label pt-0.5 text-[13px] ${active ? "text-accent" : "text-ink-faint"}`}>
                  {pad(i + 1)}
                </span>
                <span className="text-[15px] font-semibold leading-[1.35] text-ink">{period.label}</span>
                <span />
                <span className="flex flex-wrap gap-x-2.5 gap-y-1 text-[13px] text-ink-faint">
                  <span>{chapter ? plural(chapter.fragmentIds.length, "fragment") : "No chapter yet"}</span>
                  {period.newCount > 0 && (
                    <span className="font-semibold text-accent">+{period.newCount} new</span>
                  )}
                </span>
              </button>
            );
          })}
        </nav>
      </aside>

      <article ref={articleRef} className="flex min-w-0 max-w-[720px] flex-[999_1_560px] flex-col gap-9">
        {selected ? (
          <>
            <header className="flex flex-col gap-[18px] border-b border-border pb-8">
              <span className="meta-label text-xs text-accent">
                Chapter {pad(selectedIndex + 1)} · {selected.label}
              </span>
              <h1 className="text-balance text-[44px] font-semibold leading-[1.02] tracking-[-0.02em] [font-stretch:88%] sm:text-[64px]">
                {selectedChapter?.title ?? selected.label}
              </h1>
              {selectedChapter ? (
                <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-ink-soft">
                  <span>Woven from {plural(selectedChapter.fragmentIds.length, "fragment")}</span>
                  <span>Updated {formatDate(selectedChapter.updatedAt)}</span>
                  {selected.newCount > 0 && (
                    <span className="font-semibold text-accent">
                      {plural(selected.newCount, "new fragment")} not yet woven in
                    </span>
                  )}
                </div>
              ) : (
                <div className="text-sm text-ink-soft">No chapter yet</div>
              )}
            </header>

            {selectedChapter ? (
              <div className="flex max-w-[64ch] flex-col gap-[26px] font-serif text-xl leading-[1.7] text-ink-prose">
                {selectedChapter.content.split(/\n\n+/).map((paragraph, i) => (
                  <p key={i}>{paragraph}</p>
                ))}
              </div>
            ) : (
              <div className="flex max-w-[64ch] flex-col gap-3 rounded-2xl border border-dashed border-border-strong px-8 py-12">
                <p className="text-lg font-semibold">This chapter hasn&apos;t been written yet.</p>
                <p className="text-[15px] leading-relaxed text-ink-soft">
                  {selected.fragmentCount === 0
                    ? "There are no fragments for this period so far. Answer a few questions about it on the Interview tab, then run consolidation."
                    : `${plural(selected.fragmentCount, "fragment")} on record for this period. Run consolidation to weave ${
                        selected.fragmentCount === 1 ? "it" : "them"
                      } into a chapter.`}
                </p>
              </div>
            )}

            <footer className="flex flex-wrap justify-between gap-4 border-t border-border pt-8">
              {prev ? (
                <button onClick={() => select(prev.id)} className="flex min-h-11 flex-col gap-1 text-left">
                  <span className="meta-label text-xs text-ink-faint">&larr; {pad(selectedIndex)}</span>
                  <span className="text-base font-semibold">{prev.label}</span>
                </button>
              ) : (
                <span />
              )}
              {next ? (
                <button onClick={() => select(next.id)} className="flex min-h-11 flex-col items-end gap-1 text-right">
                  <span className="meta-label text-xs text-ink-faint">{pad(selectedIndex + 2)} &rarr;</span>
                  <span className="text-base font-semibold">{next.label}</span>
                </button>
              ) : (
                <span />
              )}
            </footer>
          </>
        ) : (
          <p className="text-ink-faint">No life periods to show yet.</p>
        )}
      </article>
    </main>
  );
}
