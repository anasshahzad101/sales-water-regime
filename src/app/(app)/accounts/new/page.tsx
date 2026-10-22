import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Forbidden } from "@/components/ui/forbidden";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/kit";
import { requireUser } from "@/lib/auth/dal";
import { addCompanyOptions } from "@/lib/queries/accounts";
import { AddCompanyForm } from "./add-company-form";

export const metadata: Metadata = { title: "Add company" };

export default function AddCompanyPage() {
  return (
    <div className="flex flex-col gap-5">
      <div className="hidden flex-col gap-1.5 md:flex">
        <span className="flex items-center gap-1.5 text-[13px] text-text-3">
          <Link href="/accounts" className="text-text-2">
            Accounts
          </Link>
          <Icon name="chevron-right" size={13} />
          Add company
        </span>
        <h1 className="m-0 font-display text-[28px] font-semibold tracking-[-0.02em]">Add company</h1>
        <p className="m-0 text-[14.5px] text-text-2">You&apos;ll be the owner. Only the name is required; fill in the rest when you know it.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-[640px] rounded-[18px]" />}>
        <AddCompany />
      </Suspense>
    </div>
  );
}

async function AddCompany() {
  const user = await requireUser();
  if (!user.canEdit) return <Forbidden user={user} />;
  return <AddCompanyForm options={await addCompanyOptions()} />;
}
