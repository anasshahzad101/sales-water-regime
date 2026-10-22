"use client";

import { useSyncExternalStore } from "react";
import { cn } from "@/lib/cn";

type Theme = "light" | "dark";

export function applyTheme(t: Theme) {
  document.documentElement.setAttribute("data-theme", t);
  try {
    localStorage.setItem("wr-theme", t);
  } catch {
    // storage unavailable — theme still applies for this page view
  }
}

const subscribe = (cb: () => void) => {
  const mo = new MutationObserver(cb);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => mo.disconnect();
};
const current = (): Theme => (document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light");

/** Light / Dark segmented switch used in the user menu and the phone "More" sheet. */
export function ThemeToggle({ large = false }: { large?: boolean }) {
  const theme = useSyncExternalStore(subscribe, current, () => "light" as Theme);
  const btn = (t: Theme, label: string) => (
    <button
      type="button"
      onClick={() => applyTheme(t)}
      aria-pressed={theme === t}
      className={cn(
        "rounded-full border-0 font-semibold",
        large ? "h-[38px] px-3.5 text-sm" : "h-7 px-2.5 text-[12.5px]",
        theme === t ? "bg-surface text-ink shadow-[var(--shadow-sm)]" : "bg-transparent text-text-2",
      )}
    >
      {label}
    </button>
  );
  return (
    <span className="flex rounded-full border border-line bg-bg-alt p-[3px]">
      {btn("light", "Light")}
      {btn("dark", "Dark")}
    </span>
  );
}
