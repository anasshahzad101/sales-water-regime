import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PhoneTitle } from "@/components/shell/page-title";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/kit";
import { CountdownPill, OutcomePill, PriorityBadge, StagePill, StatusPill } from "@/components/ui/pills";
import { requireUser } from "@/lib/auth/dal";
import { cn } from "@/lib/cn";
import { visitTypeIcon } from "@/lib/constants";
import { money, moneyFull, websiteHref } from "@/lib/format";
import { getAccount } from "@/lib/queries/accounts";
import { requestNow } from "@/lib/queries/common";
import { dormancy, outcomeHoursLeft } from "@/lib/rules";
import { fmtCalendar, fmtDate, fmtDateTime } from "@/lib/time";
import { AccountActions } from "./account-actions";
import { AccountSections } from "./account-sections";
import { ContactsPanel } from "./contacts-panel";

export const metadata: Metadata = { title: "Account" };

type Params = Promise<{ id: string }>;

export default function AccountPage({ params }: { params: Params }) {
  return (
    <Suspense fallback={<AccountSkeleton />}>
      <Account params={params} />
    </Suspense>
  );
}

async function Account({ params }: { params: Params }) {
  const user = await requireUser();
  const { now } = await requestNow();
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const data = await getAccount(Number(id), user, now);
  if (!data) notFound();
  const { company: c, row, contacts, deals, visits } = data;
  const ro = !user.canEdit;
  const dorm = dormancy(c, row.lastVisit, now);
  const geo = [row.sector, row.sub, row.city].filter(Boolean).join(" · ");

  const facts: { k: string; v: React.ReactNode; title?: string; cls?: string }[] = [
    { k: "Owner", v: row.owner ? (row.isMine ? `${row.owner} (you)` : row.owner) : "Unassigned", cls: cn("font-semibold", row.ownerId ? "text-ink" : "text-text-3") },
    {
      k: "Last visit",
      v: row.lastVisit ? `${fmtDate(row.lastVisit)} · ${row.days === 0 ? "today" : `${row.days} d ago`}` : "Never",
      cls: row.status === "dormant" ? "text-amber" : "text-ink",
    },
    { k: "Lead source", v: row.leadSource ?? "—" },
    { k: "Water need", v: row.waterNeed ?? "—", title: row.waterNeed ?? undefined },
    { k: "Est. capacity", v: row.capacityMld != null ? `${row.capacityMld} MLD` : "—" },
    { k: "Parent group", v: row.group ?? "—", title: row.group ?? undefined },
    {
      k: "Website",
      v: row.website ? (
        <a href={websiteHref(row.website)} target="_blank" rel="noopener noreferrer" className="text-link">
          {row.website}
        </a>
      ) : (
        "—"
      ),
    },
  ];

  const timeline = (
    <section className="overflow-hidden rounded-[18px] border border-line bg-surface shadow-[var(--shadow-sm)]">
      <div className="flex items-center gap-2.5 px-5 py-4">
        <h2 className="m-0 font-display text-[17px] font-semibold">Visit timeline</h2>
        <span className="text-[13px] text-text-3">Newest first</span>
      </div>
      <div className="px-5 pt-1 pb-2">
        {visits.map((v, i) => {
          const pending = v.outcome === "pending";
          // Logged in the last 15 minutes, for a visit that itself happened recently.
          const isNew = now.getTime() - v.createdAt.getTime() < 15 * 60_000 && now.getTime() - v.visitAt.getTime() < 2 * 86_400_000;
          const last = i === visits.length - 1;
          return (
            <div key={v.id} className="flex gap-3.5">
              <div className="flex flex-none flex-col items-center">
                <span className={cn("flex size-9 items-center justify-center rounded-xl", pending ? "bg-amber-bg text-amber" : "bg-bg-alt text-text-2")}>
                  <Icon name={visitTypeIcon(v.visitType)} size={16} />
                </span>
                <span className={cn("my-1 min-h-3 w-0.5 flex-1", last ? "bg-transparent" : "bg-line")} />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5 pb-[18px]">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{v.visitType}</span>
                  <span className="text-[13px] text-text-2">{fmtDateTime(v.visitAt)}</span>
                  {isNew && <span className="inline-flex h-5 items-center rounded-full bg-aqua-bg px-[7px] text-[11.5px] font-bold text-aqua">Just logged</span>}
                  <span className="ml-auto">{pending ? <CountdownPill hrsLeft={outcomeHoursLeft(v.visitAt, now)} /> : <OutcomePill outcome={v.outcome} short />}</span>
                </div>
                <span className="text-[13px] text-text-2">
                  {v.who}
                  {v.contactMet ? ` · met ${v.contactMet}` : ""}
                </span>
                {v.discussion && <p className="m-0 text-sm leading-normal text-pretty">{v.discussion}</p>}
                {v.skipReason && <span className="text-[13px] text-text-2">Skipped: {v.skipReason}</span>}
                {v.lateReason && <span className="text-[13px] text-text-2">Late outcome: {v.lateReason}</span>}
                {v.nextAction && (
                  <span className="flex items-center gap-2 text-[13px] text-text-2">
                    <Icon name={v.nextActionDoneAt ? "circle-check" : "arrow-right"} size={14} className={v.nextActionDoneAt ? "text-green" : undefined} />
                    Next: {v.nextAction}
                    {v.nextActionDate ? ` · ${fmtCalendar(v.nextActionDate)}` : ""}
                    {v.nextActionDoneAt ? " · done" : ""}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        {visits.length === 0 && <div className="pt-4 pb-5 text-sm text-text-2">No visits logged yet.</div>}
      </div>
    </section>
  );

  const dealsSection = (
    <section className="overflow-hidden rounded-[18px] border border-line bg-surface shadow-[var(--shadow-sm)]">
      <div className="flex items-center gap-2.5 px-5 pt-4 pb-3">
        <h2 className="m-0 font-display text-[17px] font-semibold">Deals</h2>
        <span className="text-[13px] text-text-3">{deals.length}</span>
      </div>
      {deals.map((d) => (
        <Link
          key={d.id}
          href={`/deals/${d.id}`}
          className="flex flex-col gap-2 border-t border-line px-5 py-3 text-ink hover:bg-surface-2 hover:text-ink hover:no-underline"
        >
          <span className="flex items-baseline gap-3">
            <span className="min-w-0 flex-1 text-sm font-semibold">{d.title}</span>
            <span title={moneyFull(d.valuePkr)} className="text-sm font-semibold whitespace-nowrap tabular-nums">
              {money(d.valuePkr)}
            </span>
          </span>
          <span className="flex flex-wrap items-center gap-2">
            <StagePill stage={d.stage} />
            <span className="text-[12.5px] text-text-2">
              {[d.solutionType, `${d.probability}%`, d.expectedClose ? `close ${fmtCalendar(d.expectedClose)}` : null].filter(Boolean).join(" · ")}
            </span>
          </span>
        </Link>
      ))}
      {deals.length === 0 && <div className="border-t border-line px-5 pt-4 pb-5 text-sm text-text-2">No deals with this company yet.</div>}
    </section>
  );

  return (
    <div className="flex flex-col gap-5">
      <PhoneTitle title={c.name} back={ro ? "/cockpit" : "/accounts"} />
      <span className="hidden items-center gap-1.5 text-[13px] text-text-3 md:flex">
        <Link href={ro ? "/cockpit" : "/accounts"} className="text-text-2">
          {ro ? "Cockpit" : "Accounts"}
        </Link>
        <Icon name="chevron-right" size={13} />
        <span className="truncate">{c.name}</span>
      </span>

      <section className="flex flex-col gap-5 rounded-[18px] border border-line bg-surface px-4 py-[18px] shadow-[var(--shadow-sm)] md:p-6">
        <div className="flex flex-wrap items-start gap-[18px]">
          <span className="flex size-12 flex-none items-center justify-center rounded-2xl bg-brand-soft text-green md:size-14">
            <Icon name="factory" size={24} />
          </span>
          <div className="flex min-w-[240px] flex-1 flex-col gap-1.5">
            <h1 className="m-0 font-display text-[23px] leading-[1.15] font-semibold tracking-[-0.02em] md:text-[28px]">{c.name}</h1>
            {row.bp && <span className="text-sm text-text-2">{row.bp}</span>}
            {geo && <span className="text-[13.5px] text-text-3">{geo}</span>}
            <div className="mt-1 flex flex-wrap gap-2">
              {row.priority && <PriorityBadge priority={row.priority} />}
              <StatusPill status={row.status} />
              {dorm.dormant && (
                <span className="inline-flex h-6 items-center gap-[5px] rounded-full bg-amber-bg pr-[9px] pl-2 text-[12.5px] font-semibold text-amber">
                  <Icon name="moon" size={13} />
                  {row.lastVisit ? `No visit in ${dorm.days} d` : `No visit in ${dorm.days} d since claimed`}
                </span>
              )}
              {ro && (
                <span className="inline-flex h-6 items-center gap-[5px] rounded-full border border-line-strong px-2.5 text-[12.5px] font-semibold text-text-2">
                  <Icon name="eye" size={13} />
                  Read-only
                </span>
              )}
            </div>
          </div>
          {!ro && <AccountActions companyId={c.id} companyName={c.name} canClaim={c.ownerId !== user.id} ownerName={row.owner} />}
        </div>
        <div className="grid grid-cols-2 gap-x-7 gap-y-4 border-t border-line pt-[18px] md:grid-cols-[repeat(7,minmax(0,auto))]">
          {facts.map((f) => (
            <div key={f.k} className="flex min-w-0 flex-col gap-[3px]">
              <span className="text-[11.5px] font-bold tracking-[0.05em] text-text-3 uppercase">{f.k}</span>
              <span title={f.title} className={cn("truncate text-sm font-medium", f.cls ?? "text-ink")}>
                {f.v}
              </span>
            </div>
          ))}
        </div>
        {c.notes && (
          <details className="group -mt-1 border-t border-line pt-3.5">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[13px] font-semibold text-link">
              <Icon name="chevron-right" size={14} className="transition-transform group-open:rotate-90" />
              Notes
            </summary>
            <p className="m-0 mt-2.5 text-sm leading-relaxed whitespace-pre-line text-text-2">{c.notes}</p>
          </details>
        )}
      </section>

      <AccountSections
        timeline={timeline}
        contacts={
          <ContactsPanel
            companyId={c.id}
            companyName={c.name}
            canEdit={!ro}
            contacts={contacts.map((k) => ({ id: k.id, name: k.name, title: k.title, phone: k.phone, email: k.email, linkedin: k.linkedin, isPrimary: k.isPrimary, verified: k.verified }))}
          />
        }
        deals={dealsSection}
        counts={{ contacts: contacts.length, deals: deals.length, visits: visits.length }}
      />
    </div>
  );
}

function AccountSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="hidden h-4 w-64 md:block" />
      <div className="flex flex-col gap-5 rounded-[18px] border border-line bg-surface p-6">
        <div className="flex gap-4">
          <Skeleton className="size-14 rounded-2xl" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-8 w-80 max-w-full" />
            <Skeleton className="h-4 w-60" />
            <Skeleton className="h-4 w-44" />
          </div>
        </div>
        <Skeleton className="h-10" />
      </div>
      <div className="flex flex-col gap-6 md:flex-row">
        <Skeleton className="h-96 rounded-[18px] md:flex-1" />
        <div className="flex flex-col gap-6 md:w-[420px]">
          <Skeleton className="h-64 rounded-[18px]" />
          <Skeleton className="h-40 rounded-[18px]" />
        </div>
      </div>
    </div>
  );
}
