"use client";

import { useState } from "react";
import { ActiveFilters, SearchFilter, SegmentFilter, SelectFilter, ToggleFilter, useQuery, type Chip, type Opt } from "@/components/ui/filters";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

type Values = { q: string; scope: string; sector: string; city: string; pri: string; owner: string; unassigned: boolean; dormant: boolean };
type Options = { sectors: Opt[]; cities: Opt[]; owners: Opt[] };

const PRIORITY_OPTS: Opt[] = [
  { value: "P1", label: "P1 (highest)" },
  { value: "P2", label: "P2" },
  { value: "P3", label: "P3" },
];

export function AccountsFilters({ values, options, chips, count }: { values: Values; options: Options; chips: Chip[]; count: number }) {
  const [sheet, setSheet] = useState(false);
  const selects = [
    { param: "sector", label: "Sector", all: "All sectors", value: values.sector, opts: options.sectors },
    { param: "city", label: "City", all: "All cities", value: values.city, opts: options.cities },
    { param: "pri", label: "Priority", all: "Any priority", value: values.pri, opts: PRIORITY_OPTS },
    { param: "owner", label: "Owner", all: "Any owner", value: values.owner, opts: options.owners },
  ];
  const toggles = [
    { param: "unassigned", label: "Unassigned only", icon: "user-x", value: values.unassigned },
    { param: "dormant", label: "Dormant only", icon: "moon", value: values.dormant },
  ];
  const sheetChips = chips.filter((c) => c.param !== "q");

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5">
        <SearchFilter value={values.q} placeholder="Search company, brand or plant" className="max-md:flex-[1_1_100%]" />
        <span className="max-md:flex-1 max-md:[&>span]:w-full max-md:[&>span>button]:flex-1">
          <SegmentFilter
            param="scope"
            value={values.scope}
            options={[
              { value: "mine", label: "My accounts" },
              { value: "all", label: "All accounts" },
            ]}
          />
        </span>
        <div className="hidden flex-wrap items-center gap-2.5 md:flex">
          {selects.map((s) => (
            <SelectFilter key={s.param} param={s.param} value={s.value} options={s.opts} allLabel={s.all} label={s.label} />
          ))}
          {toggles.map((t) => (
            <ToggleFilter key={t.param} param={t.param} value={t.value} label={t.label} icon={t.icon} />
          ))}
        </div>
        <button
          type="button"
          onClick={() => setSheet(true)}
          className="flex h-12 flex-none items-center gap-2 rounded-xl border border-line-strong bg-surface px-4 text-[15px] font-semibold text-ink md:hidden"
        >
          <Icon name="sliders-horizontal" size={17} />
          Filters
          {sheetChips.length > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[11.5px] font-bold text-on-primary">{sheetChips.length}</span>
          )}
        </button>
      </div>
      {chips.length > 0 && (
        <div className="-mt-1">
          <ActiveFilters chips={chips} />
        </div>
      )}
      {sheet && <FilterSheet selects={selects} toggles={toggles} count={count} onClose={() => setSheet(false)} />}
    </>
  );
}

function FilterSheet({
  selects,
  toggles,
  count,
  onClose,
}: {
  selects: { param: string; label: string; all: string; value: string; opts: Opt[] }[];
  toggles: { param: string; label: string; icon: string; value: boolean }[];
  count: number;
  onClose: () => void;
}) {
  const { set } = useQuery();
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end md:hidden">
      <div className="absolute inset-0 bg-scrim" onClick={onClose} />
      <div role="dialog" aria-label="Filters" className="relative flex max-h-[88%] flex-col gap-3.5 overflow-y-auto rounded-t-[28px] bg-surface px-5 pt-2 pb-[calc(28px+env(safe-area-inset-bottom))] text-ink shadow-[var(--shadow-lg)]">
        <div className="mx-auto h-[5px] w-10 rounded-full bg-line-strong" />
        <div className="flex items-center">
          <span className="flex-1 font-display text-[19px] font-semibold">Filters</span>
          <button
            type="button"
            onClick={() => set({ sector: null, city: null, pri: null, owner: null, unassigned: null, dormant: null, q: null })}
            className="h-11 border-0 bg-transparent px-2.5 text-[14.5px] font-semibold text-link"
          >
            Clear all
          </button>
        </div>
        {selects.map((s) => (
          <label key={s.param} className="flex flex-col gap-1.5">
            <span className="text-[13.5px] font-semibold">{s.label}</span>
            <span className="relative flex">
              <select
                value={s.value}
                onChange={(e) => set({ [s.param]: e.target.value || null })}
                className="h-12 flex-1 appearance-none rounded-xl border border-line-strong bg-input pr-10 pl-3.5 text-base text-ink outline-none"
              >
                <option value="">{s.all}</option>
                {s.opts.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
              <Icon name="chevron-down" size={16} className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-text-3" />
            </span>
          </label>
        ))}
        {toggles.map((t) => (
          <button
            key={t.param}
            type="button"
            role="switch"
            aria-checked={t.value}
            onClick={() => set({ [t.param]: t.value ? null : "1" })}
            className={cn(
              "flex min-h-[52px] items-center gap-3 rounded-xl border px-3.5 text-left text-[15px] font-medium text-ink",
              t.value ? "border-primary bg-brand-soft" : "border-line-strong bg-surface",
            )}
          >
            <Icon name={t.icon} size={18} className={t.value ? "text-green" : "text-ink"} />
            <span className="flex-1">{t.label}</span>
            <span className={cn("relative block h-[26px] w-11 rounded-full", t.value ? "bg-primary" : "bg-line-strong")}>
              <span className="absolute top-[3px] block size-5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.25)]" style={{ left: t.value ? 21 : 3 }} />
            </span>
          </button>
        ))}
        <button type="button" onClick={onClose} className="mt-1 h-[52px] rounded-full border-0 bg-primary text-base font-semibold text-on-primary">
          Show {count} {count === 1 ? "company" : "companies"}
        </button>
      </div>
    </div>
  );
}
