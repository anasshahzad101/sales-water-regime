"use client";

import { useState } from "react";
import { useQuery } from "@/components/ui/filters";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

const RANGES = [
  { key: "month", label: "This month", short: "Month" },
  { key: "quarter", label: "This quarter", short: "Quarter" },
  { key: "year", label: "This year", short: "Year" },
  { key: "custom", label: "Custom", short: "Custom" },
] as const;

/** This month / This quarter / This year / Custom — kept in the URL (?range=…). */
export function RangeControl({ value }: { value: string }) {
  const { set } = useQuery();
  return (
    <div role="radiogroup" aria-label="Date range" className="flex overflow-x-auto rounded-full border border-line bg-bg-alt p-[3px] max-md:w-full md:flex-none">
      {RANGES.map((r) => {
        const on = r.key === value;
        return (
          <button
            key={r.key}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => set({ range: r.key === "quarter" ? null : r.key, from: null, to: null })}
            className={cn(
              "h-10 flex-1 rounded-full border-0 px-3.5 text-[13.5px] font-semibold whitespace-nowrap md:h-8",
              on ? "bg-surface text-ink shadow-[var(--shadow-sm)]" : "bg-transparent text-text-2",
            )}
          >
            <span className="md:hidden">{r.short}</span>
            <span className="max-md:hidden">{r.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/** From / to dates for the Custom range, applied together. Keyed by the parent so it resets when the URL changes. */
export function CustomRange({ from, to, max }: { from: string; to: string; max: string }) {
  const { set, pending } = useQuery();
  const [f, setF] = useState(from);
  const [t, setT] = useState(to);
  const field = (v: string, onChange: (v: string) => void, label: string, active: boolean) => (
    <span className={cn("wr-field flex h-10 items-center gap-2 rounded-xl border bg-input px-3 max-md:h-12", active ? "border-primary" : "border-line-strong")}>
      <Icon name="calendar-days" size={16} className="text-text-3" />
      <input
        type="date"
        aria-label={label}
        value={v}
        max={max}
        onChange={(e) => onChange(e.target.value)}
        className="h-full min-w-0 border-0 bg-transparent text-sm text-ink outline-none max-md:text-base"
      />
    </span>
  );
  return (
    <div className="-mt-1.5 flex flex-wrap items-center gap-2.5">
      {field(f, setF, "From", true)}
      <span className="text-text-3">to</span>
      {field(t, setT, "To", false)}
      <button
        type="button"
        disabled={pending || !f || !t}
        onClick={() => set({ range: "custom", from: f <= t ? f : t, to: f <= t ? t : f })}
        className="inline-flex h-10 items-center gap-2 rounded-full border-0 bg-primary px-4 text-[13.5px] font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-60 max-md:h-12"
      >
        {pending && <Icon name="loader-circle" size={14} className="animate-spin" />}
        Apply
      </button>
    </div>
  );
}
