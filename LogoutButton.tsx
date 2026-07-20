"use client";

type LogoutButtonProps = {
  onLogout?: () => void;
  className?: string;
};

/**
 * A compact circular icon button that expands into a pill revealing the
 * "Log out" label on hover/focus. Icon and label are always both present
 * in the DOM (for accessibility) — only their layout animates.
 */
export default function LogoutButton({ onLogout, className = "" }: LogoutButtonProps) {
  return (
    <button
      type="button"
      onClick={onLogout}
      aria-label="Log out"
      className={`group relative flex h-11 w-11 items-center overflow-hidden rounded-full bg-white shadow-md shadow-black/15 ring-1 ring-black/5 transition-all duration-300 ease-out hover:w-32 hover:rounded-2xl hover:bg-slate-900 focus-visible:w-32 focus-visible:rounded-2xl focus-visible:bg-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-[0.97] ${className}`}
    >
      <span className="flex w-11 shrink-0 items-center justify-center transition-[padding] duration-300 group-hover:pl-3 group-focus-visible:pl-3">
        <svg viewBox="0 0 512 512" className="h-4 w-4 fill-slate-900 transition-colors duration-300 group-hover:fill-white group-focus-visible:fill-white">
          <path d="M377.9 105.9L500.7 228.7c7.2 7.2 11.3 17.1 11.3 27.3s-4.1 20.1-11.3 27.3L377.9 406.1c-6.4 6.4-15 9.9-24 9.9c-18.7 0-33.9-15.2-33.9-33.9l0-62.1-128 0c-17.7 0-32-14.3-32-32l0-64c0-17.7 14.3-32 32-32l128 0 0-62.1c0-18.7 15.2-33.9 33.9-33.9c9 0 17.6 3.6 24 9.9zM160 96L96 96c-17.7 0-32 14.3-32 32l0 256c0 17.7 14.3 32 32 32l64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32l-64 0c-53 0-96-43-96-96L0 128C0 75 43 32 96 32l64 0c17.7 0 32 14.3 32 32s-14.3 32-32 32z" />
        </svg>
      </span>
      <span className="max-w-0 overflow-hidden whitespace-nowrap text-sm font-semibold text-white opacity-0 transition-all duration-300 group-hover:max-w-[5rem] group-hover:pr-4 group-hover:opacity-100 group-focus-visible:max-w-[5rem] group-focus-visible:pr-4 group-focus-visible:opacity-100">
        Log out
      </span>
    </button>
  );
}
