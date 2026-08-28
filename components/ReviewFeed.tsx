"use client";

import { useEffect, useState } from "react";
import FragmentCard from "./FragmentCard";
import { SEED_LIFE_PERIODS, type Fragment } from "@/lib/types";

export default function ReviewFeed() {
  const [fragments, setFragments] = useState<Fragment[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rescanning, setRescanning] = useState(false);
  const [rescanMessage, setRescanMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/fragments")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load fragments");
        return res.json();
      })
      .then((data) => setFragments(data.fragments as Fragment[]))
      .catch(() => setError("Couldn't load fragments."));
  }, []);

  function handleSaved(updated: Fragment) {
    setFragments((prev) => prev?.map((f) => (f.id === updated.id ? updated : f)) ?? prev);
  }

  async function rescanHistory() {
    setRescanning(true);
    setRescanMessage(null);
    setError(null);
    try {
      const res = await fetch("/api/skeleton/backfill", { method: "POST" });
      if (!res.ok) throw new Error("Rescan failed");
      const data = await res.json();
      setRescanMessage(
        data.fragmentsScanned === 0
          ? "Already up to date - nothing new to fold in."
          : `Scanned ${data.fragmentsScanned} fragment${data.fragmentsScanned === 1 ? "" : "s"} and updated the skeleton.`
      );
    } catch {
      setError("Couldn't rescan fragments. Try again in a moment.");
    } finally {
      setRescanning(false);
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-serif text-3xl italic font-medium text-ink">Review</h1>
        <button
          onClick={rescanHistory}
          disabled={rescanning}
          className="whitespace-nowrap text-sm text-ink-soft underline hover:text-ink disabled:opacity-50"
        >
          {rescanning ? "Rescanning…" : "Rescan history into skeleton"}
        </button>
      </div>
      {rescanMessage && <p className="text-sm text-accent2">{rescanMessage}</p>}
      {error && <p className="text-sm text-record">{error}</p>}
      {!fragments && !error && <p className="text-ink-faint">Loading…</p>}
      {fragments && fragments.length === 0 && (
        <p className="text-ink-faint">No fragments yet - answer a question on the Interview tab to get started.</p>
      )}
      {fragments?.map((fragment) => (
        <FragmentCard key={fragment.id} fragment={fragment} periods={SEED_LIFE_PERIODS} onSaved={handleSaved} />
      ))}
    </div>
  );
}
