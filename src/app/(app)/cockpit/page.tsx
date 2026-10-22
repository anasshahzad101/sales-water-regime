import type { Metadata } from "next";
import Link from "next/link";
import { Suspense, type CSSProperties, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/kit";
import { flagMeta, hueClass } from "@/components/ui/pills";
import { requireUser } from "@/lib/auth/dal";
import { cn } from "@/lib/cn";
import { money, moneyFull } from "@/lib/format";
import { FLAG_DEFS, FLAG_KEYS, getCockpit, resolveRange, type LostRow, type PersonRow, type StageRow } from "@/lib/queries/cockpit";
import { requestNow } from "@/lib/queries/common";
import { CustomRange, RangeControl } from "./range-control";

export const metadata: Metadata = { title: "Cockpit" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default function CockpitPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<CockpitSkeleton />}>
      <Cockpit searchParams={searchParams} />
    </Suspense>
  );
}

async function Cockpit({ searchParams }: { searchParams: SP }) {
  await requireUser();
  const { now, today } = await requestNow();
  const range = resolveRange(await searchParams, now);
  const data = await getCockpit(now, range);
  const k = data.kpis;

  const kpis: { label: string; icon: string; color: string; value: string; title?: string; sub: string; bar?: number }[] = [
    { label: "Open pipeline", icon: "layers", color: "var(--blue)", value: money(k.openValue), title: moneyFull(k.openValue), sub: `${k.openCount} open deal${k.openCount === 1 ? "" : "s"}` },
    { label: "Weighted pipeline", icon: "scale", color: "var(--violet)", value: money(k.weighted), title: moneyFull(k.weighted), sub: "Value × probability" },
    { label: "Won", icon: "trophy", color: "var(--green)", value: money(k.wonValue), title: moneyFull(k.wonValue), sub: `${k.wonCount} deal${k.wonCount === 1 ? "" : "s"} with PO` },
    {
      label: "Win rate",
      icon: "target",
      color: "var(--green)",
      value: k.winRate == null ? "—" : `${k.winRate}%`,
      sub: k.winRate == null ? "No deals closed in this period" : `${k.wonCount} won · ${k.lostCount} lost`,
      bar: k.winRate ?? 0,
    },
    { label: "Accounts", icon: "building-2", color: "var(--aqua)", value: k.accounts.toLocaleString("en-US"), sub: `${k.owned} owned · ${k.unassigned} unassigned` },
    {
      label: "Visits · last 7 days",
      icon: "map-pin",
      color: "var(--aqua)",
      value: String(k.visits7),
      sub: k.visitors === 0 ? "No visits logged" : k.visitors === 1 ? "By 1 salesperson" : `By ${k.visitors} salespeople`,
    },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3.5">
        <div className="hidden min-w-[260px] flex-1 flex-col gap-1.5 md:flex">
          <h1 className="m-0 font-display text-[28px] font-semibold tracking-[-0.02em]">Cockpit</h1>
          <p className="m-0 text-[14.5px] text-text-2">How sales is going, and what needs attention · {range.text}</p>
        </div>
        <RangeControl value={range.key} />
      </div>
      {range.key === "custom" && <CustomRange key={`${range.fromYmd}_${range.toYmd}`} from={range.fromYmd} to={range.toYmd} max={today} />}
      <span className="-mt-2 text-[13px] text-text-2 md:hidden">{range.text}</span>

      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-4">
        {kpis.map((t) => (
          <div key={t.label} title={t.title} className="flex min-w-0 flex-col gap-1.5 rounded-[18px] border border-line bg-surface p-3.5 shadow-[var(--shadow-sm)] md:px-[18px] md:py-4">
            <span className="flex items-center gap-2 text-[13px] font-semibold text-text-2">
              <Icon name={t.icon} size={15} style={{ color: t.color }} />
              {t.label}
            </span>
            <span className="truncate font-display text-[18px] font-semibold tracking-[-0.02em] whitespace-nowrap tabular-nums min-[400px]:text-[21px] md:text-[26px]">{t.value}</span>
            {t.bar != null && (
              <span className="flex h-1.5 overflow-hidden rounded-full bg-red-bg" aria-hidden="true">
                <span className="bg-green-solid" style={{ width: `${t.bar}%` }} />
              </span>
            )}
            <span className="text-[12.5px] leading-[1.35] text-text-3">{t.sub}</span>
          </div>
        ))}
      </div>

      <Panel title="Self-correction flags" aside={<span className="text-[13px] text-text-2">Click a flag to see what&apos;s behind it.</span>} headClass="pb-1.5 pt-4">
        <div className="grid grid-cols-2 gap-3 px-5 pt-3 pb-5 md:grid-cols-4">
          {FLAG_KEYS.map((key) => {
            const def = FLAG_DEFS[key];
            const meta = flagMeta(key);
            const count = data.flagCounts[key];
            const style: CSSProperties = count
              ? {
                  borderColor: `color-mix(in srgb, var(--${meta.hue}) 30%, var(--line))`,
                  background: `color-mix(in srgb, var(--${meta.hue}-bg) 40%, var(--surface))`,
                }
              : {};
            return (
              <Link
                key={key}
                href={`/cockpit/flags/${key}`}
                style={style}
                className="flex min-w-0 flex-col gap-2 rounded-[14px] border border-line bg-surface px-4 py-3.5 text-left text-ink hover:text-ink hover:no-underline hover:shadow-[var(--shadow-md)]"
              >
                <span className="flex items-center gap-2">
                  <span className={cn("inline-flex min-h-6 min-w-0 items-center gap-[5px] rounded-full pr-[9px] pl-2 text-[12.5px] font-semibold max-md:rounded-xl max-md:py-0.5 max-md:leading-tight md:h-6", hueClass(meta.hue))}>
                    <Icon name={meta.icon} size={13} />
                    <span className="md:truncate">{def.label}</span>
                  </span>
                  <Icon name="arrow-up-right" size={16} className="ml-auto text-text-3 max-md:hidden" />
                </span>
                <span className="font-display text-[28px] font-semibold tabular-nums">{count}</span>
                <span className="text-[12.5px] leading-[1.35] text-text-2">{def.rule}</span>
              </Link>
            );
          })}
        </div>
      </Panel>

      <div className="grid items-start gap-5 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <PipelineByStage stages={data.stages} />
        <LostReasons rows={data.lostReasons} total={data.lostTotal} />
      </div>

      <People people={data.people} />
    </div>
  );
}

