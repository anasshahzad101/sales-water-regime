import type { Metadata } from "next";
import { Suspense } from "react";
import { PhoneTitle } from "@/components/shell/page-title";
import { Forbidden } from "@/components/ui/forbidden";
import { Skeleton } from "@/components/ui/kit";
import { requireUser } from "@/lib/auth/dal";
import { store } from "@/lib/data/store";
import { companyOptions } from "@/lib/queries/deals";
import { NewDealForm } from "./new-deal-form";

export const metadata: Metadata = { title: "New deal" };

export default function NewDealPage({ searchParams }: PageProps<"/deals/new">) {
  return (
    <Suspense fallback={<NewDealSkeleton />}>
      <NewDeal searchParams={searchParams} />
    </Suspense>
  );
}

async function NewDeal({ searchParams }: { searchParams: PageProps<"/deals/new">["searchParams"] }) {
  const user = await requireUser();
  if (!user.canEdit) return <Forbidden user={user} />;
  const sp = await searchParams;
  const fromId = typeof sp.company === "string" && /^\d+$/.test(sp.company) ? Number(sp.company) : null;
  const [companies, from] = await Promise.all([companyOptions(), fromId ? store().get("companies", fromId) : Promise.resolve(undefined)]);
  return (
    <>
      <PhoneTitle title="New deal" back={from ? `/accounts/${from.id}` : "/pulse"} />
      <NewDealForm companies={companies} from={from ? { id: from.id, name: from.name } : null} />
    </>
  );
}

function NewDealSkeleton() {
  return (
    <div className="flex max-w-[760px] flex-col gap-5">
      <div className="flex flex-col gap-2 max-md:hidden">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <Skeleton className="h-[640px] rounded-[18px]" />
    </div>
  );
}
