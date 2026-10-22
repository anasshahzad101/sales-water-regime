import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ExportButton } from "@/components/ui/export-button";
import { ActiveFilters, PhoneFilters, SearchFilter, SelectFilter, type Chip } from "@/components/ui/filters";
import { Forbidden } from "@/components/ui/forbidden";
import { Icon } from "@/components/ui/icon";
import { LinkButton, Skeleton } from "@/components/ui/kit";
import { OutcomePill } from "@/components/ui/pills";
import { Pagination } from "@/components/ui/pagination";
import { requireUser } from "@/lib/auth/dal";
import { OUTCOMES, VISIT_TYPES, outcomeOf, visitTypeIcon } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { requestNow } from "@/lib/queries/common";
import { DEFAULT_RANGE, PAGE_SIZE, RANGES, getVisits, parseVisitFilters } from "@/lib/queries/visits";
import { fmtCalendar, fmtDate, fmtTime } from "@/lib/time";
import { store } from "@/lib/data/store";
import { lookups } from "@/lib/queries/common";
import { toVisitRows } from "@/lib/queries/visits";
import { VisitDrawer } from "./visit-drawer";

export const metadata: Metadata = { title: "Visits" };

export default function VisitsPage({ searchParams }: PageProps<"/visits">) {
  return (
    <Suspense fallback={<VisitsSkeleton />}>
      <Visits searchParams={searchParams} />
    </Suspense>
  );
}

