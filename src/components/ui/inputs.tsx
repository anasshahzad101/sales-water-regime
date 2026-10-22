"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";
import { toPktLocalInput } from "@/lib/time";
import { Icon } from "./icon";
import { StagePill } from "./pills";

const shell = "wr-field flex h-12 items-center overflow-hidden rounded-xl border bg-input md:h-11";
const addon = "flex h-full items-center bg-bg-alt px-3 text-[13px] font-bold text-text-2";

/** Rupee amount with thousands separators; submits plain digits. */
export function MoneyInput({
  name,
  defaultValue,
  error,
  placeholder = "0",
}: {
  name: string;
  defaultValue?: number | null;
  error?: boolean;
  placeholder?: string;
}) {
  const [raw, setRaw] = useState(defaultValue != null ? String(Math.round(defaultValue)) : "");
  const n = raw ? Number(raw) : null;
  return (
    <div className="flex flex-col gap-1.5">
      <span className={cn(shell, error ? "border-red" : "border-line-strong")}>
        <span className={cn(addon, "border-r border-line")}>PKR</span>
        <input
          inputMode="numeric"
          value={raw ? Number(raw).toLocaleString("en-US") : ""}
          onChange={(e) => setRaw(e.target.value.replace(/[^\d]/g, "").slice(0, 13))}
          placeholder={placeholder}
          className="h-full min-w-0 flex-1 border-0 bg-transparent px-3 text-right text-base text-ink tabular-nums outline-none md:text-[14.5px]"
        />
        <input type="hidden" name={name} value={raw} />
      </span>
      <span className="text-[12.5px] text-text-3">{n ? `= ${money(n)}` : "Total contract value in rupees."}</span>
    </div>
  );
}

export function PercentInput({
  name,
  value,
  onChange,
  error,
  hint = "0–100. Defaults from the stage.",
}: {
  name: string;
  value: number;
  onChange: (v: number) => void;
  error?: boolean;
  hint?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className={cn(shell, "w-40", error ? "border-red" : "border-line-strong")}>
        <input
          name={name}
          inputMode="numeric"
          value={String(value)}
          onChange={(e) => {
            const v = Number(e.target.value.replace(/[^\d]/g, "") || 0);
            onChange(Math.max(0, Math.min(100, v)));
          }}
          className="h-full min-w-0 flex-1 border-0 bg-transparent px-3 text-right text-base text-ink tabular-nums outline-none md:text-[14.5px]"
        />
        <span className={cn(addon, "border-l border-line")}>%</span>
      </span>
      {hint && <span className="text-[12.5px] text-text-3">{hint}</span>}
    </div>
  );
}

/** Date + time in Pakistan time, with a "Now" shortcut. Value is YYYY-MM-DDTHH:mm (PKT). */
export function DateTimeInput({
  name,
  defaultValue,
  error,
  max,
  onValueChange,
}: {
  name: string;
  defaultValue?: string;
  error?: boolean;
  max?: string;
  onValueChange?: (v: string) => void;
}) {
  const [v, setVState] = useState(defaultValue ?? toPktLocalInput());
  const setV = (x: string) => {
    setVState(x);
    onValueChange?.(x);
  };
  return (
    <span className={cn(shell, "gap-2 pr-1.5 pl-3", error ? "border-red" : "border-line-strong")}>
      <Icon name="calendar-clock" size={17} className="text-text-3" />
      <input
        type="datetime-local"
        name={name}
        value={v}
        max={max}
        onChange={(e) => setV(e.target.value)}
        className="h-full min-w-0 flex-1 border-0 bg-transparent text-base text-ink outline-none md:text-[14.5px]"
      />
      <span className="rounded-md bg-bg-alt px-[7px] py-[3px] text-xs font-bold text-text-2">PKT</span>
      <button type="button" onClick={() => setV(toPktLocalInput())} className="flex h-[34px] items-center rounded-full border-0 bg-transparent px-2.5 text-[13px] font-semibold text-link hover:bg-surface-2">
        Now
      </button>
    </span>
  );
}

export type DealOption = { id: number; title: string; stage: string; value?: number | null };

/** Radio list of the chosen company's open deals, plus "No deal". */
export function DealPicker({
  deals,
  name = "dealId",
  value,
  onChange,
  companyChosen,
}: {
  deals: DealOption[];
  name?: string;
  value: number | null;
  onChange: (id: number | null) => void;
  companyChosen: boolean;
}) {
  if (!companyChosen) return <span className="text-[13px] text-text-3">Choose a company first.</span>;
  const row = (id: number | null, label: string, stage?: string, amount?: number | null) => {
    const sel = value === id;
    return (
      <label
        key={id ?? "none"}
        className={cn("flex min-h-[50px] cursor-pointer items-center gap-2.5 px-3 py-2", id !== null && "border-t border-line", sel ? "bg-brand-soft" : "bg-surface")}
      >
        <input type="radio" name={name} value={id ?? ""} checked={sel} onChange={() => onChange(id)} className="sr-only" />
        <Icon name={sel ? "circle-dot" : "circle"} size={18} className={sel ? "text-green" : "text-text-3"} />
        <span className={cn("flex-1 text-sm", sel && id !== null && "font-semibold")}>{label}</span>
        {stage && <StagePill stage={stage} size="sm" />}
        {amount !== undefined && <span className="hidden min-w-[86px] text-right text-[13.5px] font-semibold tabular-nums md:block">{money(amount)}</span>}
      </label>
    );
  };
  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-[14px] border border-line">
        {row(null, "No deal — general visit")}
        {deals.map((d) => row(d.id, d.title, d.stage, d.value))}
      </div>
      {deals.length === 0 && <span className="text-[12.5px] text-text-3">No open deals for this company. You can create one from the account page.</span>}
    </div>
  );
}
