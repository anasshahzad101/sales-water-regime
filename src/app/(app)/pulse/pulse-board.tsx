"use client";

import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { changeDealStage, undoDealStage } from "@/app/actions/deals";
import { LostModal, WonModal } from "@/components/deals/stage-modals";
import { ExportButton } from "@/components/ui/export-button";
import { useQuery } from "@/components/ui/filters";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { SOLUTION_TYPES, STAGES, stageOf, type StageKey } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { money, moneyFull } from "@/lib/format";
import type { PulseCard, PulseColumn, PulseFilters, PulseView } from "@/lib/queries/deals";
import { dayChip, DealList, Forecast } from "./pulse-views";

const STUCK_BORDER = "color-mix(in srgb, var(--red) 40%, var(--line))";

const VIEWS: { key: PulseView; label: string; icon: string; sub: string }[] = [
  { key: "board", label: "Board", icon: "kanban", sub: "Drag a deal to another stage to move it. Open a deal to edit it." },
  { key: "list", label: "List", icon: "list", sub: "Every deal in one table. Change a stage straight from the list." },
  { key: "forecast", label: "Forecast", icon: "calendar-range", sub: "Open deals by the month they are expected to close." },
];

const byValue = (a: PulseCard, b: PulseCard) => (b.value ?? 0) - (a.value ?? 0);

