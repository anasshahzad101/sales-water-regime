"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { setNextActionDone } from "@/app/actions/visits";
import { Icon } from "@/components/ui/icon";
import { CountChip } from "@/components/ui/pills";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import type { DueAction } from "@/lib/queries/my-week";

const GROUPS: { key: DueAction["group"]; label: string; fg: string; tone: "red" | "amber" | "slate" }[] = [
  { key: "overdue", label: "Overdue", fg: "var(--red)", tone: "red" },
  { key: "today", label: "Today", fg: "var(--amber)", tone: "amber" },
  { key: "later", label: "Later this week", fg: "var(--text-3)", tone: "slate" },
];

export function DueList({ items, canEdit }: { items: DueAction[]; canEdit: boolean }) {
  const toast = useToast();
  // Optimistic ticks; forgotten when fresh server data arrives.
  const [localFor, setLocalFor] = useState<{ src: DueAction[]; map: Record<number, boolean> }>({ src: items, map: {} });
  const local = localFor.src === items ? localFor.map : {};
  const setLocal = (fn: (m: Record<number, boolean>) => Record<number, boolean>) =>
    setLocalFor((cur) => ({ src: items, map: fn(cur.src === items ? cur.map : {}) }));
  const [, startTransition] = useTransition();

  const isDone = (a: DueAction) => local[a.visitId] ?? a.done;
  const open = items.filter((a) => !isDone(a));
  const done = items.filter(isDone);

  const toggle = (a: DueAction) => {
    if (!canEdit) return;
    const next = !isDone(a);
    setLocal((l) => ({ ...l, [a.visitId]: next }));
    startTransition(async () => {
      const res = await setNextActionDone(a.visitId, next);
      if (!res.ok) {
        setLocal((l) => ({ ...l, [a.visitId]: !next }));
        toast({ title: "Couldn’t update", sub: res.error, tone: "error" });
        return;
      }
      if (next)
        toast({
          title: "Marked done",
          sub: `${a.text} · ${a.company}`,
          undo: async () => {
            setLocal((l) => ({ ...l, [a.visitId]: false }));
            await setNextActionDone(a.visitId, false);
          },
        });
    });
  };

  const groups = GROUPS.map((g) => ({ ...g, items: open.filter((a) => a.group === g.key) })).filter((g) => g.items.length);
  const toneFor = (a: DueAction) => GROUPS.find((g) => g.key === a.group)?.tone ?? "slate";

  const row = (a: DueAction) => {
    const d = isDone(a);
    const tone = toneFor(a);
    return (
      <div key={a.visitId} className="flex items-center gap-0.5 py-0.5 pr-3 pl-1 max-md:min-h-[58px] md:items-start md:gap-3 md:px-5 md:py-2">
        <button
          type="button"
          onClick={() => toggle(a)}
          aria-label={d ? "Mark not done" : "Mark done"}
          disabled={!canEdit}
          className="flex size-11 flex-none items-center justify-center border-0 bg-transparent p-0 md:mt-px md:size-[22px]"
        >
          <span
            className={cn(
              "flex size-6 items-center justify-center rounded-lg border-[1.5px] text-on-primary md:size-[22px] md:rounded-[7px]",
              d ? "border-primary bg-primary" : "border-line-strong bg-input",
            )}
          >
            <Icon name="check" size={14} style={{ opacity: d ? 1 : 0 }} />
          </span>
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className={cn("text-sm font-medium max-md:text-[14.5px]", d ? "text-text-3 line-through" : "text-ink")}>{a.text}</span>
          <span className="text-[12.5px] text-text-2">
            <Link href={`/accounts/${a.companyId}`} className="text-text-2 hover:text-ink">
              {a.company}
            </Link>
            <span className="max-md:hidden"> · from {a.from}</span>
          </span>
        </div>
        {d ? (
          <button type="button" onClick={() => toggle(a)} className="inline-flex h-11 flex-none items-center gap-1 border-0 bg-transparent px-2 text-[12.5px] font-semibold text-link md:h-[22px] md:px-1.5">
            <Icon name="undo-2" size={13} className="max-md:hidden" />
            Undo
          </button>
        ) : (
          <span
            className={cn(
              "inline-flex h-[22px] flex-none items-center rounded-full px-2 text-xs font-semibold whitespace-nowrap",
              tone === "slate" ? "bg-slate-bg text-text-2" : tone === "red" ? "bg-red-bg text-red" : "bg-amber-bg text-amber",
            )}
          >
            {a.chip}
          </span>
        )}
      </div>
    );
  };

  const groupLabel = (label: string, fg: string) => (
    <div className="px-4 pt-2.5 pb-0.5 text-[11.5px] font-bold tracking-[0.06em] uppercase md:px-5 md:pb-1" style={{ color: fg }}>
      {label}
    </div>
  );

  const body = (
    <>
      {groups.map((g) => (
        <div key={g.key}>
          {groupLabel(g.label, g.fg)}
          {g.items.map(row)}
        </div>
      ))}
      {done.length > 0 && (
        <div>
          {groupLabel(`Done · ${done.length}`, "var(--green)")}
          {done.map(row)}
        </div>
      )}
      {items.length === 0 && (
        <div className="flex items-center gap-3 px-4 pt-2 pb-3.5 text-[13.5px] text-text-2 md:px-5">
          <Icon name="calendar-check" size={18} className="text-green" />
          No next actions due this week.
        </div>
      )}
    </>
  );

  return (
    <section className="flex flex-col gap-3 md:block md:gap-0 md:overflow-hidden md:rounded-[18px] md:border md:border-line md:bg-surface md:pb-2 md:shadow-[var(--shadow-sm)]">
      <div className="flex items-center gap-2 md:gap-2.5 md:px-5 md:pt-[18px] md:pb-2.5">
        <h2 className="m-0 font-display text-lg font-semibold md:text-[17px]">Due this week</h2>
        <CountChip>{open.length}</CountChip>
      </div>
      <div className="overflow-hidden rounded-[18px] border border-line bg-surface pt-1 pb-1.5 md:rounded-none md:border-0 md:bg-transparent md:p-0">{body}</div>
    </section>
  );
}
