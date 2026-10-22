import type { Metadata } from "next";
import { Suspense } from "react";
import { ExportButton } from "@/components/ui/export-button";
import { Forbidden } from "@/components/ui/forbidden";
import { Skeleton } from "@/components/ui/kit";
import { Pagination } from "@/components/ui/pagination";
import { hueClass } from "@/components/ui/pills";
import { requireUser } from "@/lib/auth/dal";
import { cn } from "@/lib/cn";
import { AUDIT_ENTITIES, type Hue } from "@/lib/constants";
import { AUDIT_ACTIONS, AUDIT_PAGE_SIZE, AUDIT_RANGES, getAuditPage, parseAuditFilters, type AuditEntryView } from "@/lib/queries/admin";
import { requestNow } from "@/lib/queries/common";
import { addDays, fmtCalendar, pktDate } from "@/lib/time";
import { Icon } from "@/components/ui/icon";
import { AuditFilterBar } from "./audit-filters";

export const metadata: Metadata = { title: "Audit log" };

const ACTION_STYLE: Record<string, [Hue, string]> = {
  created: ["green", "plus"],
  updated: ["blue", "pencil"],
  "stage changed": ["violet", "arrow-right-left"],
  claimed: ["aqua", "hand"],
  "claim undone": ["slate", "undo-2"],
  restored: ["green", "rotate-ccw"],
  "outcome set": ["green", "circle-check"],
  "outcome undone": ["slate", "undo-2"],
  "stage change undone": ["slate", "undo-2"],
  deleted: ["red", "trash-2"],
  "role changed": ["violet", "shield"],
  "password reset": ["amber", "key-round"],
  "password set": ["slate", "key-round"],
  "password changed": ["slate", "key-round"],
  deactivated: ["red", "user-x"],
  activated: ["green", "user-check"],
  "status changed": ["blue", "refresh-cw"],
  "sign-in locked": ["red", "lock"],
  "next action done": ["green", "check"],
  "next action reopened": ["slate", "rotate-ccw"],
};
const ENTITY: Record<string, [string, string]> = {
  company: ["building-2", "Company"],
  contact: ["user", "Contact"],
  visit: ["map-pin", "Visit"],
  deal: ["briefcase", "Deal"],
  proposal: ["file-text", "Proposal"],
  user: ["users-round", "User"],
};
const cap = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);

