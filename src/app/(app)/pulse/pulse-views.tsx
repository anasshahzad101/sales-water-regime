"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { hueClass, StagePill } from "@/components/ui/pills";
import { OPEN_STAGES, STAGE_KEYS, STAGES, stageOf, type StageKey } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { money, moneyFull } from "@/lib/format";
import type { PulseCard } from "@/lib/queries/deals";

export const weighted = (d: PulseCard) => (d.value == null ? 0 : (d.value * d.probability) / 100);
const sum = (list: PulseCard[], f: (d: PulseCard) => number) => list.reduce((n, d) => n + f(d), 0);

export function dayChip(d: PulseCard) {
  if (d.stage === "won") return { label: `PO · ${d.closedOn}`, icon: "trophy", red: false };
  if (d.stage === "lost") return { label: "Closed", icon: "circle-x", red: false };
  if (d.stuck) return { label: `Stuck · ${d.days} d`, icon: "hourglass", red: true };
  return { label: `${d.days} d in stage`, icon: "clock", red: false };
}

function DayChip({ d }: { d: PulseCard }) {
  const chip = dayChip(d);
  return (
    <span className={cn("inline-flex h-[22px] items-center gap-1 rounded-full px-[7px] text-[11.5px] font-semibold whitespace-nowrap", chip.red ? "bg-red-bg text-red" : "bg-slate-bg text-text-2")}>
      <Icon name={chip.icon} size={11} />
      {chip.label}
    </span>
  );
}

/** Stage as a coloured dropdown when the user may change it, otherwise a plain pill. */
function StageControl({ d, onStage }: { d: PulseCard; onStage: (d: PulseCard, stage: StageKey) => void }) {
  if (!d.canMove) return <StagePill stage={d.stage} />;
  const st = stageOf(d.stage);
  return (
    <span className={cn("relative inline-flex max-w-full rounded-full", hueClass(st.hue))}>
      <Icon name={st.icon} size={13} className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2" />
      <select
        aria-label={`Stage of ${d.title}`}
        value={d.stage}
        onChange={(e) => onStage(d, e.target.value as StageKey)}
        className="h-9 max-w-full cursor-pointer appearance-none truncate rounded-full border-0 bg-transparent pr-7 pl-7 text-[13px] font-semibold text-inherit outline-none md:h-[30px] md:text-[12.5px]"
      >
        {STAGES.map((s) => (
          <option key={s.key} value={s.key}>
            {s.label}
          </option>
        ))}
      </select>
      <Icon name="chevron-down" size={12} className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2" />
    </span>
  );
}

function OwnerChip({ d }: { d: PulseCard }) {
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="flex size-[22px] flex-none items-center justify-center rounded-full bg-brand-soft text-[10px] font-bold text-green">{d.ownerInitials}</span>
      <span className="truncate text-[13px] text-text-2">{d.owner}</span>
    </span>
  );
}

// ---------------------------------------------------------------- list
type SortKey = "title" | "stage" | "value" | "probability" | "weighted" | "close" | "owner" | "days";
const COLS: { key: SortKey; label: string; numeric?: boolean }[] = [
  { key: "title", label: "Deal" },
  { key: "stage", label: "Stage" },
  { key: "value", label: "Value", numeric: true },
  { key: "probability", label: "Prob.", numeric: true },
  { key: "weighted", label: "Weighted", numeric: true },
  { key: "close", label: "Expected close" },
  { key: "owner", label: "Owner" },
  { key: "days", label: "In stage", numeric: true },
];
const GRID = "md:grid md:grid-cols-[minmax(0,2.4fr)_200px_110px_64px_110px_130px_minmax(0,1fr)_130px] md:items-center md:gap-3.5";

function compare(a: PulseCard, b: PulseCard, key: SortKey) {
  switch (key) {
    case "title":
      return a.title.localeCompare(b.title);
    case "stage":
      return STAGE_KEYS.indexOf(a.stage) - STAGE_KEYS.indexOf(b.stage);
    case "value":
      return (a.value ?? -1) - (b.value ?? -1);
    case "probability":
      return a.probability - b.probability;
    case "weighted":
      return weighted(a) - weighted(b);
    case "close":
      return (a.expectedClose ?? "9999-12-31").localeCompare(b.expectedClose ?? "9999-12-31");
    case "owner":
      return a.owner.localeCompare(b.owner);
    case "days":
      return a.days - b.days;
  }
}

