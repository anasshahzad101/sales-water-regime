"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

type Tab = "contacts" | "deals" | "visits";

/**
 * Desktop: visit timeline on the left, contacts and deals on the right.
 * Phone: one section at a time behind Contacts / Deals / Visits tabs.
 */
export function AccountSections({
  timeline,
  contacts,
  deals,
  counts,
}: {
  timeline: ReactNode;
  contacts: ReactNode;
  deals: ReactNode;
  counts: Record<Tab, number>;
}) {
  const [tab, setTab] = useState<Tab>("contacts");
  const show = (k: Tab) => (tab === k ? "block" : "hidden md:block");
  return (
    <>
      <div role="tablist" className="flex rounded-full border border-line bg-bg-alt p-[3px] md:hidden">
        {(
          [
            ["contacts", "Contacts"],
            ["deals", "Deals"],
            ["visits", "Visits"],
          ] as [Tab, string][]
        ).map(([k, label]) => (
          <button
            key={k}
            role="tab"
            type="button"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            className={cn("h-10 flex-1 rounded-full border-0 text-sm font-semibold", tab === k ? "bg-surface text-ink shadow-[var(--shadow-sm)]" : "bg-transparent text-text-2")}
          >
            {label} <span className="font-medium text-text-3">{counts[k]}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:gap-6">
        <div className={cn("min-w-0 md:flex-1", show("visits"))}>{timeline}</div>
        <div className="contents md:flex md:w-[420px] md:flex-none md:flex-col md:gap-6">
          <div className={show("contacts")}>{contacts}</div>
          <div className={show("deals")}>{deals}</div>
        </div>
      </div>
    </>
  );
}