async function Visits({ searchParams }: { searchParams: PageProps<"/visits">["searchParams"] }) {
  const user = await requireUser();
  if (user.isCeo) return <Forbidden user={user} />;
  const { now } = await requestNow();
  const sp = await searchParams;
  const f = parseVisitFilters(sp);
  const team = user.isManager;
  const { rows, total, people } = await getVisits(user, f, now);

  // "Open visit" from My Week: show that visit in a panel.
  const openId = Number(typeof sp.visit === "string" ? sp.visit : "") || null;
  let open = null;
  if (openId) {
    const v = await store().get("visits", openId);
    if (v && (team || v.salespersonId === user.id)) open = (await toVisitRows([v], await lookups()))[0];
  }

  const params: Record<string, string> = {};
  for (const k of ["q", "range", "outcome", "type", "person", "sort"]) if (typeof sp[k] === "string" && sp[k]) params[k] = sp[k] as string;
  const qs = new URLSearchParams(params).toString();

  const chips: Chip[] = [];
  if (f.range !== DEFAULT_RANGE) chips.push({ param: "range", label: RANGES.find((r) => r.value === f.range)!.label });
  if (f.outcome) chips.push({ param: "outcome", label: `Outcome: ${outcomeOf(f.outcome).short}` });
  if (f.type) chips.push({ param: "type", label: `Type: ${f.type}` });
  if (f.person) chips.push({ param: "person", label: people.find((p) => String(p.id) === f.person)?.name ?? "Salesperson" });
  if (f.q) chips.push({ param: "q", label: `“${f.q}”` });
  const filtered = chips.length > 0;

  const selects = (
    <>
      <SelectFilter param="range" value={f.range} defaultValue={DEFAULT_RANGE} label="Date range" options={RANGES.map((r) => ({ value: r.value, label: r.label }))} />
      <SelectFilter param="outcome" value={f.outcome} allLabel="All outcomes" label="Outcome" options={OUTCOMES.map((o) => ({ value: o.key, label: o.label }))} />
      <SelectFilter param="type" value={f.type} allLabel="All types" label="Visit type" options={VISIT_TYPES.map((t) => ({ value: t.key, label: t.key }))} />
      {team && <SelectFilter param="person" value={f.person} allLabel="Everyone" label="Salesperson" options={people.map((p) => ({ value: String(p.id), label: p.name }))} />}
    </>
  );
  const cols = team ? "md:grid-cols-[128px_minmax(0,1.3fr)_150px_120px_130px_minmax(0,1.3fr)]" : "md:grid-cols-[128px_minmax(0,1.4fr)_160px_130px_minmax(0,1.4fr)]";
  const sortHref = `/visits?${new URLSearchParams({ ...params, sort: f.sort === "desc" ? "asc" : "desc" }).toString()}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
          <h1 className="m-0 font-display text-[28px] font-semibold tracking-[-0.02em] max-md:hidden">Visits</h1>
          <p className="m-0 text-sm text-text-2 md:text-[14.5px]">{team ? "Every visit logged by the team, newest first." : "Every visit you have logged, newest first."}</p>
        </div>
        <ExportButton href={`/export/visits${qs ? `?${qs}` : ""}`} />
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <SearchFilter value={f.q} placeholder="Search company" className="max-md:flex-1 md:w-[300px]" />
        <div className="hidden flex-wrap items-center gap-2.5 md:flex">{selects}</div>
        <PhoneFilters count={chips.filter((c) => c.param !== "q").length} resultLabel={`Show ${total} visit${total === 1 ? "" : "s"}`}>
          {selects}
        </PhoneFilters>
      </div>
      {filtered && (
        <div className="-mt-1.5">
          <ActiveFilters chips={chips} />
        </div>
      )}

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[18px] border border-line bg-surface px-6 py-12 text-center">
          <span className="flex size-14 items-center justify-center rounded-[18px] bg-bg-alt text-text-2">
            <Icon name={filtered ? "search-x" : "history"} size={26} />
          </span>
          <span className="font-display text-lg font-semibold">{filtered ? "No visits match these filters" : "No visits yet"}</span>
          <span className="max-w-[380px] text-sm leading-normal text-text-2">
            {filtered ? "Try a wider date range or clear a filter." : "Visits you log show up here, with their outcome and next action."}
          </span>
          {filtered ? (
            <LinkButton href="/visits" className="mt-1.5" size="md">
              Clear all filters
            </LinkButton>
          ) : (
            <LinkButton href="/log" className="mt-1.5" size="md">
              Log a visit
            </LinkButton>
          )}
        </div>
      ) : (
        <>
          {/* desktop table */}
          <div className="hidden overflow-hidden rounded-[18px] border border-line bg-surface shadow-[var(--shadow-sm)] md:block">
            <div className={cn("grid gap-4 bg-surface-2 px-5 py-2.5 text-[11.5px] font-semibold tracking-[0.05em] text-text-3 uppercase", cols)}>
              <Link href={sortHref} className="flex items-center gap-1 text-ink hover:text-ink hover:no-underline" aria-label={`Sort by date, ${f.sort === "desc" ? "oldest" : "newest"} first`}>
                Date &amp; time
                <Icon name={f.sort === "desc" ? "arrow-down" : "arrow-up"} size={13} />
              </Link>
              <span>Company</span>
              <span>Type</span>
              {team && <span>Salesperson</span>}
              <span>Outcome</span>
              <span>Next action</span>
            </div>
            {rows.map((r) => (
              <Link
                key={r.id}
                href={`/visits?${new URLSearchParams({ ...params, visit: String(r.id) }).toString()}`}
                scroll={false}
                className={cn("grid items-center gap-4 border-t border-line px-5 py-3 text-ink hover:bg-surface-2 hover:text-ink hover:no-underline", cols, open?.id === r.id && "bg-surface-2")}
              >
                <span className="flex flex-col gap-0.5 tabular-nums">
                  <span className="text-sm font-medium">{fmtDate(r.visitAt)}</span>
                  <span className="text-[12.5px] text-text-3">{fmtTime(r.visitAt)} PKT</span>
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate text-sm font-semibold">{r.company}</span>
                  <span className="truncate text-[12.5px] text-text-2">{r.sub}</span>
                </span>
                <span className="flex items-center gap-[7px] text-[13.5px] text-text-2">
                  <Icon name={visitTypeIcon(r.type)} size={15} />
                  {r.type}
                </span>
                {team && <span className="truncate text-[13.5px]">{r.person}</span>}
                <span>
                  <OutcomePill outcome={r.outcome} short />
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className={cn("truncate text-[13.5px]", r.nextDone && "text-text-3 line-through")}>{r.next ?? "—"}</span>
                  {r.nextDate && <span className="text-[12.5px] text-text-3">{fmtCalendar(r.nextDate)}</span>}
                </span>
              </Link>
            ))}
            <div className="border-t border-line">
              <Pagination total={total} page={f.page} pageSize={PAGE_SIZE} params={params} basePath="/visits" />
            </div>
          </div>

          {/* phone cards */}
          <div className="flex flex-col gap-2.5 md:hidden">
            {rows.map((r) => (
              <Link
                key={r.id}
                href={`/visits?${new URLSearchParams({ ...params, visit: String(r.id) }).toString()}`}
                scroll={false}
                className="flex flex-col gap-2 rounded-[18px] border border-line bg-surface px-4 py-3.5 text-ink hover:text-ink hover:no-underline"
              >
                <span className="flex items-start gap-2.5">
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="text-[15px] font-semibold">{r.company}</span>
                    <span className="text-[13px] text-text-2">
                      {fmtDate(r.visitAt)} · {fmtTime(r.visitAt)} PKT
                    </span>
                  </span>
                  <OutcomePill outcome={r.outcome} short />
                </span>
                <span className="flex items-center gap-[7px] text-[13.5px] text-text-2">
                  <Icon name={visitTypeIcon(r.type)} size={15} />
                  {r.type}
                  {team && ` · ${r.person}`}
                </span>
                {r.next && (
                  <span className="flex items-center gap-[7px] border-t border-line pt-2 text-[13.5px]">
                    <Icon name="arrow-right" size={14} className="text-text-3" />
                    <span className={cn("flex-1", r.nextDone && "text-text-3 line-through")}>{r.next}</span>
                    {r.nextDate && <span className="text-[12.5px] text-text-3">{fmtCalendar(r.nextDate)}</span>}
                  </span>
                )}
              </Link>
            ))}
            <div className="rounded-[18px] border border-line bg-surface">
              <Pagination total={total} page={f.page} pageSize={PAGE_SIZE} params={params} basePath="/visits" />
            </div>
          </div>
        </>
      )}

      {open && <VisitDrawer visit={open} closeHref={`/visits${qs ? `?${qs}` : ""}`} />}
    </div>
  );
}

function VisitsSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-8 w-40 max-md:hidden" />
      <div className="flex gap-2.5">
        <Skeleton className="h-10 w-[300px]" />
        <Skeleton className="h-10 w-32 rounded-full max-md:hidden" />
        <Skeleton className="h-10 w-32 rounded-full max-md:hidden" />
      </div>
      <div className="overflow-hidden rounded-[18px] border border-line bg-surface">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className={cn("flex items-center gap-4 px-5 py-4", i > 0 && "border-t border-line")}>
            <Skeleton className="h-3 w-[110px]" />
            <Skeleton className="h-3 flex-1" />
            <Skeleton className="h-[22px] w-[90px] rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