export function PulseBoard({
  columns,
  people,
  filters,
  today,
  canCreate,
  exportHref,
}: {
  columns: PulseColumn[];
  people: { id: number; name: string }[];
  filters: PulseFilters;
  today: string;
  canCreate: boolean;
  exportHref: string;
}) {
  const { set } = useQuery();
  const toast = useToast();
  const [busy, startTransition] = useTransition();
  const [view, setView] = useState<PulseView>(filters.view);
  const [tab, setTab] = useState<StageKey>("proposal");
  const [ask, setAsk] = useState<null | { card: PulseCard; stage: "lost" | "won" }>(null);
  const [lostErr, setLostErr] = useState("");
  const [dragId, setDragId] = useState<number | null>(null);
  const [over, setOver] = useState<StageKey | null>(null);
  // Stage changes show at once; the server's refreshed board replaces them when the change lands.
  const [moves, addMove] = useOptimistic<Record<number, StageKey>, { id: number; stage: StageKey }>({}, (m, x) => ({ ...m, [x.id]: x.stage }));

  const cards = columns
    .flatMap((c) => c.cards)
    .map((d) => {
      const to = moves[d.id];
      return to && to !== d.stage ? { ...d, stage: to, days: 0, stuck: false, closePassed: false } : d;
    });
  const cols = STAGES.map((s) => {
    const list = cards.filter((d) => d.stage === s.key).sort(byValue);
    return { key: s.key, count: list.length, total: list.reduce((n, d) => n + (d.value ?? 0), 0), cards: list };
  });
  const cur = cols.find((c) => c.key === tab) ?? cols[0];
  const team = filters.scope === "team";
  const dragged = dragId == null ? undefined : cards.find((d) => d.id === dragId);

  const toggleSol = (s: string) => {
    const next = filters.sols.includes(s) ? filters.sols.filter((x) => x !== s) : [...filters.sols, s];
    set({ sol: next.length ? next.join(",") : null });
  };

  const pickView = (k: PulseView) => {
    setView(k);
    // The view is only a way of looking at the same deals, so no server round trip.
    const params = new URLSearchParams(window.location.search);
    if (k === "board") params.delete("view");
    else params.set("view", k);
    const qs = params.toString();
    window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
  };

  const move = (d: PulseCard, stage: StageKey, lost?: { reason: string; note: string }) => {
    startTransition(async () => {
      addMove({ id: d.id, stage });
      const res = await changeDealStage({ dealId: d.id, stage, lostReason: lost?.reason, lostNote: lost?.note });
      if (!res.ok) {
        if (res.fieldErrors?.lost) setLostErr(res.fieldErrors.lost);
        else toast({ title: "Couldn’t change the stage", sub: res.error, tone: "error" });
        return;
      }
      setAsk(null);
      const snapshot = res.data!.snapshot;
      toast({
        title: stage === "lost" ? "Moved to Lost" : stage === "won" ? "Marked as Won (PO)" : "Stage changed",
        sub: `${d.title} · ${lost ? lost.reason : `${res.data!.from} → ${res.data!.to}`}`,
        undo: async () => {
          const u = await undoDealStage(d.id, snapshot);
          if (!u.ok) toast({ title: "Couldn’t undo", sub: u.error, tone: "error" });
        },
      });
    });
  };

  /** Lost needs a reason and Won a confirmation; other stages move straight away. */
  const request = (d: PulseCard, stage: StageKey) => {
    if (!d.canMove || stage === d.stage) return;
    if (stage === "lost" || stage === "won") {
      setLostErr("");
      setAsk({ card: d, stage });
    } else move(d, stage);
  };

  const endDrag = () => {
    setDragId(null);
    setOver(null);
  };

  const sub = VIEWS.find((v) => v.key === view)!.sub;
  const askDesc = ask ? `${ask.card.title} · ${ask.card.company}` : "";

  return (
    <div className="flex flex-col gap-[18px]">
      {/* header */}
      <div className="flex flex-wrap items-end gap-3">
        <div className="hidden min-w-[260px] flex-1 flex-col gap-1.5 md:flex">
          <h1 className="m-0 font-display text-[28px] font-semibold tracking-[-0.02em]">Team Pulse</h1>
          <p className="m-0 text-[14.5px] text-text-2">{sub}</p>
        </div>
        {canCreate && (
          <Link
            href="/deals/new"
            className="inline-flex h-[46px] flex-1 items-center justify-center gap-2 rounded-full bg-primary px-[18px] text-sm font-semibold text-on-primary hover:bg-primary-hover hover:text-on-primary hover:no-underline md:h-10 md:flex-none"
          >
            <Icon name="plus" size={16} />
            New deal
          </Link>
        )}
        <ExportButton href={exportHref} className="max-md:hidden" />
        <div className="flex flex-1 md:hidden">
          <ExportButton href={exportHref} label="Export" className="w-full" />
        </div>
      </div>

      {/* filters */}
      <div className="flex flex-wrap items-center gap-2.5">
        <div role="radiogroup" aria-label="View" className="flex rounded-full border border-line bg-bg-alt p-[3px] max-md:w-full">
          {VIEWS.map((v) => (
            <button
              key={v.key}
              type="button"
              role="radio"
              aria-checked={view === v.key}
              onClick={() => pickView(v.key)}
              className={cn(
                "inline-flex h-10 items-center justify-center gap-1.5 rounded-full border-0 px-3.5 text-[13.5px] font-semibold max-md:flex-1 md:h-8",
                view === v.key ? "bg-surface text-ink shadow-[var(--shadow-sm)]" : "bg-transparent text-text-2 hover:text-ink",
              )}
            >
              <Icon name={v.icon} size={15} />
              {v.label}
            </button>
          ))}
        </div>
        <span className="mx-0.5 hidden h-6 w-px bg-line md:block" />
        <div role="radiogroup" aria-label="Scope" className="flex rounded-full border border-line bg-bg-alt p-[3px]">
          {(["mine", "team"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={filters.scope === k}
              onClick={() => set({ scope: k, owner: null })}
              className={cn(
                "h-10 rounded-full border-0 px-4 text-[13.5px] font-semibold md:h-8",
                filters.scope === k ? "bg-surface text-ink shadow-[var(--shadow-sm)]" : "bg-transparent text-text-2",
              )}
            >
              {k === "mine" ? "Mine" : "Team"}
            </button>
          ))}
        </div>
        <span className={cn("relative flex", !team && "opacity-50")}>
          <select
            aria-label="Salesperson"
            disabled={!team}
            value={filters.owner ? String(filters.owner) : ""}
            onChange={(e) => set({ owner: e.target.value || null })}
            className={cn(
              "h-11 appearance-none rounded-full border pr-[34px] pl-3 text-base font-medium text-ink outline-none md:h-10 md:text-[13.5px]",
              team && filters.owner ? "border-primary bg-brand-soft" : "border-line-strong bg-surface",
            )}
          >
            <option value="">All salespeople</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <Icon name="chevron-down" size={14} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-text-3" />
        </span>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-0.5 text-[12.5px] font-semibold text-text-3">Solution</span>
          {SOLUTION_TYPES.map((s) => {
            const on = filters.sols.includes(s);
            return (
              <button
                key={s}
                type="button"
                aria-pressed={on}
                onClick={() => toggleSol(s)}
                className={cn(
                  "h-10 min-w-11 rounded-full border px-2.5 text-[12.5px] font-bold md:h-8",
                  on ? "border-primary bg-brand-soft text-green" : "border-line-strong bg-surface text-ink",
                )}
              >
                {s}
              </button>
            );
          })}
          {filters.sols.length > 0 && (
            <button type="button" onClick={() => set({ sol: null })} className="h-8 border-0 bg-transparent px-2 text-[13px] font-semibold text-link">
              Clear
            </button>
          )}
        </div>
      </div>

      {view === "list" && <DealList cards={cards} onStage={request} />}
      {view === "forecast" && <Forecast cards={cards} today={today} />}

      {view === "board" && (
        <>
          {/* desktop board — drag cards between stages */}
          <div className="hidden auto-cols-[minmax(236px,1fr)] grid-flow-col items-start gap-3.5 overflow-x-auto pb-2 md:grid">
            {cols.map((c) => {
              const st = stageOf(c.key);
              const target = over === c.key;
              return (
                <section
                  key={c.key}
                  aria-label={st.label}
                  onDragOver={(e) => {
                    if (!dragged || dragged.stage === c.key) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                    if (over !== c.key) setOver(c.key);
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver((o) => (o === c.key ? null : o));
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragged) request(dragged, c.key);
                    endDrag();
                  }}
                  className={cn(
                    "flex min-h-80 flex-col gap-2.5 rounded-[18px] border p-3 transition-colors",
                    target ? "border-primary bg-brand-soft" : "border-line bg-bg-alt",
                  )}
                >
                  <div className="flex flex-col gap-1 px-1 pt-0.5 pb-1.5">
                    <span className="flex items-center gap-[7px] text-[13.5px] font-bold" style={{ color: `var(--${st.hue})` }}>
                      <Icon name={st.icon} size={15} />
                      {st.label}
                      <span className="ml-auto flex h-[22px] min-w-6 items-center justify-center rounded-full bg-surface px-[7px] text-xs font-bold text-ink">{c.count}</span>
                    </span>
                    <span title={moneyFull(c.total)} className="font-display text-base font-semibold tabular-nums">
                      {money(c.total)}
                    </span>
                  </div>
                  {target && (
                    <span className="flex items-center justify-center gap-1.5 rounded-[14px] border-2 border-dashed border-primary bg-surface px-2 py-4 text-[13px] font-semibold text-green">
                      <Icon name="arrow-down" size={14} />
                      Move here
                    </span>
                  )}
                  {c.cards.map((d) => (
                    <DeskCard
                      key={d.id}
                      d={d}
                      dragging={dragId === d.id}
                      onDragStart={() => setDragId(d.id)}
                      onDragEnd={endDrag}
                    />
                  ))}
                  {c.cards.length === 0 && !target && (
                    <span className="rounded-[14px] border border-dashed border-line-strong px-2 py-4 text-center text-[13px] text-text-3">No deals</span>
                  )}
                </section>
              );
            })}
          </div>

          {/* phone: stage tabs */}
          <div className="flex flex-col gap-[18px] md:hidden">
            <div role="tablist" className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-0.5">
              {cols.map((c) => {
                const st = stageOf(c.key);
                const on = c.key === cur.key;
                return (
                  <button
                    key={c.key}
                    type="button"
                    role="tab"
                    aria-selected={on}
                    onClick={() => setTab(c.key)}
                    className={cn(
                      "flex h-11 flex-none items-center gap-[7px] rounded-full border pr-3.5 pl-3 text-sm font-semibold whitespace-nowrap",
                      on ? "border-primary bg-brand-soft text-green" : "border-line-strong bg-surface text-ink",
                    )}
                  >
                    <Icon name={st.icon} size={15} style={{ color: `var(--${st.hue})` }} />
                    {st.label}
                    <span className="font-medium text-text-3">{c.count}</span>
                  </button>
                );
              })}
            </div>
            <div className="flex items-baseline gap-2 px-0.5 pt-0.5">
              <span className="font-display text-xl font-semibold">{money(cur.total)}</span>
              <span className="text-[13.5px] text-text-2">
                {cur.count} deal{cur.count === 1 ? "" : "s"} in {stageOf(cur.key).label}
              </span>
            </div>
            <div className="flex flex-col gap-2.5">
              {cur.cards.map((d) => (
                <PhoneCard key={d.id} d={d} />
              ))}
              {cur.cards.length === 0 && (
                <div className="rounded-[18px] border border-dashed border-line-strong px-4 py-7 text-center text-sm text-text-2">No deals in this stage with the current filters.</div>
              )}
            </div>
          </div>
        </>
      )}

      <LostModal
        open={ask?.stage === "lost"}
        description={askDesc}
        busy={busy}
        error={lostErr}
        onEdit={() => setLostErr("")}
        onClose={() => setAsk(null)}
        onConfirm={(reason, note) => ask && move(ask.card, "lost", { reason, note })}
      />
      <WonModal
        open={ask?.stage === "won"}
        description={askDesc}
        value={ask?.card.value ?? null}
        busy={busy}
        onClose={() => setAsk(null)}
        onConfirm={() => ask && move(ask.card, "won")}
      />
    </div>
  );
}

