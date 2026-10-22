import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PhoneTitle } from "@/components/shell/page-title";
import { ExportButton } from "@/components/ui/export-button";
import { Icon } from "@/components/ui/icon";
import { EmptyState, Skeleton } from "@/components/ui/kit";
import { flagMeta, hueClass } from "@/components/ui/pills";
import { requireUser } from "@/lib/auth/dal";
import { cn } from "@/lib/cn";
import { FLAG_DEFS, FLAG_KEYS, getFlagDrill, type FlagKey } from "@/lib/queries/cockpit";
import { requestNow } from "@/lib/queries/common";

type Params = Promise<{ flag: string }>;

export const metadata: Metadata = { title: "Flag list · Cockpit" };

export default function FlagListPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<DrillSkeleton />}>
      <FlagList params={params} />
    </Suspense>
  );
}

const ROW_COLS = "md:grid md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)_150px_170px_24px] md:gap-3.5";

async function FlagList({ params }: { params: Params }) {
  const user = await requireUser();
  const { flag: raw } = await params;
  if (!FLAG_KEYS.includes(raw as FlagKey)) notFound();
  const flag = raw as FlagKey;
  const { now } = await requestNow();
  const { rows, counts } = await getFlagDrill(flag, now);
  const def = FLAG_DEFS[flag];
  const meta = flagMeta(flag);
  const Title = `${def.title.charAt(0).toUpperCase()}${def.title.slice(1)}`;

  return (
    <div className="flex flex-col gap-[18px]">
      <PhoneTitle title={Title} back="/cockpit" />
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex min-w-[240px] flex-1 flex-col gap-1.5">
          <span className="hidden items-center gap-1.5 text-[13px] text-text-3 md:flex">
            <Link href="/cockpit" className="text-text-2">
              Cockpit
            </Link>
            <Icon name="chevron-right" size={13} />
            {def.title}
          </span>
          <span className="flex flex-wrap items-center gap-2.5">
            <span className={cn("inline-flex h-7 items-center gap-1.5 rounded-full pr-[11px] pl-2.5 text-[13.5px] font-semibold", hueClass(meta.hue))}>
              <Icon name={meta.icon} size={14} />
              {def.label}
            </span>
            <h1 className="m-0 font-display text-[21px] font-semibold tracking-[-0.02em] md:text-[26px]">
              {rows.length} {def.title}
            </h1>
          </span>
          <p className="m-0 text-sm text-text-2">{def.rule}</p>
        </div>
        {user.isCeo && (
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line-strong px-3 text-[13px] font-semibold text-text-2">
            <Icon name="eye" size={14} />
            Read-only list
          </span>
        )}
        <ExportButton href={`/cockpit/flags/${flag}/export`} />
      </div>

      <div role="tablist" aria-label="Flags" className="no-scrollbar flex gap-2 overflow-x-auto max-md:flex-nowrap md:flex-wrap">
        {FLAG_KEYS.map((k) => {
          const on = k === flag;
          const m = flagMeta(k);
          return (
            <Link
              key={k}
              href={`/cockpit/flags/${k}`}
              role="tab"
              aria-selected={on}
              replace
              style={on ? { borderColor: `var(--${m.hue})` } : undefined}
              className={cn(
                "inline-flex h-11 flex-none items-center gap-1.5 rounded-full border px-3.5 text-[13.5px] font-semibold whitespace-nowrap hover:no-underline md:h-9",
                on ? cn(hueClass(m.hue), "hover:text-current") : "border-line-strong bg-surface text-ink hover:bg-surface-2 hover:text-ink",
              )}
            >
              <Icon name={m.icon} size={14} style={{ color: `var(--${m.hue})` }} />
              {FLAG_DEFS[k].label} <span className="font-medium text-text-3">{counts[k]}</span>
            </Link>
          );
        })}
      </div>

      <div className="overflow-hidden rounded-[18px] border border-line bg-surface shadow-[var(--shadow-sm)]">
        <div className={cn("hidden bg-surface-2 px-5 py-2.5 text-[11.5px] font-semibold tracking-[0.05em] text-text-3 uppercase", ROW_COLS)}>
          <span>{def.c1}</span>
          <span>{def.c2}</span>
          <span>Owner</span>
          <span>{def.c4}</span>
          <span />
        </div>
        {rows.map((r) => (
          <Link
            key={r.key}
            href={r.href}
            className={cn(
              "flex flex-col gap-1.5 px-4 py-3 text-ink hover:bg-surface-2 hover:text-ink hover:no-underline md:items-center md:px-5",
              ROW_COLS,
              "border-t border-line max-md:first:border-t-0",
            )}
          >
            {/* desktop cells */}
            <span className="hidden min-w-0 flex-col gap-0.5 md:flex">
              <span className="truncate text-[14.5px] font-semibold">{r.a}</span>
              <span className="truncate text-[12.5px] text-text-2">{r.a2}</span>
            </span>
            <span className="hidden truncate text-[13.5px] text-text-2 md:block">{r.b}</span>
            <span className="hidden truncate text-[13.5px] md:block">{r.owner}</span>
            <span className={cn("hidden h-6 items-center gap-[5px] justify-self-start rounded-full pr-[9px] pl-2 text-[12.5px] font-semibold whitespace-nowrap md:inline-flex", hueClass(meta.hue))}>
              <Icon name={meta.icon} size={13} />
              {r.d}
            </span>
            <Icon name="chevron-right" size={16} className="hidden text-text-3 md:block" />

            {/* phone card */}
            <span className="flex items-start gap-3 md:hidden">
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[14.5px] font-semibold">{r.a}</span>
                <span className="text-[12.5px] text-text-2">{r.a2}</span>
              </span>
              <Icon name="chevron-right" size={18} className="mt-0.5 text-text-3" />
            </span>
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1.5 md:hidden">
              <span className={cn("inline-flex h-6 items-center gap-[5px] rounded-full pr-[9px] pl-2 text-[12.5px] font-semibold whitespace-nowrap", hueClass(meta.hue))}>
                <Icon name={meta.icon} size={13} />
                {r.d}
              </span>
              <span className="text-[13px] text-text-2">
                {r.b} · {r.owner}
              </span>
            </span>
          </Link>
        ))}
        {rows.length === 0 && (
          <EmptyState
            icon="shield-check"
            title={`No ${def.title} right now`}
            text="Nothing needs attention here. This list updates as visits and deals change."
            action={
              <Link href="/cockpit" className="text-sm font-semibold">
                Back to Cockpit
              </Link>
            }
          />
        )}
      </div>
    </div>
  );
}

function DrillSkeleton() {
  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-col gap-2">
        <Skeleton className="hidden h-4 w-40 md:block" />
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="flex gap-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-32 rounded-full" />
        ))}
      </div>
      <div className="overflow-hidden rounded-[18px] border border-line bg-surface">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="flex items-center gap-3.5 border-t border-line px-5 py-3.5 first:border-t-0">
            <span className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-2.5 w-1/3" />
            </span>
            <Skeleton className="h-[22px] w-16 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
