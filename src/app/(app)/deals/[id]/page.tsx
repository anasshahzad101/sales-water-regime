import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PhoneTitle } from "@/components/shell/page-title";
import { Skeleton } from "@/components/ui/kit";
import { requireUser } from "@/lib/auth/dal";
import { requestNow } from "@/lib/queries/common";
import { getDealView } from "@/lib/queries/deals";
import { DealView } from "./deal-view";

export const metadata: Metadata = { title: "Deal" };

export default function DealPage({ params }: PageProps<"/deals/[id]">) {
  return (
    <Suspense fallback={<DealSkeleton />}>
      <Deal params={params} />
    </Suspense>
  );
}

async function Deal({ params }: { params: PageProps<"/deals/[id]">["params"] }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const { now } = await requestNow();
  const deal = await getDealView(user, Number(id), now);
  if (!deal) notFound();
  return (
    <>
      <PhoneTitle title={deal.title} back={user.isCeo ? "/cockpit" : "/pulse"} />
      <DealView deal={deal} />
    </>
  );
}

function DealSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-4 w-72 max-md:hidden" />
      <Skeleton className="h-[320px] rounded-[18px]" />
      <div className="grid gap-6 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <Skeleton className="h-48 rounded-[18px]" />
          <Skeleton className="h-40 rounded-[18px]" />
        </div>
        <div className="flex flex-col gap-6">
          <Skeleton className="h-32 rounded-[18px]" />
          <Skeleton className="h-56 rounded-[18px]" />
        </div>
      </div>
    </div>
  );
}
