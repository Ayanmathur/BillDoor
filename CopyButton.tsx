"use client";

import { useState } from "react";

type CopyButtonProps = {
  value: string;
  className?: string;
};

/**
 * Two-tone copy button. Left segment is the label, right segment is the
 * icon well — both darken on hover, and the icon swaps to a check mark
 * briefly after a successful copy.
 */
export default function CopyButton({ value, className = "" }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API unavailable — fail silently in the UI.
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      aria-live="polite"
      className={`group inline-flex h-9 select-none overflow-hidden rounded-lg shadow-md shadow-black/20 ring-1 ring-black/5 transition active:scale-[0.98] ${className}`}
    >
      <span
        className={`flex items-center justify-center px-4 text-sm font-medium text-white transition-colors ${
          copied ? "bg-emerald-600" : "bg-teal-600 group-hover:bg-teal-700"
        }`}
      >
        {copied ? "Copied" : "Copy"}
      </span>
      <span
        className={`flex w-9 items-center justify-center transition-colors ${
          copied ? "bg-emerald-700" : "bg-teal-800 group-hover:bg-teal-900"
        }`}
      >
        {copied ? (
          <svg viewBox="0 0 24 24" className="h-4 w-4 fill-none stroke-white stroke-[3]">
            <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        ) : (
          <svg viewBox="0 0 384 512" className="h-4 w-4 fill-white">
            <path d="M280 64h40c35.3 0 64 28.7 64 64V448c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V128C0 92.7 28.7 64 64 64h40 9.6C121 27.5 153.3 0 192 0s71 27.5 78.4 64H280zM64 112c-8.8 0-16 7.2-16 16V448c0 8.8 7.2 16 16 16H320c8.8 0 16-7.2 16-16V128c0-8.8-7.2-16-16-16H304v24c0 13.3-10.7 24-24 24H192 104c-13.3 0-24-10.7-24-24V112H64zm128-8a24 24 0 1 0 0-48 24 24 0 1 0 0 48z" />
          </svg>
        )}
      </span>
    </button>
  );
}
