"use client";

import { useEffect, useState } from "react";
import FragmentCard from "./FragmentCard";
import { SEED_LIFE_PERIODS, type Fragment } from "@/lib/types";

export default function ReviewFeed() {
  const [fragments, setFragments] = useState<Fragment[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-6">
      <h1 className="text-2xl font-semibold">Review</h1>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!fragments && !error && <p className="text-neutral-400">Loading…</p>}
      {fragments && fragments.length === 0 && (
        <p className="text-neutral-400">No fragments yet - answer a question on the Today tab to get started.</p>
      )}
      {fragments?.map((fragment) => (
        <FragmentCard key={fragment.id} fragment={fragment} periods={SEED_LIFE_PERIODS} onSaved={handleSaved} />
      ))}
    </div>
  );
}
