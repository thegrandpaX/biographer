"use client";

import { useEffect, useState } from "react";
import type { Chapter } from "@/lib/types";

interface ConsolidateUpdate {
  periodId: string;
  title: string;
  fragmentsWoven: number;
  isNew: boolean;
}

export default function ChaptersView() {
  const [chapters, setChapters] = useState<Chapter[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [consolidating, setConsolidating] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  async function fetchChapters() {
    try {
      const res = await fetch("/api/chapters");
      if (!res.ok) throw new Error("Failed to load chapters");
      const data = await res.json();
      setChapters(data.chapters as Chapter[]);
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
          : `${updates.length} chapter${updates.length === 1 ? "" : "s"} updated (${fragmentsWoven} fragment${fragmentsWoven === 1 ? "" : "s"} woven in).`
      );
      await fetchChapters();
    } catch {
      setError("Couldn't run consolidation. Try again in a moment.");
    } finally {
      setConsolidating(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-serif text-3xl italic font-medium text-ink">Chapters</h1>
        <button
          onClick={runConsolidation}
          disabled={consolidating}
          className="whitespace-nowrap rounded-full border border-border px-4 py-2 text-sm font-semibold text-ink-soft hover:bg-border-soft disabled:opacity-50"
        >
          {consolidating ? "Consolidating…" : "Run consolidation"}
        </button>
      </div>

      {statusMessage && <p className="text-sm text-accent2">{statusMessage}</p>}
      {error && <p className="text-sm text-record">{error}</p>}
      {!chapters && !error && <p className="text-ink-faint">Loading…</p>}

      {chapters && chapters.length === 0 && (
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border px-10 py-14 text-center">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--ink-faint)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          </svg>
          <p className="max-w-sm text-sm leading-relaxed text-ink-soft">
            No chapters yet. Run consolidation once you&apos;ve got some fragments on record and
            it&apos;ll weave them into narrative chapters, one per life period.
          </p>
        </div>
      )}

      {chapters?.map((chapter) => (
        <div key={chapter.id} className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-7">
          <h2 className="font-serif text-2xl italic font-medium text-ink">{chapter.title}</h2>
          <div className="flex flex-col gap-4">
            {chapter.content.split(/\n\n+/).map((paragraph, i) => (
              <p key={i} className="font-serif text-[16px] leading-relaxed text-ink">
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