function DeskCard({ d, dragging, onDragStart, onDragEnd }: { d: PulseCard; dragging: boolean; onDragStart: () => void; onDragEnd: () => void }) {
  const chip = dayChip(d);
  return (
    <Link
      href={`/deals/${d.id}`}
      prefetch={false}
      draggable={d.canMove}
      onDragStart={(e) => {
        if (!d.canMove) return e.preventDefault();
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", String(d.id));
        onDragStart();
      }}
      onDragEnd={onDragEnd}
      title={d.canMove ? "Drag to another stage, or click to open" : undefined}
      className={cn(
        "group flex flex-col gap-2 rounded-[14px] border bg-surface p-3 text-ink shadow-[var(--shadow-sm)] hover:text-ink hover:no-underline hover:shadow-[var(--shadow-md)]",
        d.canMove && "cursor-grab active:cursor-grabbing",
        dragging && "opacity-50",
      )}
      style={{ borderColor: d.stuck || d.closePassed ? STUCK_BORDER : "var(--line)" }}
    >
      <span className="flex items-start gap-1.5">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-sm leading-[1.3] font-semibold">{d.title}</span>
          <span className="text-[12.5px] text-text-2">{d.company}</span>
        </span>
        {d.canMove && <Icon name="grip-vertical" size={15} className="-mr-1 text-text-3 opacity-0 transition-opacity group-hover:opacity-100" />}
      </span>
      <span className="flex items-center gap-2">
        <span title={moneyFull(d.value)} className="font-display text-[15.5px] font-semibold tabular-nums">
          {money(d.value)}
        </span>
        {d.sol && <span className="ml-auto flex h-5 items-center rounded-md border border-line-strong px-1.5 text-[11px] font-bold text-text-2">{d.sol}</span>}
      </span>
      <span className="flex flex-wrap items-center gap-1.5 border-t border-line pt-2">
        <span className="flex size-[22px] items-center justify-center rounded-full bg-brand-soft text-[10px] font-bold text-green">{d.ownerInitials}</span>
        <span className="text-[12.5px] text-text-2">{d.owner}</span>
        <span
          className={cn(
            "ml-auto inline-flex h-[22px] items-center gap-1 rounded-full px-[7px] text-[11.5px] font-semibold",
            chip.red ? "bg-red-bg text-red" : "bg-slate-bg text-text-2",
          )}
        >
          <Icon name={chip.icon} size={11} />
          {chip.label}
        </span>
      </span>
      {d.closePassed && (
        <span className="inline-flex items-center gap-[5px] text-xs font-semibold text-red">
          <Icon name="calendar-x" size={12} />
          Close date passed · {d.close}
        </span>
      )}
      {d.stage === "lost" && d.lostReason && <span className="text-xs text-text-2">Reason: {d.lostReason}</span>}
    </Link>
  );
}

