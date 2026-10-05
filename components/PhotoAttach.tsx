"use client";

import { useState, type ChangeEvent } from "react";

interface PhotoAttachProps {
  onChange: (file: File | null) => void;
  disabled?: boolean;
}

const MAX_BYTES = 10 * 1024 * 1024;

export default function PhotoAttach({ onChange, disabled }: PhotoAttachProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSelect(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("That image is too large (max 10MB).");
      return;
    }
    setPreviewUrl(URL.createObjectURL(file));
    onChange(file);
  }

  function clear() {
    setPreviewUrl(null);
    setError(null);
    onChange(null);
  }

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      {previewUrl ? (
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Attached preview" className="h-11 w-11 rounded-lg object-cover" />
          <button
            type="button"
            onClick={clear}
            disabled={disabled}
            className="h-11 px-1 text-sm font-medium text-ink-soft underline hover:text-ink disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      ) : (
        <label
          className={`flex h-11 items-center gap-2 rounded-xl border border-dashed border-border-strong px-4 text-sm font-medium text-ink-mid hover:bg-card-raised ${
            disabled ? "pointer-events-none opacity-50" : "cursor-pointer"
          }`}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="5" width="18" height="14" rx="2" />
            <circle cx="9" cy="11" r="2" />
            <path d="M21 16l-5-5-8 8" />
          </svg>
          Attach a photo
          <input type="file" accept="image/*" onChange={handleSelect} disabled={disabled} className="hidden" />
        </label>
      )}
      {error && <p className="max-w-[220px] text-xs text-record">{error}</p>}
    </div>
  );
}
