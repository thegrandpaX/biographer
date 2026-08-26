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
    <div className="rounded-2xl border border-border bg-card p-6">
      {!editing ? (
        <div className="flex flex-col gap-4">
          <p className="font-serif text-[16px] leading-relaxed text-ink whitespace-pre-wrap">{fragment.cleanedText}</p>
          {fragment.photoIds && fragment.photoIds.length > 0 && (
            <div className="flex gap-2">
              {fragment.photoIds.map((id) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={id} src={`/api/photos/${id}`} alt="Attached to this memory" className="h-24 w-24 rounded-lg object-cover" />
              ))}
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="rounded-full bg-accent2-soft px-3 py-1 text-xs font-semibold text-accent2">
              {periodLabel} &middot; {THEME_LABELS[fragment.theme]}
            </span>
            <button onClick={() => setEditing(true)} className="text-sm text-ink-soft underline hover:text-ink">
              Edit
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            className="w-full rounded-lg border border-border bg-paper p-3 text-ink"
          />
          <div className="flex gap-2">
            <select
              value={periodId}
              onChange={(e) => setPeriodId(e.target.value)}
              className="rounded-lg border border-border bg-paper p-1.5 text-sm text-ink"
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
              className="rounded-lg border border-border bg-paper p-1.5 text-sm text-ink"
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
              className="rounded-full bg-ink px-4 py-1.5 text-sm font-semibold text-paper hover:opacity-90 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            <button onClick={() => setEditing(false)} className="rounded-full px-4 py-1.5 text-sm text-ink-soft hover:text-ink">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
