"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Drawer } from "@/components/ui/overlay";
import { OutcomePill } from "@/components/ui/pills";
import { visitTypeIcon } from "@/lib/constants";
import { fmtCalendar, fmtDateTime } from "@/lib/time";
import type { VisitRow } from "@/lib/queries/visits";

/** Read-only details of one visit (opened from a row or from My Week's "Open visit"). */
export function VisitDrawer({ visit, closeHref }: { visit: VisitRow; closeHref: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(true);
  const close = () => {
    setOpen(false);
    router.push(closeHref, { scroll: false });
  };
  const row = (label: string, value: React.ReactNode) =>
    value ? (
      <div className="flex flex-col gap-1 border-t border-line py-3 first:border-t-0 first:pt-0">
        <span className="text-xs font-semibold tracking-[0.04em] text-text-3 uppercase">{label}</span>
        <div className="text-sm leading-normal text-ink">{value}</div>
      </div>
    ) : null;

  return (
    <Drawer
      open={open}
      onClose={close}
      title={visit.company}
      description={`${visit.type} · ${fmtDateTime(visit.visitAt)}`}
      footer={
        <>
          <Link
            href={`/accounts/${visit.companyId}`}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-line-strong bg-surface px-5 text-sm font-semibold text-ink hover:bg-surface-2 hover:text-ink hover:no-underline"
          >
            <Icon name="building-2" size={16} />
            Open account
          </Link>
          {visit.outcome === "pending" && (
            <Link href="/my-week" className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-on-primary hover:bg-primary-hover hover:text-on-primary hover:no-underline">
              <Icon name="calendar-check" size={16} />
              Set outcome in My Week
            </Link>
          )}
        </>
      }
    >
      <div className="flex flex-col">
        {row(
          "Visit",
          <span className="flex items-center gap-2">
            <Icon name={visitTypeIcon(visit.type)} size={16} className="text-text-2" />
            {visit.type} by {visit.person}
          </span>,
        )}
        {row("Company", <span>{visit.sub || visit.company}</span>)}
        {row("Contact met", visit.contact)}
        {row(
          "Outcome",
          <span className="flex flex-col items-start gap-1.5">
            <OutcomePill outcome={visit.outcome} />
            {visit.skipReason && <span className="text-[13px] text-text-2">Skip reason: {visit.skipReason}</span>}
            {visit.lateReason && <span className="text-[13px] text-text-2">Late reason: {visit.lateReason}</span>}
          </span>,
        )}
        {row("Discussion", visit.discussion && <p className="m-0 whitespace-pre-wrap">{visit.discussion}</p>)}
        {row(
          "Next action",
          visit.next && (
            <span className={visit.nextDone ? "text-text-3 line-through" : undefined}>
              {visit.next}
              {visit.nextDate ? ` · ${fmtCalendar(visit.nextDate)}` : ""}
              {visit.nextDone ? " (done)" : ""}
            </span>
          ),
        )}
        {row(
          "Deal",
          visit.dealId && (
            <Link href={`/deals/${visit.dealId}`} className="font-semibold">
              Open the linked deal
            </Link>
          ),
        )}
      </div>
    </Drawer>
  );
}
