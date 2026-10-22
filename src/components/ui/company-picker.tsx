"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";
import { PriorityBadge } from "./pills";

export type CompanyOption = { id: number; name: string; sub: string; priority: string | null; owner?: string };

/**
 * Searchable company select (there are hundreds). Filters by name, brand, plant or city.
 * Submits the chosen id through a hidden input called `name`.
 */
export function CompanyPicker({
  companies,
  name = "companyId",
  value,
  onChange,
  error,
  autoFocus,
  allowAdd = true,
}: {
  companies: CompanyOption[];
  name?: string;
  value: number | null;
  onChange: (id: number | null) => void;
  error?: boolean;
  autoFocus?: boolean;
  allowAdd?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const selected = value ? companies.find((c) => c.id === value) : undefined;

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? companies.filter((c) => c.name.toLowerCase().includes(q) || c.sub.toLowerCase().includes(q)) : companies;
    return list.slice(0, 50);
  }, [companies, query]);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const choose = (c: CompanyOption) => {
    onChange(c.id);
    setQuery("");
    setOpen(false);
  };

  if (selected && !open) {
    return (
      <div className="flex min-h-12 items-center gap-2.5 rounded-xl border border-line-strong bg-input py-1.5 pr-1.5 pl-3 md:min-h-11">
        <input type="hidden" name={name} value={selected.id} />
        <Icon name="building-2" size={17} className="text-text-3" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[14.5px] font-semibold">{selected.name}</span>
          {selected.sub && <span className="truncate text-xs text-text-2">{selected.sub}</span>}
        </span>
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setTimeout(() => input.current?.focus(), 0);
          }}
          className="h-9 rounded-full border-0 bg-transparent px-3 text-[13px] font-semibold text-link hover:bg-surface-2"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div ref={wrap} className="relative">
      <input type="hidden" name={name} value={value ?? ""} />
      <div className={cn("wr-field flex h-12 items-center gap-2.5 rounded-xl border bg-input px-3 md:h-11", error ? "border-red" : "border-line-strong")}>
        <Icon name="search" size={17} className="text-text-3" />
        <input
          ref={input}
          role="combobox"
          aria-controls="company-picker-list"
          aria-expanded={open}
          aria-autocomplete="list"
          autoFocus={autoFocus}
          value={query}
          placeholder="Type a company, brand, plant or city"
          onFocus={() => setOpen(true)}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((a) => Math.min(matches.length - 1, a + 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(0, a - 1));
            } else if (e.key === "Enter") {
              if (open && matches[active]) {
                e.preventDefault();
                choose(matches[active]);
              }
            } else if (e.key === "Escape") setOpen(false);
          }}
          className="h-full min-w-0 flex-1 border-0 bg-transparent text-base text-ink outline-none placeholder:text-text-3 md:text-[14.5px]"
        />
        <span className="flex-none text-xs text-text-3">{companies.length} companies</span>
      </div>
      {open && (
        <div id="company-picker-list" role="listbox" className="absolute inset-x-0 top-[calc(100%+6px)] z-20 overflow-hidden rounded-[14px] border border-line bg-surface shadow-[var(--shadow-md)]">
          <div className="max-h-[300px] overflow-y-auto">
            {matches.map((c, i) => (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => choose(c)}
                className={cn("flex min-h-[54px] w-full items-center gap-2.5 border-0 px-3 py-2 text-left", i > 0 && "border-t border-line", i === active ? "bg-surface-2" : "bg-surface")}
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-sm font-semibold text-ink">{c.name}</span>
                  {c.sub && <span className="truncate text-xs text-text-2">{c.sub}</span>}
                </span>
                {c.priority && <PriorityBadge priority={c.priority} />}
                {c.owner !== undefined && <span className="hidden w-[78px] flex-none text-right text-xs text-text-3 md:block">{c.owner || "Unassigned"}</span>}
              </button>
            ))}
            {matches.length === 0 && <div className="px-3 py-4 text-sm text-text-2">No company matches “{query.trim()}”.</div>}
          </div>
          <div className="flex justify-between border-t border-line bg-surface-2 px-3 py-2 text-xs text-text-3">
            <span>↑ ↓ to move · Enter to pick</span>
            {allowAdd && (
              <Link href="/accounts/new" className="font-semibold text-link">
                Can&apos;t find it? Add company
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
