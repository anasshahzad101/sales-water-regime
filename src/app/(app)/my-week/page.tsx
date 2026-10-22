import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/kit";
import { CountChip, flagMeta, FlagPill, hueClass, StagePill, type FlagKind } from "@/components/ui/pills";
import { requireUser } from "@/lib/auth/dal";
import { money, moneyFull } from "@/lib/format";
import { requestNow } from "@/lib/queries/common";
import { getMyWeek, type FlagItem, type MyDeal } from "@/lib/queries/my-week";
import { cn } from "@/lib/cn";
import { fmtDate, fmtTime, fmtWeekday, fmtWeekdayLong, greeting } from "@/lib/time";
import { DueList } from "./due-list";
import { OutcomeList } from "./outcome-list";
import { redirect } from "next/navigation";

export const metadata: Metadata = { title: "My Week" };

export default function MyWeekPage() {
  return (
    <Suspense fallback={<MyWeekSkeleton />}>
      <MyWeek />
    </Suspense>
  );
}

async function MyWeek() {
  const user = await requireUser();
  if (user.isCeo) redirect("/cockpit");
  const { now } = await requestNow();
  const data = await getMyWeek(user, now);
  const firstName = user.name.split(" ")[0];

  const overdueVisits = data.pendingVisits.filter((v) => v.hrsLeft <= 0).length;
  const overdueActs = data.dueActions.filter((a) => !a.done && a.group === "overdue").length;
  const flagCount = data.flags.stuck.length + data.flags.dormant.length + data.flags.closePassed.length;
  let summary: string;
  if (data.isNew) summary = "Welcome to WR Sales Hub. Here’s how to get started.";
  else {
    const parts = [];
    if (overdueVisits) parts.push(`${overdueVisits} overdue outcome${overdueVisits > 1 ? "s" : ""}`);
    if (overdueActs) parts.push(`${overdueActs} overdue action${overdueActs > 1 ? "s" : ""}`);
    summary = parts.length
      ? `${parts.join(" and ")} need${parts.length === 1 && (overdueVisits || overdueActs) === 1 ? "s" : ""} you first.`
      : data.pendingVisits.length
        ? `${data.pendingVisits.length} visit${data.pendingVisits.length > 1 ? "s" : ""} waiting for an outcome. Nothing overdue.`
        : flagCount
          ? "Nothing overdue. A few items in Self-correction need a look."
          : "Nothing pending. Every visit has an outcome and nothing is slipping.";
  }

  return (
    <div className="flex flex-col gap-6">
      {/* header */}
      <div className="flex flex-col gap-3.5 md:flex-row md:flex-wrap md:items-end md:gap-6">
        <div className="flex flex-col gap-1 md:min-w-[280px] md:flex-1 md:gap-1.5">
          <span className="text-[13px] font-semibold text-text-2">
            <span className="max-md:hidden">
              {fmtWeekdayLong(now)}, {fmtDate(now)}
            </span>
            <span className="md:hidden">
              {fmtWeekday(now)} {fmtDate(now)} · {fmtTime(now)} PKT
            </span>
          </span>
          <h1 className="m-0 font-display text-[25px] leading-[1.2] font-semibold tracking-[-0.02em] md:text-[30px] md:leading-[1.15]">
            {greeting(now)}, {firstName}
          </h1>
          <p className="m-0 text-[14.5px] leading-[1.45] text-pretty text-text-2 md:text-[15px]">{summary}</p>
        </div>
        <Link
          href="/log"
          className="flex h-[54px] items-center justify-center gap-2.5 rounded-full bg-cta px-[26px] text-[16.5px] font-bold text-on-cta shadow-[0_12px_28px_-12px_rgba(0,169,80,0.75)] hover:bg-cta-hover hover:text-on-cta hover:no-underline md:inline-flex md:h-[52px] md:pl-[22px] md:text-base"
        >
          <Icon name="notebook-pen" size={19} />
          Log a visit
        </Link>
      </div>

      {data.isNew ? (
        <Onboarding total={data.totalCompanies} />
      ) : (
        <div className="flex flex-col gap-6 md:flex-row md:flex-wrap md:items-start">
          <div className="contents md:flex md:min-w-0 md:flex-[999_1_600px] md:flex-col md:gap-6">
            <div className="order-1">
              <OutcomeList visits={data.pendingVisits} canEdit={user.canEdit} />
            </div>
            <div className="order-3">
              <DealsSection deals={data.myDeals} />
            </div>
          </div>
          <div className="contents md:flex md:min-w-0 md:flex-[1_1_376px] md:flex-col md:gap-6">
            <div className="order-2">
              <DueList items={data.dueActions} canEdit={user.canEdit} />
            </div>
            <div className="order-4">
              <FlagsSection flags={data.flags} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DealsSection({ deals }: { deals: MyDeal[] }) {
  const total = deals.reduce((n, d) => n + (d.value ?? 0), 0);
  const grid = "md:grid md:grid-cols-[minmax(0,1fr)_178px_108px_164px] md:gap-4";
  return (
    <section className="flex flex-col gap-3 md:block md:gap-0 md:overflow-hidden md:rounded-[18px] md:border md:border-line md:bg-surface md:shadow-[var(--shadow-sm)]">
      <div className="flex items-center gap-2 md:gap-2.5 md:px-5 md:pt-[18px] md:pb-3.5">
        <h2 className="m-0 font-display text-lg font-semibold md:text-[17px]">My open deals</h2>
        <CountChip>{deals.length}</CountChip>
        <span title={moneyFull(total)} className="font-display text-[15px] font-semibold tabular-nums max-md:ml-auto">
          {money(total)}
        </span>
        <Link href="/pulse" className="ml-auto hidden items-center gap-1.5 text-[13px] font-semibold text-link md:inline-flex">
          Team Pulse
          <Icon name="arrow-right" size={14} />
        </Link>
      </div>
      <div className="overflow-hidden rounded-[18px] border border-line bg-surface md:rounded-none md:border-0 md:bg-transparent">
        <div className={cn("hidden border-t border-line bg-surface-2 px-5 py-[9px] text-[11.5px] font-semibold tracking-[0.05em] text-text-3 uppercase", grid)}>
          <span>Deal</span>
          <span>Stage</span>
          <span className="text-right">Value</span>
          <span>In stage</span>
        </div>
        {deals.map((d, i) => (
          <Link
            key={d.id}
            href={`/deals/${d.id}`}
            className={cn(
              "flex flex-col gap-2 px-4 py-3.5 text-ink hover:bg-surface-2 hover:text-ink hover:no-underline md:items-center md:border-t md:border-line md:px-5 md:py-3",
              grid,
              i > 0 && "border-t border-line",
            )}
          >
            <span className="flex items-start gap-3 md:contents">
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[14.5px] font-semibold md:truncate md:text-sm">{d.title}</span>
                <span className="text-[13px] text-text-2">{d.company}</span>
              </span>
              <span className="text-[15px] font-semibold whitespace-nowrap tabular-nums md:hidden">{money(d.value)}</span>
            </span>
            <span className="flex flex-wrap items-center gap-1.5 md:contents">
              <span>
                <StagePill stage={d.stage} />
              </span>
              <span title={moneyFull(d.value)} className="hidden text-right text-sm font-semibold tabular-nums md:block">
                {money(d.value)}
              </span>
              <span className="flex flex-wrap items-center gap-1.5">
                {d.stuck ? (
                  <FlagPill kind="stuck">Stuck · {d.days} d</FlagPill>
                ) : (
                  <span className="text-[12.5px] text-text-2 tabular-nums md:text-[13px]">
                    {d.days} d<span className="md:hidden"> in stage</span>
                  </span>
                )}
                {d.closePassed && <FlagPill kind="close" title={`Expected close ${d.close}`} />}
              </span>
            </span>
          </Link>
        ))}
        {deals.length === 0 && (
          <div className="px-5 py-6 text-[13.5px] text-text-2 md:border-t md:border-line">
            No open deals yet.{" "}
            <Link href="/deals/new" className="font-semibold">
              Open a deal
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}

function FlagsSection({ flags }: { flags: { stuck: FlagItem[]; dormant: FlagItem[]; closePassed: FlagItem[] } }) {
  const groups: { kind: FlagKind; title: string; items: FlagItem[] }[] = [
    { kind: "stuck" as const, title: "Stuck deals", items: flags.stuck },
    { kind: "dormant" as const, title: "Dormant accounts", items: flags.dormant },
    { kind: "close" as const, title: "Overdue close dates", items: flags.closePassed },
  ].filter((g) => g.items.length);
  const count = groups.reduce((n, g) => n + g.items.length, 0);
  return (
    <section className="flex flex-col gap-3 md:block md:gap-0 md:overflow-hidden md:rounded-[18px] md:border md:border-line md:bg-surface md:pb-2 md:shadow-[var(--shadow-sm)]">
      <div className="flex flex-col gap-0.5 md:px-5 md:pt-[18px] md:pb-1.5">
        <div className="flex items-center gap-2 md:gap-2.5">
          <h2 className="m-0 font-display text-lg font-semibold md:text-[17px]">Self-correction</h2>
          <CountChip>{count}</CountChip>
        </div>
        <span className="text-[13px] text-text-2">Fix these before anyone has to ask.</span>
      </div>
      <div className="overflow-hidden rounded-[18px] border border-line bg-surface pt-1 pb-1.5 md:rounded-none md:border-0 md:bg-transparent md:p-0">
        {groups.map((g) => (
          <div key={g.kind}>
            <div className="flex items-center gap-2 px-4 pt-3 pb-0.5 md:px-5 md:pb-1">
              <span className={cn("inline-flex h-[22px] items-center gap-[5px] rounded-full px-2 text-xs font-semibold", hueClass(flagMeta(g.kind).hue))}>
                <Icon name={flagMeta(g.kind).icon} size={12} />
                {flagMeta(g.kind).label}
              </span>
              <span className="text-[13px] font-semibold text-text-2">
                <span className="max-md:hidden">{g.title} · </span>
                {g.items.length}
              </span>
            </div>
            {g.items.map((it) => (
              <Link
                key={it.href}
                href={it.href}
                className="flex min-h-14 items-center gap-2.5 py-1.5 pr-3 pl-4 text-ink hover:bg-surface-2 hover:text-ink hover:no-underline md:min-h-0 md:px-5 md:py-2"
              >
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[14.5px] font-medium md:text-sm">{it.title}</span>
                  <span className="text-[12.5px] text-text-2">{it.meta}</span>
                </span>
                <Icon name="chevron-right" size={16} className="text-text-3" />
              </Link>
            ))}
          </div>
        ))}
        {count === 0 && (
          <div className="flex items-center gap-3 px-4 pt-2 pb-3.5 text-[13.5px] text-text-2 md:px-5">
            <Icon name="shield-check" size={18} className="text-green" />
            No stuck deals, dormant accounts or passed close dates.
          </div>
        )}
      </div>
    </section>
  );
}

function Onboarding({ total }: { total: number }) {
  const steps = [
    { n: 1, title: "Claim your accounts", text: `Pick the companies you're chasing from the shared list of ${total}.`, cta: "Browse accounts", href: "/accounts" },
    { n: 2, title: "Log your first visit", text: "Calls and emails count too. Set the outcome within 48 hrs.", cta: "Log a visit", href: "/log" },
    { n: 3, title: "Open a deal", text: "Track value and stage from first lead to PO.", cta: "New deal", href: "/deals/new" },
  ];
  return (
    <>
      <section className="hidden flex-col gap-6 rounded-[28px] border border-line bg-surface p-8 shadow-[var(--shadow-sm)] md:flex">
        <div className="flex max-w-[620px] flex-col gap-1.5">
          <h2 className="m-0 font-display text-[22px] font-semibold tracking-[-0.01em]">Your week is empty — for now</h2>
          <p className="m-0 text-[14.5px] leading-[1.55] text-pretty text-text-2">
            My Week fills itself from your accounts, visits and deals: outcomes to set, next actions, and anything that&apos;s slipping. Three steps get you going.
          </p>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {steps.map((s) => (
            <div key={s.n} className="flex flex-col gap-2.5 rounded-[18px] border border-line bg-surface-2 p-5">
              <span className="flex size-8 items-center justify-center rounded-full bg-brand-soft font-display text-sm font-semibold text-green">{s.n}</span>
              <span className="text-[15px] font-semibold">{s.title}</span>
              <span className="text-[13.5px] leading-normal text-text-2">{s.text}</span>
              <Link href={s.href} className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-link">
                {s.cta}
                <Icon name="arrow-right" size={15} />
              </Link>
            </div>
          ))}
        </div>
      </section>
      <section className="flex flex-col gap-3 md:hidden">
        <h2 className="m-0 font-display text-lg font-semibold">Get started</h2>
        {steps.map((s) => (
          <Link key={s.n} href={s.href} className="flex items-center gap-3.5 rounded-[18px] border border-line bg-surface p-4 text-ink hover:text-ink hover:no-underline">
            <span className="flex size-9 flex-none items-center justify-center rounded-full bg-brand-soft font-display font-semibold text-green">{s.n}</span>
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="text-[15px] font-semibold">{s.title}</span>
              <span className="text-[13px] text-text-2">{s.text}</span>
            </span>
            <Icon name="chevron-right" size={18} className="text-text-3" />
          </Link>
        ))}
      </section>
    </>
  );
}

function MyWeekSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-9 w-72" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="flex flex-col gap-6 md:flex-row">
        <div className="flex flex-col gap-6 md:flex-[999_1_600px]">
          <Skeleton className="h-80 rounded-[18px]" />
          <Skeleton className="h-64 rounded-[18px]" />
        </div>
        <div className="flex flex-col gap-6 md:flex-[1_1_376px]">
          <Skeleton className="h-56 rounded-[18px]" />
          <Skeleton className="h-56 rounded-[18px]" />
        </div>
      </div>
    </div>
  );
}