function Panel({ title, aside, children, headClass }: { title: string; aside?: ReactNode; children: ReactNode; headClass?: string }) {
  return (
    <section className="overflow-hidden rounded-[18px] border border-line bg-surface shadow-[var(--shadow-sm)]">
      <div className={cn("flex flex-wrap items-center gap-2.5 px-5 pt-4 pb-2.5", headClass)}>
        <h2 className="m-0 font-display text-[17px] font-semibold">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function PipelineByStage({ stages }: { stages: StageRow[] }) {
  const max = Math.max(1, ...stages.map((s) => s.value));
  const cols = "grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_40px] gap-3 md:grid-cols-[170px_minmax(0,1fr)_56px_110px]";
  return (
    <Panel title="Pipeline by stage">
      <div className={cn(cols, "px-5 py-1.5 text-[11.5px] font-semibold tracking-[0.05em] text-text-3 uppercase")}>
        <span>Stage</span>
        <span>Value</span>
        <span className="text-right">Deals</span>
        <span className="hidden text-right md:block">Weighted</span>
      </div>
      {stages.map((s) => {
        const fg = `var(--${s.hue})`;
        return (
          <div key={s.key} className={cn(cols, "items-center border-t border-line px-5 py-[9px]")}>
            <span className="flex min-w-0 items-center gap-[7px] text-[13.5px] font-semibold" style={{ color: fg }}>
              <Icon name={s.icon} size={15} />
              <span className="truncate">{s.label}</span>
            </span>
            <span className="flex min-w-0 items-center gap-2.5">
              {/* Up to 160px (90px on phones), but never so wide that the amount next to it is squeezed. */}
              <span
                className="h-3.5 min-w-[3px] flex-none rounded-[5px] [--bar:90px] md:[--bar:160px]"
                style={{ background: fg, width: `calc(${(s.value / max).toFixed(4)} * min(var(--bar), 100% - 104px))` }}
              />
              <span title={moneyFull(s.value)} className="text-[13.5px] font-semibold whitespace-nowrap tabular-nums">
                {money(s.value)}
              </span>
            </span>
            <span className="text-right text-[13.5px] tabular-nums">{s.count}</span>
            <span className="hidden text-right text-[13.5px] text-text-2 tabular-nums md:block" title={s.weighted != null ? moneyFull(s.weighted) : undefined}>
              {s.weighted != null ? money(s.weighted) : "—"}
            </span>
          </div>
        );
      })}
    </Panel>
  );
}

function LostReasons({ rows, total }: { rows: LostRow[]; total: { count: number; value: number } }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <Panel title="Lost reasons" aside={<span className="text-[13px] text-text-3">{`${total.count} deal${total.count === 1 ? "" : "s"} · ${money(total.value)}`}</span>}>
      {rows.map((l) => {
        const has = l.count > 0;
        return (
          <div key={l.reason} className="flex flex-col gap-1.5 border-t border-line px-5 py-[9px]">
            <span className="flex items-baseline gap-2.5">
              <span className={cn("min-w-0 flex-1 text-[13.5px]", has ? "text-ink" : "text-text-3")}>{l.reason}</span>
              <span className="text-[13px] text-text-2 tabular-nums">
                {l.count} {l.count === 1 ? "deal" : "deals"}
              </span>
              <span title={has ? moneyFull(l.value) : undefined} className={cn("w-24 text-right text-[13.5px] font-semibold tabular-nums", has ? "text-ink" : "text-text-3")}>
                {has && l.value ? money(l.value) : "—"}
              </span>
            </span>
            <span className="block h-2 overflow-hidden rounded-full bg-bg-alt" aria-hidden="true">
              <span className="block h-full rounded-full bg-red-solid" style={{ width: `${Math.round((l.value / max) * 100)}%` }} />
            </span>
          </div>
        );
      })}
    </Panel>
  );
}

function FlagChip({ kind, label, size = "sm" }: { kind: PersonRow["flags"][number]["kind"]; label: string; size?: "sm" | "md" }) {
  const meta = flagMeta(kind);
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-semibold whitespace-nowrap",
        size === "sm" ? "h-[22px] px-[7px] text-[11.5px]" : "h-6 px-2 text-xs",
        hueClass(meta.hue),
      )}
    >
      <Icon name={meta.icon} size={size === "sm" ? 11 : 12} />
      {label}
    </span>
  );
}