export function DealList({ cards, onStage }: { cards: PulseCard[]; onStage: (d: PulseCard, stage: StageKey) => void }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "value", dir: -1 });
  const rows = [...cards].sort((a, b) => compare(a, b, sort.key) * sort.dir || b.id - a.id);
  const pick = (c: (typeof COLS)[number]) =>
    setSort((s) => (s.key === c.key ? { key: c.key, dir: s.dir === 1 ? -1 : 1 } : { key: c.key, dir: c.numeric ? -1 : 1 }));

  if (!rows.length) return <Empty />;
  const totals = (
    <span className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-text-2">
      <span>
        <b className="text-ink">{rows.length}</b> deal{rows.length === 1 ? "" : "s"}
      </span>
      <span title={moneyFull(sum(rows, (d) => d.value ?? 0))}>
        Value <b className="text-ink">{money(sum(rows, (d) => d.value ?? 0))}</b>
      </span>
      <span title="Value × probability">
        Weighted <b className="text-ink">{money(sum(rows, weighted))}</b>
      </span>
    </span>
  );

  return (
    <>
      {/* desktop table */}
      <div className="hidden overflow-hidden rounded-[18px] border border-line bg-surface shadow-[var(--shadow-sm)] md:block">
        <div className={cn(GRID, "bg-surface-2 px-5 py-2.5 text-[11.5px] font-semibold tracking-[0.05em] text-text-3 uppercase")}>
          {COLS.map((c) => {
            const on = sort.key === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => pick(c)}
                aria-label={`Sort by ${c.label}`}
                className={cn(
                  "flex items-center gap-1 border-0 bg-transparent p-0 text-left text-[11.5px] font-semibold tracking-[0.05em] uppercase",
                  on ? "text-ink" : "text-text-3 hover:text-ink",
                  c.numeric && "justify-end text-right",
                )}
              >
                {c.label}
                {on && <Icon name={sort.dir === 1 ? "arrow-up" : "arrow-down"} size={12} />}
              </button>
            );
          })}
        </div>
        {rows.map((d) => (
          <div key={d.id} className={cn(GRID, "border-t border-line px-5 py-3 hover:bg-surface-2")}>
            <span className="flex min-w-0 flex-col gap-0.5">
              <Link href={`/deals/${d.id}`} prefetch={false} className="truncate text-sm font-semibold text-ink hover:text-link" title={d.title}>
                {d.title}
              </Link>
              <span className="truncate text-[12.5px] text-text-2">
                {d.company}
                {d.sol ? ` · ${d.sol}` : ""}
              </span>
            </span>
            <span className="min-w-0">
              <StageControl d={d} onStage={onStage} />
            </span>
            <span title={moneyFull(d.value)} className="text-right font-display text-[15px] font-semibold tabular-nums">
              {money(d.value)}
            </span>
            <span className="text-right text-[13.5px] tabular-nums text-text-2">{d.probability}%</span>
            <span className="text-right text-[13.5px] font-semibold tabular-nums">{money(weighted(d))}</span>
            <span className={cn("text-[13.5px]", d.closePassed ? "font-semibold text-red" : "text-text-2")}>
              {d.close}
              {d.closePassed && <span className="block text-[11.5px] font-medium">Date passed</span>}
            </span>
            <OwnerChip d={d} />
            <span className="flex justify-end">
              <DayChip d={d} />
            </span>
          </div>
        ))}
        <div className="border-t border-line bg-surface-2 px-5 py-3">{totals}</div>
      </div>

      {/* phone cards */}
      <div className="flex flex-col gap-2.5 md:hidden">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-semibold text-text-3">Sort</span>
          <span className="relative flex flex-1">
            <select
              aria-label="Sort deals"
              value={`${sort.key}:${sort.dir}`}
              onChange={(e) => {
                const [key, dir] = e.target.value.split(":");
                setSort({ key: key as SortKey, dir: dir === "1" ? 1 : -1 });
              }}
              className="h-11 w-full appearance-none rounded-full border border-line-strong bg-surface pr-9 pl-3.5 text-base font-medium text-ink outline-none"
            >
              <option value="value:-1">Value, highest first</option>
              <option value="weighted:-1">Weighted, highest first</option>
              <option value="close:1">Expected close, soonest first</option>
              <option value="days:-1">Longest in stage</option>
              <option value="stage:1">Stage</option>
              <option value="title:1">Deal name, A–Z</option>
            </select>
            <Icon name="chevron-down" size={14} className="pointer-events-none absolute top-1/2 right-3.5 -translate-y-1/2 text-text-3" />
          </span>
        </div>
        {rows.map((d) => (
          <div key={d.id} className="flex flex-col gap-2.5 rounded-[18px] border border-line bg-surface px-4 py-3.5">
            <Link href={`/deals/${d.id}`} prefetch={false} className="flex items-start gap-2.5 text-ink hover:text-ink hover:no-underline">
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-semibold">{d.title}</span>
                <span className="text-[13px] text-text-2">
                  {d.company}
                  {d.sol ? ` · ${d.sol}` : ""}
                </span>
              </span>
              <span className="flex flex-col items-end">
                <span className="font-display text-base font-semibold whitespace-nowrap">{money(d.value)}</span>
                <span className="text-xs text-text-3">{d.probability}%</span>
              </span>
            </Link>
            <span className="flex flex-wrap items-center gap-2">
              <StageControl d={d} onStage={onStage} />
              <OwnerChip d={d} />
              <span className={cn("ml-auto text-[13px]", d.closePassed ? "font-semibold text-red" : "text-text-2")}>Close {d.close}</span>
            </span>
          </div>
        ))}
        <div className="py-1">{totals}</div>
      </div>
    </>
  );
}

