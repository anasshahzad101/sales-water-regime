import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ExportButton } from "@/components/ui/export-button";
import type { Chip } from "@/components/ui/filters";
import { Forbidden } from "@/components/ui/forbidden";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/kit";
import { Pagination } from "@/components/ui/pagination";
import { PriorityBadge, StatusPill } from "@/components/ui/pills";
import { requireUser } from "@/lib/auth/dal";
import { cn } from "@/lib/cn";
import { requestNow } from "@/lib/queries/common";
import { ACCOUNTS_PAGE_SIZE, listAccounts, parseAccountFilters, type AccountRow } from "@/lib/queries/accounts";
import { fmtDate } from "@/lib/time";
import { AccountsFilters } from "./accounts-filters";

export const metadata: Metadata = { title: "Accounts" };

type SP = Promise<Record<string, string | string[] | undefined>>;

export default function AccountsPage({ searchParams }: { searchParams: SP }) {
  return (
    <Suspense fallback={<AccountsSkeleton />}>
      <Accounts searchParams={searchParams} />
    </Suspense>
  );
}

const GRID = "md:grid md:grid-cols-[minmax(0,2fr)_minmax(0,1.2fr)_110px_70px_150px_112px_120px] md:gap-3.5";

async function Accounts({ searchParams }: { searchParams: SP }) {
  const user = await requireUser();
  if (user.isCeo) return <Forbidden user={user} />;
  const { now } = await requestNow();
  const sp = await searchParams;
  const f = parseAccountFilters(sp, user);
  const { rows, stats, options, labels } = await listAccounts(user, f, now);

  const params: Record<string, string> = {};
  for (const [k, v] of Object.entries(sp)) if (typeof v === "string" && v) params[k] = v;
  const exportQs = new URLSearchParams(Object.entries(params).filter(([k]) => k !== "page" && k !== "more"));
  exportQs.set("scope", f.scope);

  const chips: Chip[] = [];
  if (f.sector && labels.sector) chips.push({ param: "sector", label: labels.sector });
  if (f.city && labels.city) chips.push({ param: "city", label: labels.city });
  if (f.pri) chips.push({ param: "pri", label: f.pri });
  if (f.owner && labels.owner) chips.push({ param: "owner", label: labels.owner });
  if (f.unassigned) chips.push({ param: "unassigned", label: "Unassigned" });
  if (f.dormant) chips.push({ param: "dormant", label: "Dormant" });
  if (f.q) chips.push({ param: "q", label: `“${f.q}”` });

  const pageRows = f.more > 1 ? rows.slice(0, ACCOUNTS_PAGE_SIZE * f.more) : rows.slice((f.page - 1) * ACCOUNTS_PAGE_SIZE, f.page * ACCOUNTS_PAGE_SIZE);
  const moreHref = (() => {
    const q = new URLSearchParams(Object.entries(params).filter(([k]) => k !== "page"));
    q.set("more", String(Math.max(2, f.more + 1)));
    return `/accounts?${q.toString()}`;
  })();
  const shownTo = f.more > 1 ? pageRows.length : Math.min(rows.length, f.page * ACCOUNTS_PAGE_SIZE);
  const clearHref = f.scope === "mine" && user.role === "sales" ? "/accounts" : `/accounts?scope=${f.scope}`;

  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-wrap items-end gap-3">
        <div className="hidden min-w-[260px] flex-1 flex-col gap-1.5 md:flex">
          <h1 className="m-0 font-display text-[28px] font-semibold tracking-[-0.02em]">Accounts</h1>
          <p className="m-0 text-[14.5px] text-text-2">
            {stats.total} industrial companies across {stats.cities} cities · {stats.unassigned} unassigned
          </p>
        </div>
        <Link href="/accounts/new" className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-[18px] text-sm font-semibold text-on-primary hover:bg-primary-hover hover:text-on-primary hover:no-underline h-[46px] max-md:flex-1 md:h-10">
          <Icon name="plus" size={16} />
          Add company
        </Link>
        <ExportButton href={`/export/accounts?${exportQs.toString()}`} className="max-md:flex-1" />
      </div>

      <AccountsFilters
        values={{ q: f.q, scope: f.scope, sector: f.sector, city: f.city, pri: f.pri, owner: f.owner, unassigned: f.unassigned, dormant: f.dormant }}
        options={options}
        chips={chips}
        count={rows.length}
      />

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-[18px] border border-line bg-surface px-6 py-12 text-center">
          <span className="flex size-14 items-center justify-center rounded-[18px] bg-bg-alt text-text-2">
            <Icon name="search-x" size={26} />
          </span>
          <span className="font-display text-lg font-semibold">No companies match</span>
          <span className="max-w-[400px] text-sm leading-normal text-text-2">
            Try another spelling, a brand or plant name, or clear the filters. If the company isn&apos;t in the system yet, add it.
          </span>
          <div className="mt-1.5 flex flex-wrap justify-center gap-2.5">
            <Link href={clearHref} className="inline-flex items-center justify-center gap-2 rounded-full border border-line-strong bg-surface px-[18px] text-sm font-semibold text-ink hover:bg-surface-2 hover:text-ink hover:no-underline h-11">
              Clear filters
            </Link>
            <Link href="/accounts/new" className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-[18px] text-sm font-semibold text-on-primary hover:bg-primary-hover hover:text-on-primary hover:no-underline h-11">
              Add company
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* desktop table */}
          <div className="hidden overflow-hidden rounded-[18px] border border-line bg-surface shadow-[var(--shadow-sm)] md:block">
            <div className={cn(GRID, "bg-surface-2 px-5 py-2.5 text-[11.5px] font-semibold tracking-[0.05em] text-text-3 uppercase")}>
              <Link
                href={`/accounts?${new URLSearchParams({ ...Object.fromEntries(Object.entries(params).filter(([k]) => k !== "page")), sort: f.sort === "asc" ? "desc" : "asc" }).toString()}`}
                className="flex items-center gap-1 text-ink hover:text-ink hover:no-underline"
                aria-label={`Sort by company ${f.sort === "asc" ? "Z to A" : "A to Z"}`}
              >
                Company
                <Icon name="arrow-down-a-z" size={13} style={f.sort === "desc" ? { transform: "scaleY(-1)" } : undefined} />
              </Link>
              <span>Sector</span>
              <span>City</span>
              <span>Priority</span>
              <span>Owner</span>
              <span>Status</span>
              <span>Last visit</span>
            </div>
            {pageRows.map((r) => (
              <TableRow key={r.id} r={r} />
            ))}
            <div className="border-t border-line">
              <Pagination total={rows.length} page={f.more > 1 ? 1 : f.page} pageSize={ACCOUNTS_PAGE_SIZE} params={params} basePath="/accounts" />
            </div>
          </div>

          {/* phone cards */}
          <div className="flex flex-col gap-2.5 md:hidden">
            {pageRows.map((r) => (
              <Card key={r.id} r={r} />
            ))}
            {shownTo < rows.length ? (
              <Link
                href={moreHref}
                scroll={false}
                className="flex h-12 items-center justify-center rounded-full border border-line-strong bg-surface text-[15px] font-semibold text-ink hover:text-ink hover:no-underline"
              >
                Load 25 more · Showing 1–{shownTo} of {rows.length}
              </Link>
            ) : (
              <span className="py-2 text-center text-[13px] text-text-3">
                {rows.length} {rows.length === 1 ? "company" : "companies"}
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function agoShort(r: AccountRow) {
  if (r.days == null) return "Never visited";
  if (r.status === "dormant") return `${r.days} d · dormant`;
  return r.days === 0 ? "Today" : `${r.days} d ago`;
}
function agoLong(r: AccountRow) {
  if (r.days == null) return r.status === "dormant" ? "Never visited · dormant" : "Never visited";
  if (r.status === "dormant") return `No visit in ${r.days} d`;
  return `Visited ${r.days === 0 ? "today" : `${r.days} d ago`}`;
}

function OwnerCell({ r }: { r: AccountRow }) {
  return (
    <span className="flex min-w-0 items-center gap-2">
      <span
        className={cn(
          "flex size-[26px] flex-none items-center justify-center rounded-full text-[10.5px] font-bold text-green",
          r.ownerId ? "bg-brand-soft" : "border border-dashed border-line-strong",
        )}
      >
        {r.ownerInitials}
      </span>
      <span className={cn("truncate text-[13.5px]", r.ownerId ? "text-ink" : "text-text-3")}>{r.owner ? (r.isMine ? `${r.owner} (you)` : r.owner) : "Unassigned"}</span>
    </span>
  );
}

function TableRow({ r }: { r: AccountRow }) {
  const dormant = r.status === "dormant";
  return (
    <Link href={`/accounts/${r.id}`} className={cn(GRID, "items-center border-t border-line px-5 py-[11px] text-ink hover:bg-surface-2 hover:text-ink hover:no-underline")}>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-sm font-semibold">{r.name}</span>
        {r.bp && <span className="truncate text-[12.5px] text-text-2">{r.bp}</span>}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="truncate text-[13.5px]">{r.sector ?? "—"}</span>
        {r.sub && <span className="truncate text-[12.5px] text-text-3">{r.sub}</span>}
      </span>
      <span className="truncate text-[13.5px]">{r.city ?? "—"}</span>
      <span>
        <PriorityBadge priority={r.priority} />
      </span>
      <OwnerCell r={r} />
      <span>
        <StatusPill status={r.status} />
      </span>
      <span className="flex flex-col gap-0.5 tabular-nums">
        <span className="text-[13.5px]">{r.lastVisit ? fmtDate(r.lastVisit) : "—"}</span>
        <span className={cn("text-[12.5px]", dormant ? "font-semibold text-amber" : "text-text-3")}>{agoShort(r)}</span>
      </span>
    </Link>
  );
}

function Card({ r }: { r: AccountRow }) {
  const dormant = r.status === "dormant";
  const sub = [r.bp, r.city].filter(Boolean).join(" · ");
  return (
    <Link href={`/accounts/${r.id}`} className="flex flex-col gap-2.5 rounded-[18px] border border-line bg-surface px-4 py-3.5 text-ink hover:text-ink hover:no-underline">
      <span className="flex items-start gap-2.5">
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[15.5px] font-semibold">{r.name}</span>
          {sub && <span className="text-[13px] text-text-2">{sub}</span>}
        </span>
        <PriorityBadge priority={r.priority} />
      </span>
      <span className="flex flex-wrap items-center gap-2">
        <StatusPill status={r.status} />
        <span className={cn("text-[13px]", r.ownerId ? "text-ink" : "text-text-3")}>{r.owner ? (r.isMine ? `${r.owner} (you)` : r.owner) : "Unassigned"}</span>
        <span className={cn("ml-auto text-[12.5px]", dormant ? "font-semibold text-amber" : "text-text-3")}>{agoLong(r)}</span>
      </span>
    </Link>
  );
}

function AccountsSkeleton() {
  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex items-end gap-3">
        <div className="hidden flex-1 flex-col gap-2 md:flex">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-10 w-36 rounded-full" />
        <Skeleton className="h-10 w-40 rounded-full" />
      </div>
      <div className="flex gap-2.5">
        <Skeleton className="h-10 w-[260px] rounded-xl" />
        <Skeleton className="h-10 w-56 rounded-full" />
      </div>
      <div className="overflow-hidden rounded-[18px] border border-line bg-surface">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className={cn("flex items-center gap-4 px-5 py-4", i > 0 && "border-t border-line")}>
            <Skeleton className="size-[38px] rounded-xl" />
            <span className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3 w-2/5" />
              <Skeleton className="h-2.5 w-1/4" />
            </span>
            <Skeleton className="h-[22px] w-[70px] rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
