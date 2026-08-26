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
    <div className="flex items-center gap-2">
      {previewUrl ? (
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Attached preview" className="h-12 w-12 rounded object-cover" />
          <button
            type="button"
            onClick={clear}
            disabled={disabled}
            className="text-sm text-neutral-500 underline hover:text-neutral-800 disabled:opacity-50 dark:hover:text-neutral-200"
          >
            Remove
          </button>
        </div>
      ) : (
        <label
          className={`text-sm text-neutral-500 underline hover:text-neutral-800 dark:hover:text-neutral-200 ${
            disabled ? "pointer-events-none opacity-50" : "cursor-pointer"
          }`}
        >
          Add a photo
          <input type="file" accept="image/*" onChange={handleSelect} disabled={disabled} className="hidden" />
        </label>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