// ---------------------------------------------------------------- forecast
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const addMonths = (ym: string, n: number) => {
  const [y, m] = ym.split("-").map(Number);
  const i = y * 12 + (m - 1) + n;
  return `${Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}`;
};
const monthLabel = (ym: string) => `${MONTHS[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`;

type Bucket = { key: string; label: string; sub: string; red?: boolean; always?: boolean };

/** Open deals grouped by the month they are expected to close. */
export function Forecast({ cards, today }: { cards: PulseCard[]; today: string }) {
  const open = cards.filter((d) => OPEN_STAGES.includes(d.stage));
  const months = Array.from({ length: 6 }, (_, i) => addMonths(today.slice(0, 7), i));
  const buckets: Bucket[] = [
    { key: "overdue", label: "Overdue", sub: "Close date has passed", red: true },
    ...months.map((m, i) => ({ key: m, label: monthLabel(m), sub: i === 0 ? "This month" : i === 1 ? "Next month" : `In ${i} months`, always: true })),
    { key: "later", label: "Later", sub: `After ${monthLabel(months[5])}` },
    { key: "none", label: "No close date", sub: "Set one on the deal" },
  ];
  const bucketOf = (d: PulseCard) => {
    if (!d.expectedClose) return "none";
    if (d.expectedClose < today) return "overdue";
    const ym = d.expectedClose.slice(0, 7);
    return ym > months[5] ? "later" : ym;
  };
  const groups = buckets.map((b) => {
    const list = open.filter((d) => bucketOf(d) === b.key).sort((x, y) => (x.expectedClose ?? "").localeCompare(y.expectedClose ?? "") || (y.value ?? 0) - (x.value ?? 0));
    return { ...b, list };
  });
  const next3 = groups.filter((g) => months.slice(0, 3).includes(g.key)).flatMap((g) => g.list);
  const overdue = groups[0].list;

  if (!open.length) return <Empty text="No open deals match the current filters." />;

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[18px] border border-line bg-line md:grid-cols-5">
        {[
          { label: "Open deals", value: String(open.length) },
          { label: "Open pipeline", value: money(sum(open, (d) => d.value ?? 0)), title: moneyFull(sum(open, (d) => d.value ?? 0)) },
          { label: "Weighted forecast", value: money(sum(open, weighted)), title: "Value × probability" },
          { label: "Weighted, next 3 months", value: money(sum(next3, weighted)), title: "Value × probability, closing this month and the next two" },
          { label: "Overdue close dates", value: String(overdue.length), red: overdue.length > 0 },
        ].map((s) => (
          <span key={s.label} title={s.title} className="flex flex-col gap-0.5 bg-surface px-5 py-3.5 max-md:last:col-span-2">
            <span className={cn("font-display text-lg font-semibold whitespace-nowrap tabular-nums", s.red && "text-red")}>{s.value}</span>
            <span className="text-xs text-text-3">{s.label}</span>
          </span>
        ))}
      </div>

      <div className="flex flex-col gap-4 md:grid md:auto-cols-[minmax(236px,1fr)] md:grid-flow-col md:items-start md:gap-3.5 md:overflow-x-auto md:pb-2">
        {groups.map((g) => (
          <section
            key={g.key}
            aria-label={g.label}
            className={cn(
              "flex flex-col gap-2.5 rounded-[18px] border border-line bg-bg-alt p-3 md:min-h-80",
              !g.list.length && (g.always ? "max-md:hidden" : "hidden"),
            )}
          >
            <div className="flex flex-col gap-1 px-1 pt-0.5 pb-1.5">
              <span className={cn("flex items-center gap-[7px] text-[13.5px] font-bold", g.red ? "text-red" : "text-ink")}>
                <Icon name={g.red ? "calendar-x" : g.key === "none" ? "circle-help" : "calendar-days"} size={15} />
                {g.label}
                <span className="ml-auto flex h-[22px] min-w-6 items-center justify-center rounded-full bg-surface px-[7px] text-xs font-bold text-ink">{g.list.length}</span>
              </span>
              <span className="text-xs text-text-3">{g.sub}</span>
              <span title={moneyFull(sum(g.list, (d) => d.value ?? 0))} className="font-display text-base font-semibold whitespace-nowrap tabular-nums">
                {money(sum(g.list, (d) => d.value ?? 0))}
              </span>
              <span className="text-xs text-text-2" title="Value × probability">
                {money(sum(g.list, weighted))} weighted
              </span>
            </div>
            {g.list.map((d) => (
              <Link
                key={d.id}
                href={`/deals/${d.id}`}
                prefetch={false}
                className="flex flex-col gap-2 rounded-[14px] border border-line bg-surface p-3 text-ink shadow-[var(--shadow-sm)] hover:text-ink hover:no-underline hover:shadow-[var(--shadow-md)]"
              >
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm leading-[1.3] font-semibold">{d.title}</span>
                  <span className="text-[12.5px] text-text-2">{d.company}</span>
                </span>
                <span className="flex items-baseline gap-2">
                  <span title={moneyFull(d.value)} className="font-display text-[15.5px] font-semibold whitespace-nowrap tabular-nums">
                    {money(d.value)}
                  </span>
                  <span className="text-xs text-text-3">{d.probability}%</span>
                  <span className="ml-auto truncate text-xs text-text-2">{d.owner}</span>
                </span>
                <span className="flex flex-wrap items-center gap-1.5 border-t border-line pt-2">
                  <StagePill stage={d.stage} size="sm" />
                  <span className={cn("ml-auto text-xs font-semibold whitespace-nowrap", g.red ? "text-red" : "text-text-2")}>{d.close}</span>
                </span>
              </Link>
            ))}
            {!g.list.length && <span className="rounded-[14px] border border-dashed border-line-strong px-2 py-4 text-center text-[13px] text-text-3">Nothing due</span>}
          </section>
        ))}
      </div>
    </div>
  );
}

function Empty({ text = "No deals match the current filters." }: { text?: string }) {
  return <div className="rounded-[18px] border border-dashed border-line-strong px-4 py-10 text-center text-sm text-text-2">{text}</div>;
}
