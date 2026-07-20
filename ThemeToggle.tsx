"use client";

import { useEffect, useState } from "react";

type ThemeToggleProps = {
  className?: string;
};

/**
 * Sun/moon slider. Tracks and toggles the `dark` class on <html>,
 * persists the choice, and respects the user's OS preference on first
 * load. Icons idle with a slow ambient spin/tilt; the thumb slides and
 * recolors the track on toggle.
 */
export default function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const stored = window.localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const dark = stored ? stored === "dark" : prefersDark;
    setIsDark(dark);
    document.documentElement.classList.toggle("dark", dark);
  }, []);

  function toggle() {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    window.localStorage.setItem("theme", next ? "dark" : "light");
  }

  return (
    <label
      className={`relative inline-flex h-9 w-16 cursor-pointer items-center rounded-full transition-colors duration-300 ${
        isDark ? "bg-slate-800" : "bg-sky-300"
      } ${className}`}
    >
      <input
        type="checkbox"
        checked={isDark}
        onChange={toggle}
        className="peer sr-only"
        aria-label="Toggle dark mode"
      />

      {/* Sun icon, fixed near the right edge of the track */}
      <svg
        viewBox="0 0 24 24"
        className="theme-toggle-sun pointer-events-none absolute right-1.5 h-4 w-4 text-amber-300 transition-opacity duration-300"
        style={{ opacity: isDark ? 0 : 1 }}
        fill="currentColor"
      >
        <circle r="5" cy="12" cx="12" />
        <path d="m21 13h-1a1 1 0 0 1 0-2h1a1 1 0 0 1 0 2zm-17 0h-1a1 1 0 0 1 0-2h1a1 1 0 0 1 0 2zm13.66-5.66a1 1 0 0 1 -.66-.29 1 1 0 0 1 0-1.41l.71-.71a1 1 0 1 1 1.41 1.41l-.71.71a1 1 0 0 1 -.75.29zm-12.02 12.02a1 1 0 0 1 -.71-.29 1 1 0 0 1 0-1.41l.71-.66a1 1 0 0 1 1.41 1.41l-.71.71a1 1 0 0 1 -.7.24zm6.36-14.36a1 1 0 0 1 -1-1v-1a1 1 0 0 1 2 0v1a1 1 0 0 1 -1 1zm0 17a1 1 0 0 1 -1-1v-1a1 1 0 0 1 2 0v1a1 1 0 0 1 -1 1zm-5.66-14.66a1 1 0 0 1 -.7-.29l-.71-.71a1 1 0 0 1 1.41-1.41l.71.71a1 1 0 0 1 0 1.41 1 1 0 0 1 -.71.29zm12.02 12.02a1 1 0 0 1 -.7-.29l-.66-.71a1 1 0 0 1 1.36-1.36l.71.71a1 1 0 0 1 0 1.41 1 1 0 0 1 -.71.24z" />
      </svg>

      {/* Moon icon, fixed near the left edge of the track */}
      <svg
        viewBox="0 0 384 512"
        className="theme-toggle-moon pointer-events-none absolute left-1.5 h-4 w-4 text-indigo-200 transition-opacity duration-300"
        style={{ opacity: isDark ? 1 : 0 }}
        fill="currentColor"
      >
        <path d="m223.5 32c-123.5 0-223.5 100.3-223.5 224s100 224 223.5 224c60.6 0 115.5-24.2 155.8-63.4 5-4.9 6.3-12.5 3.1-18.7s-10.1-9.7-17-8.5c-9.8 1.7-19.8 2.6-30.1 2.6-96.9 0-175.5-78.8-175.5-176 0-65.8 36-123.1 89.3-153.3 6.1-3.5 9.2-10.5 7.7-17.3s-7.3-11.9-14.3-12.5c-6.3-.5-12.6-.8-19-.8z" />
      </svg>

      {/* Thumb */}
      <span
        className="pointer-events-none absolute left-1 h-7 w-7 rounded-full bg-white shadow-md shadow-black/20 transition-transform duration-300"
        style={{ transform: isDark ? "translateX(28px)" : "translateX(0)" }}
      />

      <style jsx>{`
        .theme-toggle-sun {
          animation: theme-toggle-spin 16s linear infinite;
        }
        .theme-toggle-moon {
          animation: theme-toggle-tilt 6s ease-in-out infinite;
        }
        @keyframes theme-toggle-spin {
          from {
            transform: rotate(0deg);
          }
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes theme-toggle-tilt {
          0%,
          100% {
            transform: rotate(0deg);
          }
          25% {
            transform: rotate(-10deg);
          }
          75% {
            transform: rotate(10deg);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .theme-toggle-sun,
          .theme-toggle-moon {
            animation: none;
          }
        }
      `}</style>
    </label>
  );
}
