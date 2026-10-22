import type { Metadata } from "next";
import { Suspense } from "react";
import { Forbidden } from "@/components/ui/forbidden";
import { Skeleton } from "@/components/ui/kit";
import { requireUser } from "@/lib/auth/dal";
import { getAdminUsers } from "@/lib/queries/admin";
import { requestNow } from "@/lib/queries/common";
import { UsersView } from "./users-view";

export const metadata: Metadata = { title: "Users" };

export default function UsersPage() {
  return (
    <Suspense fallback={<UsersSkeleton />}>
      <Users />
    </Suspense>
  );
}

async function Users() {
  const user = await requireUser();
  if (!user.isAdmin) return <Forbidden user={user} />;
  await requestNow();
  const data = await getAdminUsers(user.id);
  return <UsersView users={data.rows} regions={data.regions} activeCount={data.activeCount} />;
}

function UsersSkeleton() {
  return (
    <div className="flex flex-col gap-[18px]">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-16 max-md:hidden" />
        <Skeleton className="h-8 w-32 max-md:hidden" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="overflow-hidden rounded-[18px] border border-line bg-surface">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="flex items-center gap-3.5 border-t border-line px-5 py-3.5 first:border-t-0">
            <Skeleton className="size-8 rounded-full" />
            <span className="flex flex-1 flex-col gap-2">
              <Skeleton className="h-3 w-1/3" />
              <Skeleton className="h-2.5 w-1/5" />
            </span>
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