function People({ people }: { people: PersonRow[] }) {
  const maxVisits = Math.max(1, ...people.map((p) => p.visits));
  const cols = "md:grid md:grid-cols-[minmax(0,1.4fr)_100px_120px_140px_130px_minmax(0,1fr)] md:gap-3";
  return (
    <Panel title="By salesperson" aside={<span className="text-[13px] text-text-3">Sales and Manager users only</span>}>
      <div className={cn("hidden bg-surface-2 px-5 py-2 text-[11.5px] font-semibold tracking-[0.05em] text-text-3 uppercase", cols)}>
        <span>Salesperson</span>
        <span className="text-right">Open deals</span>
        <span className="text-right">Open value</span>
        <span className="text-right">Weighted</span>
        <span className="text-right">Visits · 7 d</span>
        <span>Flags</span>
      </div>
      {people.map((p) => (
        <div key={p.id} className="border-t border-line">
          {/* desktop row */}
          <div className={cn("hidden items-center px-5 py-[11px]", cols)}>
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-[30px] flex-none items-center justify-center rounded-full bg-brand-soft text-[11px] font-bold text-green">{p.initials}</span>
              <span className="flex min-w-0 flex-col gap-px">
                <span className="truncate text-sm font-semibold">{p.name}</span>
                <span className="truncate text-xs text-text-3">
                  {p.role}
                  {p.region ? ` · ${p.region}` : ""}
                </span>
              </span>
            </span>
            <span className="text-right text-sm tabular-nums">{p.open}</span>
            <span className="text-right text-sm font-semibold tabular-nums" title={moneyFull(p.value)}>
              {money(p.value)}
            </span>
            <span className="text-right text-sm text-text-2 tabular-nums" title={moneyFull(p.weighted)}>
              {money(p.weighted)}
            </span>
            <span className="flex items-center justify-end gap-2">
              <span className="block h-1.5 w-14 overflow-hidden rounded-full bg-bg-alt" aria-hidden="true">
                <span className="block h-full bg-[#14C2C9]" style={{ width: `${Math.round((p.visits / maxVisits) * 100)}%` }} />
              </span>
              <span className="w-[22px] text-right text-sm tabular-nums">{p.visits}</span>
            </span>
            <span className="flex flex-wrap gap-1.5">
              {p.flags.length ? p.flags.map((f) => <FlagChip key={f.kind} kind={f.kind} label={f.label} />) : <span className="text-[12.5px] text-text-3">None</span>}
            </span>
          </div>
          {/* phone card */}
          <div className="flex flex-col gap-2.5 px-4 py-3.5 md:hidden">
            <span className="flex items-center gap-2.5">
              <span className="flex size-8 flex-none items-center justify-center rounded-full bg-brand-soft text-[11.5px] font-bold text-green">{p.initials}</span>
              <span className="flex min-w-0 flex-1 flex-col gap-px">
                <span className="truncate text-[15px] font-semibold">{p.name}</span>
                <span className="truncate text-[12.5px] text-text-3">
                  {p.role}
                  {p.region ? ` · ${p.region}` : ""}
                </span>
              </span>
              <span className="font-display text-[15px] font-semibold tabular-nums">{money(p.value)}</span>
            </span>
            <span className="flex gap-3.5 text-[13px] text-text-2">
              <span>
                {p.open} open deal{p.open === 1 ? "" : "s"}
              </span>
              <span>{p.visits} visits · 7 d</span>
            </span>
            {p.flags.length > 0 && (
              <span className="flex flex-wrap gap-1.5">
                {p.flags.map((f) => (
                  <FlagChip key={f.kind} kind={f.kind} label={f.label} size="md" />
                ))}
              </span>
            )}
          </div>
        </div>
      ))}
      {people.length === 0 && <div className="border-t border-line px-5 py-6 text-[13.5px] text-text-2">No active Sales or Manager users yet.</div>}
    </Panel>
  );
}

function CockpitSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3.5">
        <div className="hidden flex-1 flex-col gap-2 md:flex">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="h-10 w-full rounded-full md:h-[38px] md:w-[420px]" />
      </div>
      <div className="grid grid-cols-2 gap-2.5 md:grid-cols-3 md:gap-4">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[110px] rounded-[18px]" />
        ))}
      </div>
      <Skeleton className="h-[190px] rounded-[18px]" />
      <div className="grid gap-5 md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <Skeleton className="h-72 rounded-[18px]" />
        <Skeleton className="h-72 rounded-[18px]" />
      </div>
      <Skeleton className="h-64 rounded-[18px]" />
    </div>
  );
}
