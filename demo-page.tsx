"use client";

import CopyButton from "./CopyButton";
import LogoutButton from "./LogoutButton";
import ThemeToggle from "./ThemeToggle";

/**
 * Example usage — drop into app/page.tsx (or any route) to see all three
 * controls together. Assumes Tailwind's darkMode is set to "class" and
 * your global CSS defines light/dark background tokens.
 */
export default function DemoPage() {
  return (
    <main className="flex min-h-screen items-center justify-center gap-6 bg-slate-100 p-8 transition-colors dark:bg-slate-950">
      <CopyButton value="npx create-next-app@latest" />
      <ThemeToggle />
      <LogoutButton onLogout={() => console.log("logged out")} />
    </main>
  );
}
