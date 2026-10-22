import type { ReactNode } from "react";
import { outcomeOf, proposalStatusOf, stageOf, type Hue } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { humanizeHours } from "@/lib/time";
import { Icon } from "./icon";

const HUE: Record<Hue, string> = {
  slate: "text-slate bg-slate-bg",
  aqua: "text-aqua bg-aqua-bg",
  blue: "text-blue bg-blue-bg",
  violet: "text-violet bg-violet-bg",
  green: "text-green bg-green-bg",
  red: "text-red bg-red-bg",
  amber: "text-amber bg-amber-bg",
};
export const hueClass = (h: Hue) => HUE[h];

export function Pill({
  hue,
  icon,
  children,
  size = "md",
  className,
  title,
}: {
  hue: Hue;
  icon?: string;
  children: ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
  title?: string;
}) {
  const s = {
    sm: "h-[22px] gap-[5px] px-2 text-xs",
    md: "h-6 gap-1.5 pr-2.5 pl-2 text-[12.5px]",
    lg: "h-7 gap-1.5 pr-3 pl-2.5 text-[13px]",
  }[size];
  return (
    <span title={title} className={cn("inline-flex flex-none items-center rounded-full font-semibold whitespace-nowrap", s, HUE[hue], className)}>
      {icon && <Icon name={icon} size={size === "lg" ? 14 : size === "sm" ? 12 : 13} />}
      {children}
    </span>
  );
}

export function StagePill({ stage, size }: { stage: string; size?: "sm" | "md" | "lg" }) {
  const s = stageOf(stage);
  return (
    <Pill hue={s.hue} icon={s.icon} size={size}>
      {s.label}
    </Pill>
  );
}

export function OutcomePill({ outcome, short, size }: { outcome: string; short?: boolean; size?: "sm" | "md" | "lg" }) {
  const o = outcomeOf(outcome);
  return (
    <Pill hue={o.hue} icon={o.icon} size={size}>
      {short ? o.short : o.label}
    </Pill>
  );
}

export function ProposalStatusPill({ status }: { status: string }) {
  const p = proposalStatusOf(status);
  return (
    <Pill hue={p.hue} icon={p.icon} size="sm">
      {p.key}
    </Pill>
  );
}

/** Small grey count chip next to section titles. */
export function CountChip({ children, tone = "slate", icon }: { children: ReactNode; tone?: "slate" | "red" | "amber" | "green"; icon?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[22px] items-center gap-[5px] rounded-full px-[9px] text-xs font-bold",
        tone === "slate" ? "bg-slate-bg text-text-2" : HUE[tone],
      )}
    >
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  );
}

export type FlagKind = "stuck" | "dormant" | "outcome" | "close";
const FLAG: Record<FlagKind, { hue: Hue; icon: string; label: string }> = {
  stuck: { hue: "red", icon: "hourglass", label: "Stuck" },
  dormant: { hue: "amber", icon: "moon", label: "Dormant" },
  outcome: { hue: "red", icon: "alarm-clock", label: "Outcome overdue" },
  close: { hue: "red", icon: "calendar-x", label: "Close passed" },
};
export const flagMeta = (k: FlagKind) => FLAG[k];

export function FlagPill({ kind, children, title, size = "sm" }: { kind: FlagKind; children?: ReactNode; title?: string; size?: "sm" | "md" }) {
  const f = FLAG[kind];
  return (
    <Pill hue={f.hue} icon={f.icon} size={size} title={title}>
      {children ?? f.label}
    </Pill>
  );
}

export function PriorityBadge({ priority }: { priority: string | null }) {
  if (!priority) return <span className="text-text-3">—</span>;
  const cls =
    priority === "P1"
      ? "bg-ink text-surface border-ink"
      : priority === "P2"
        ? "bg-green-bg text-green border-transparent"
        : "bg-transparent text-text-2 border-line-strong";
  const icon = priority === "P1" ? "signal-high" : priority === "P2" ? "signal-medium" : "signal-low";
  return (
    <span className={cn("inline-flex h-[22px] flex-none items-center gap-1 rounded-[7px] border px-[7px] text-[11.5px] font-bold", cls)}>
      <Icon name={icon} size={12} />
      {priority}
    </span>
  );
}

export function StatusPill({ status }: { status: "active" | "dormant" | "archived" }) {
  if (status === "dormant") return <Pill hue="amber" icon="moon" size="sm">Dormant</Pill>;
  if (status === "archived") return <Pill hue="slate" icon="archive" size="sm">Archived</Pill>;
  return <Pill hue="green" icon="circle-check" size="sm">Active</Pill>;
}

export function VerifiedPill({ verified }: { verified: boolean }) {
  return verified ? (
    <Pill hue="green" icon="badge-check" size="sm">Verified</Pill>
  ) : (
    <Pill hue="amber" icon="circle-help" size="sm">To confirm</Pill>
  );
}

/** 48-hour outcome countdown. */
export function countdown(hrsLeft: number) {
  if (hrsLeft <= 0) {
    const late = -hrsLeft;
    return { label: `Overdue · ${humanizeHours(late)}`, short: "Overdue", lateBy: humanizeHours(late), hue: "red" as Hue, bar: "var(--red-solid)", pct: 100, icon: "alarm-clock", overdue: true };
  }
  const label = hrsLeft < 1 ? `${Math.max(1, Math.round(hrsLeft * 60))} min left` : `${Math.round(hrsLeft)} hrs left`;
  const pct = Math.max(4, Math.round((hrsLeft / 48) * 100));
  return hrsLeft < 12
    ? { label, short: label, lateBy: "", hue: "amber" as Hue, bar: "var(--amber-solid)", pct, icon: "timer", overdue: false }
    : { label, short: label, lateBy: "", hue: "slate" as Hue, bar: "var(--green-solid)", pct, icon: "timer", overdue: false };
}

export function CountdownPill({ hrsLeft, short, title, withBar }: { hrsLeft: number; short?: boolean; title?: string; withBar?: boolean }) {
  const c = countdown(hrsLeft);
  const pill = (
    <span
      title={title}
      className={cn(
        "inline-flex h-[26px] flex-none items-center gap-1.5 rounded-full px-2.5 text-[12.5px] font-semibold whitespace-nowrap",
        c.hue === "slate" ? "bg-slate-bg text-text-2" : HUE[c.hue],
      )}
    >
      <Icon name={c.icon} size={13} />
      {short ? c.short : c.label}
    </span>
  );
  if (!withBar) return pill;
  return (
    <span className="flex flex-none flex-col items-end gap-1.5">
      {pill}
      <span className="block h-1 w-24 overflow-hidden rounded-full bg-line">
        <span className="block h-full rounded-full" style={{ width: `${c.pct}%`, background: c.bar }} />
      </span>
    </span>
  );
}
