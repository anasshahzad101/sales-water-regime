import type { Metadata } from "next";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/kit";
import { Forbidden } from "@/components/ui/forbidden";
import { requireUser } from "@/lib/auth/dal";
import { store } from "@/lib/data/store";
import { companyLine, lookups, requestNow } from "@/lib/queries/common";
import { toPktLocalInput } from "@/lib/time";
import { getCompanyVisitContext } from "@/app/actions/visits";
import { LogForm } from "./log-form";

export const metadata: Metadata = { title: "Log a visit" };

export default function LogVisitPage({ searchParams }: PageProps<"/log">) {
  return (
    <Suspense fallback={<LogSkeleton />}>
      <LogVisit searchParams={searchParams} />
    </Suspense>
  );
}

async function LogVisit({ searchParams }: { searchParams: PageProps<"/log">["searchParams"] }) {
  const user = await requireUser();
  if (!user.canEdit) return <Forbidden user={user} />;
  const { now } = await requestNow();
  const sp = await searchParams;
  const [L, companies] = await Promise.all([lookups(), store().list("companies", { where: { status: { ne: "archived" } }, orderBy: [["name", "asc"]] })]);
  const options = companies.map((c) => ({
    id: c.id,
    name: c.name,
    sub: companyLine(c, L),
    priority: c.priority,
    owner: c.ownerId ? (L.userById.get(c.ownerId)?.name.split(" ")[0] ?? "") : "",
  }));
  const fromId = Number(sp.company) || null;
  const from = fromId ? options.find((o) => o.id === fromId) : undefined;
  const dealId = Number(sp.deal) || null;
  const initialContext = from ? { companyId: from.id, ...(await getCompanyVisitContext(from.id)) } : null;
  return (
    <LogForm
      companies={options}
      initialCompanyId={from?.id ?? null}
      initialDealId={dealId}
      initialContext={initialContext}
      fromAccount={from ? { id: from.id, name: from.name } : null}
      nowValue={toPktLocalInput(now)}
    />
  );
}

function LogSkeleton() {
  return (
    <div className="flex max-w-[880px] flex-col gap-5">
      <div className="flex flex-col gap-2 max-md:hidden">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Skeleton className="h-[640px] rounded-[18px]" />
    </div>
  );
}
