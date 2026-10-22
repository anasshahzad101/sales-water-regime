import type { Metadata } from "next";
import { Suspense } from "react";
import { Forbidden } from "@/components/ui/forbidden";
import { Skeleton } from "@/components/ui/kit";
import { requireUser } from "@/lib/auth/dal";
import { requestNow } from "@/lib/queries/common";
import { getPulse, pulseFilters } from "@/lib/queries/deals";
import { PulseBoard } from "./pulse-board";

export const metadata: Metadata = { title: "Team Pulse" };

export default function PulsePage({ searchParams }: PageProps<"/pulse">) {
  return (
    <Suspense fallback={<PulseSkeleton />}>
      <Pulse searchParams={searchParams} />
    </Suspense>
  );
}

async function Pulse({ searchParams }: { searchParams: PageProps<"/pulse">["searchParams"] }) {
  const user = await requireUser();
  if (user.isCeo) return <Forbidden user={user} />;
  const { now } = await requestNow();
  const sp = await searchParams;
  const filters = pulseFilters(user, sp);
  const { columns, people, today } = await getPulse(user, filters, now);
  const q = new URLSearchParams();
  q.set("scope", filters.scope);
  if (filters.owner) q.set("owner", String(filters.owner));
  if (filters.sols.length) q.set("sol", filters.sols.join(","));
  return <PulseBoard columns={columns} people={people} filters={filters} today={today} canCreate={user.canEdit} exportHref={`/export/pipeline?${q.toString()}`} />;
}

function PulseSkeleton() {
  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-col gap-2 max-md:hidden">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-10 w-full max-w-[720px] rounded-full" />
      <div className="grid auto-cols-[minmax(236px,1fr)] grid-flow-col gap-3.5 overflow-hidden max-md:hidden">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-[420px] rounded-[18px]" />
        ))}
      </div>
      <div className="flex flex-col gap-2.5 md:hidden">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-28 rounded-[18px]" />
        ))}
      </div>
    </div>
  );
}