function PhoneCard({ d }: { d: PulseCard }) {
  const chip = dayChip(d);
  return (
    <Link
      href={`/deals/${d.id}`}
      prefetch={false}
      className="flex flex-col gap-2 rounded-[18px] border bg-surface px-4 py-3.5 text-ink hover:text-ink hover:no-underline"
      style={{ borderColor: d.stuck || d.closePassed ? STUCK_BORDER : "var(--line)" }}
    >
      <span className="flex items-start gap-2.5">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[15px] font-semibold">{d.title}</span>
          <span className="text-[13px] text-text-2">{d.company}</span>
        </span>
        <span className="font-display text-base font-semibold whitespace-nowrap">{money(d.value)}</span>
      </span>
      <span className="flex flex-wrap items-center gap-1.5">
        <span className="text-[13px] text-text-2">
          {d.owner}
          {d.sol ? ` · ${d.sol}` : ""}
        </span>
        <span className={cn("ml-auto inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-semibold", chip.red ? "bg-red-bg text-red" : "bg-slate-bg text-text-2")}>
          <Icon name={chip.icon} size={12} />
          {chip.label}
        </span>
      </span>
      {d.closePassed && (
        <span className="inline-flex items-center gap-[5px] text-[12.5px] font-semibold text-red">
          <Icon name="calendar-x" size={13} />
          Close date passed · {d.close}
        </span>
      )}
      {d.stage === "lost" && d.lostReason && <span className="text-xs text-text-2">Reason: {d.lostReason}</span>}
    </Link>
  );
}
