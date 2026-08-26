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
    <div className="relative flex items-center gap-1.5">
      {error && <p className="absolute bottom-full left-0 mb-1.5 w-max max-w-[200px] text-xs text-record">{error}</p>}

      {previewUrl ? (
        <div className="flex items-center gap-1.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Attached preview" className="h-[30px] w-[30px] rounded-md object-cover" />
          <button
            type="button"
            onClick={clear}
            disabled={disabled}
            className="text-xs font-medium text-ink-soft underline hover:text-ink disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      ) : (
        <label
          className={`flex h-[38px] w-[38px] items-center justify-center rounded-full hover:bg-border-soft ${
            disabled ? "pointer-events-none opacity-50" : "cursor-pointer"
          }`}
          title="Add a photo"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent2)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21.44 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95l-9.19 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
          </svg>
          <input type="file" accept="image/*" onChange={handleSelect} disabled={disabled} className="hidden" />
        </label>
      )}
    </div>
  );
}
