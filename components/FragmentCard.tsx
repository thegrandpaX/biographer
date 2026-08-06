"use client";

import { useState } from "react";
import { ALL_THEMES, THEME_LABELS, type Fragment, type LifePeriod, type ThemeKey } from "@/lib/types";

interface FragmentCardProps {
  fragment: Fragment;
  periods: LifePeriod[];
  onSaved: (fragment: Fragment) => void;
}

export default function FragmentCard({ fragment, periods, onSaved }: FragmentCardProps) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(fragment.cleanedText);
  const [periodId, setPeriodId] = useState(fragment.periodId);
  const [theme, setTheme] = useState<ThemeKey>(fragment.theme);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const updated: Fragment = { ...fragment, cleanedText: text, periodId, theme };
      const res = await fetch("/api/fragments", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
      if (!res.ok) throw new Error("Save failed");
      onSaved(updated);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  const periodLabel = periods.find((p) => p.id === fragment.periodId)?.label ?? fragment.periodId;

  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      {!editing ? (
        <>
          <p className="whitespace-pre-wrap">{fragment.cleanedText}</p>
          <div className="mt-3 flex items-center justify-between text-sm text-neutral-500">
            <span>
              {periodLabel} &middot; {THEME_LABELS[fragment.theme]}
            </span>
            <button onClick={() => setEditing(true)} className="underline hover:text-neutral-800 dark:hover:text-neutral-200">
              Edit
            </button>
          </div>
        </>
      ) : (
        <div className="flex flex-col gap-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            className="w-full rounded border border-neutral-300 p-2 dark:border-neutral-700 dark:bg-neutral-900"
          />
          <div className="flex gap-2">
            <select
              value={periodId}
              onChange={(e) => setPeriodId(e.target.value)}
              className="rounded border border-neutral-300 p-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            >
              {periods.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as ThemeKey)}
              className="rounded border border-neutral-300 p-1 text-sm dark:border-neutral-700 dark:bg-neutral-900"
            >
              {ALL_THEMES.map((t) => (
                <option key={t} value={t}>
                  {THEME_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              onClick={save}
              disabled={saving}
              className="rounded bg-neutral-800 px-3 py-1 text-sm text-white hover:bg-neutral-700 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setEditing(false)} className="rounded px-3 py-1 text-sm text-neutral-500 hover:text-neutral-800">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
