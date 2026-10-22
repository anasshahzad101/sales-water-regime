"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

/** Updates the URL query (the source of truth for list filters) and resets paging. */
export function useQuery() {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const set = (patch: Record<string, string | null | undefined>) => {
    const params = new URLSearchParams(window.location.search);
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === "") params.delete(k);
      else params.set(k, v);
    }
    if (!("page" in patch)) params.delete("page");
    const qs = params.toString();
    startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  };
  return { set, pending };
}

export function SearchFilter({ param = "q", value, placeholder, className }: { param?: string; value: string; placeholder: string; className?: string }) {
  const { set } = useQuery();
  const [v, setV] = useState(value);
  const [lastValue, setLastValue] = useState(value);
  if (value !== lastValue) {
    setLastValue(value);
    setV(value);
  }
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      if (v.trim() !== value) set({ [param]: v.trim() || null });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v]);
  return (
    <span className={cn("wr-field flex h-12 min-w-0 items-center gap-2 rounded-xl border border-line-strong bg-input px-3 md:h-10 md:w-[260px]", className)}>
      <Icon name="search" size={16} className="text-text-3" />
      <input
        value={v}
        onChange={(e) => setV(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-full min-w-0 flex-1 border-0 bg-transparent text-[15px] text-ink outline-none placeholder:text-text-3 md:text-sm"
      />
      {v && (
        <button type="button" aria-label="Clear search" onClick={() => setV("")} className="flex size-7 items-center justify-center rounded-full border-0 bg-transparent text-text-3 hover:text-ink">
          <Icon name="x" size={14} />
        </button>
      )}
    </span>
  );
}

export type Opt = { value: string; label: string };

/** Pill-shaped select; highlighted when a value is chosen. */
export function SelectFilter({
  param,
  value,
  options,
  allLabel,
  label,
  defaultValue,
}: {
  param: string;
  value: string;
  options: Opt[];
  /** Label of the empty "no filter" option; omit when the list has a default instead. */
  allLabel?: string;
  label?: string;
  /** Choosing this value clears the URL param (e.g. "Last 30 days"). */
  defaultValue?: string;
}) {
  const { set } = useQuery();
  const active = defaultValue !== undefined ? value !== defaultValue : !!value;
  return (
    <label className="flex flex-col gap-1.5 max-md:w-full md:contents">
      {label && <span className="text-[13.5px] font-semibold md:hidden">{label}</span>}
    <span className="relative flex">
      <select
        aria-label={label ?? allLabel}
        value={value}
        onChange={(e) => set({ [param]: !e.target.value || e.target.value === defaultValue ? null : e.target.value })}
        className={cn(
          "h-12 w-full appearance-none rounded-xl border pr-10 pl-3.5 text-base font-medium text-ink outline-none md:h-10 md:w-auto md:max-w-[220px] md:rounded-full md:pr-9 md:text-[13.5px]",
          active ? "border-primary bg-brand-soft" : "border-line-strong bg-surface",
        )}
      >
        {allLabel !== undefined && <option value="">{allLabel}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <Icon name="chevron-down" size={14} className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-text-3" />
    </span>
    </label>
  );
}

export function ToggleFilter({ param, value, label, icon }: { param: string; value: boolean; label: string; icon?: string }) {
  const { set } = useQuery();
  return (
    <button
      type="button"
      aria-pressed={value}
      onClick={() => set({ [param]: value ? null : "1" })}
      className={cn(
        "inline-flex h-12 items-center gap-1.5 rounded-full border pr-3.5 pl-2.5 text-[15px] md:h-10 md:text-[13.5px]",
        value ? "border-primary bg-brand-soft font-semibold text-green" : "border-line-strong bg-surface text-ink",
      )}
    >
      {icon && <Icon name={value ? "circle-check" : icon} size={15} />}
      {label}
    </button>
  );
}

export function SegmentFilter({ param, value, options }: { param: string; value: string; options: Opt[] }) {
  const { set } = useQuery();
  return (
    <span className="flex rounded-full border border-line bg-bg-alt p-[3px]">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => set({ [param]: o.value || null })}
          className={cn(
            "flex h-[42px] items-center rounded-full border-0 px-3.5 text-[14px] font-semibold md:h-8 md:text-[13.5px]",
            value === o.value ? "bg-surface text-ink shadow-[var(--shadow-sm)]" : "bg-transparent text-text-2",
          )}
        >
          {o.label}
        </button>
      ))}
    </span>
  );
}

export type Chip = { param: string; label: string };

export function ActiveFilters({ chips, keep = [] }: { chips: Chip[]; keep?: string[] }) {
  const { set } = useQuery();
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {chips.map((c) => (
        <span key={c.param} className="inline-flex h-[30px] items-center gap-1 rounded-full bg-brand-soft pr-1 pl-3 text-[13px] font-semibold text-green">
          {c.label}
          <button type="button" aria-label={`Remove ${c.label}`} onClick={() => set({ [c.param]: null })} className="flex size-[26px] items-center justify-center rounded-full border-0 bg-transparent text-green hover:bg-white/40">
            <Icon name="x" size={14} />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={() => set(Object.fromEntries(chips.filter((c) => !keep.includes(c.param)).map((c) => [c.param, null])))}
        className="border-0 bg-transparent px-1 text-[13px] font-semibold text-link hover:underline"
      >
        Clear all
      </button>
    </div>
  );
}

/** Phone: "Filters (n)" button that opens the controls in a bottom sheet. */
export function PhoneFilters({ count, children, resultLabel }: { count: number; children: ReactNode; resultLabel?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-12 flex-none items-center gap-2 rounded-xl border border-line-strong bg-surface px-3.5 text-[15px] font-semibold text-ink md:hidden"
      >
        <Icon name="sliders-horizontal" size={17} />
        Filters
        {count > 0 && <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11.5px] font-bold text-on-primary">{count}</span>}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end md:hidden">
          <div className="absolute inset-0 bg-scrim" onClick={() => setOpen(false)} />
          <div role="dialog" aria-label="Filters" className="relative flex max-h-[85%] flex-col gap-4 overflow-y-auto rounded-t-[28px] bg-surface px-5 pt-2 pb-[calc(24px+env(safe-area-inset-bottom))] shadow-[var(--shadow-lg)]">
            <div className="mx-auto h-[5px] w-10 rounded-full bg-line-strong" />
            <div className="flex items-center">
              <span className="flex-1 font-display text-[19px] font-semibold">Filters</span>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="flex size-11 items-center justify-center rounded-full border-0 bg-transparent text-text-2">
                <Icon name="x" size={22} />
              </button>
            </div>
            <div className="flex flex-col gap-3 [&_select]:w-full">{children}</div>
            <button type="button" onClick={() => setOpen(false)} className="h-[52px] rounded-full border-0 bg-primary text-base font-semibold text-on-primary">
              {resultLabel ?? "Show results"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