export default function AuditPage({ searchParams }: PageProps<"/admin/audit">) {
  return (
    <div className="flex flex-col gap-[18px]">
      <Suspense fallback={<AuditSkeleton />}>
        <Audit searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Audit({ searchParams }: { searchParams: PageProps<"/admin/audit">["searchParams"] }) {
  const user = await requireUser();
  if (!user.isAdmin) return <Forbidden user={user} />;
  const { now } = await requestNow();
  const sp = await searchParams;
  const f = parseAuditFilters(sp);
  const { total, entries, users } = await getAuditPage(f, f.page, now);

  const params = { q: f.q, user: f.user, entity: f.entity, action: f.action, range: f.range };
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]).toString();
  const filtered = !!(f.q || f.user || f.entity || f.action);

  const today = pktDate(now);
  const yesterday = addDays(today, -1);
  const dayLabel = (d: string) => (d === today ? `Today · ${fmtCalendar(d)}` : d === yesterday ? `Yesterday · ${fmtCalendar(d)}` : fmtCalendar(d));
  const groups: { day: string; items: AuditEntryView[] }[] = [];
  for (const e of entries) {
    const g = groups[groups.length - 1];
    if (g && g.day === e.day) g.items.push(e);
    else groups.push({ day: e.day, items: [e] });
  }

  return (
    <>
      <div className="flex flex-wrap items-end gap-3">
        <div className="hidden min-w-[260px] flex-1 flex-col gap-1.5 md:flex">
          <span className="text-[13px] text-text-3">Admin</span>
          <h1 className="m-0 font-display text-[28px] font-semibold tracking-[-0.02em]">Audit log</h1>
          <p className="m-0 text-[14.5px] text-text-2">Every change, with who made it and when. Entries can&apos;t be edited or deleted.</p>
        </div>
        <p className="m-0 flex-[1_1_100%] text-sm text-text-2 md:hidden">Every change, with who made it and when. Entries can&apos;t be edited or deleted.</p>
        <ExportButton href={`/export/audit${qs ? `?${qs}` : ""}`} className="max-md:h-11 max-md:flex-1" />
      </div>

      <AuditFilterBar
        q={f.q}
        user={f.user}
        entity={f.entity}
        action={f.action}
        range={f.range}
        users={users.map((u) => ({ value: String(u.id), label: u.name }))}
        entities={AUDIT_ENTITIES.map((e) => ({ value: e, label: ENTITY[e]?.[1] ?? cap(e) }))}
        actions={[...new Set<string>([...AUDIT_ACTIONS, ...entries.map((e) => e.action), ...(f.action ? [f.action] : [])])].map((a) => ({ value: a, label: cap(a) }))}
        ranges={AUDIT_RANGES.map((r) => ({ value: r.value, label: r.label }))}
      />

      <div className="overflow-hidden rounded-[18px] border border-line bg-surface shadow-[var(--shadow-sm)]">
        {groups.map((g, gi) => (
          <div key={g.day}>
            <div className={cn("bg-surface-2 px-5 py-2.5 text-[11.5px] font-bold tracking-[0.06em] text-text-3 uppercase max-md:px-4", gi > 0 && "border-t border-line")}>
              {dayLabel(g.day)}
            </div>
            {g.items.map((e) => {
              const [hue, icon] = ACTION_STYLE[e.action] ?? ["slate", "circle"];
              const [eIcon, eLabel] = ENTITY[e.entity] ?? ["circle", cap(e.entity)];
              return (
                <div
                  key={e.id}
                  className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5 border-t border-line px-4 py-3 md:grid-cols-[96px_170px_230px_minmax(0,1fr)] md:gap-3.5 md:px-5 md:py-[11px]"
                >
                  <span className="text-[13px] text-text-2 tabular-nums">{e.time}</span>
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="flex size-[26px] flex-none items-center justify-center rounded-full bg-brand-soft text-[10.5px] font-bold text-green">{e.initials}</span>
                    <span className="truncate text-[13.5px] font-semibold whitespace-nowrap">{e.who}</span>
                  </span>
                  <span className="col-span-2 flex flex-wrap items-center gap-1.5 md:col-span-1">
                    <span className={cn("inline-flex h-6 items-center gap-[5px] rounded-full pr-[9px] pl-2 text-xs font-semibold whitespace-nowrap", hueClass(hue))}>
                      <Icon name={icon} size={12} />
                      {cap(e.action)}
                    </span>
                    <span className="inline-flex items-center gap-[5px] text-[12.5px] text-text-2">
                      <Icon name={eIcon} size={13} />
                      {eLabel}
                    </span>
                  </span>
                  <span className="col-span-2 min-w-0 text-[13.5px] leading-[1.45] break-words md:col-span-1">{e.detail}</span>
                </div>
              );
            })}
          </div>
        ))}
        {entries.length === 0 && <div className="px-5 py-10 text-center text-sm text-text-2">No changes match these filters.</div>}
        <div className="border-t border-line">
          {filtered && total > 0 && total <= AUDIT_PAGE_SIZE ? (
            <div className="px-4 py-3 text-[13px] text-text-2 md:px-5">
              {total} matching change{total === 1 ? "" : "s"}
            </div>
          ) : (
            <Pagination total={total} page={f.page} pageSize={AUDIT_PAGE_SIZE} params={params} basePath="/admin/audit" />
          )}
        </div>
      </div>
    </>
  );
}

function AuditSkeleton() {
  return (
    <>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-16 max-md:hidden" />
        <Skeleton className="h-8 w-40 max-md:hidden" />
        <Skeleton className="h-4 w-[420px] max-w-full" />
      </div>
      <div className="flex flex-wrap gap-2.5">
        <Skeleton className="h-10 w-[340px] max-w-full rounded-xl" />
        <Skeleton className="h-10 w-28 rounded-full" />
        <Skeleton className="h-10 w-28 rounded-full" />
        <Skeleton className="h-10 w-28 rounded-full" />
      </div>
      <div className="overflow-hidden rounded-[18px] border border-line bg-surface">
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} className="flex items-center gap-3.5 border-t border-line px-5 py-3.5 first:border-t-0">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="size-[26px] rounded-full" />
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-6 w-24 rounded-full" />
            <Skeleton className="h-3 flex-1" />
          </div>
        ))}
      </div>
    </>
  );
}
