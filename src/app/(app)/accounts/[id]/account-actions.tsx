"use client";

import Link from "next/link";
import { useTransition } from "react";
import { claimAccount, undoClaim } from "@/app/actions/accounts";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";

const secondary =
  "inline-flex h-[46px] items-center justify-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-sm font-semibold text-ink hover:bg-surface-2 hover:text-ink hover:no-underline disabled:opacity-60 max-md:flex-1 md:h-[42px]";

/** Log a visit · Claim account · New deal. Claiming needs no approval — by design. */
export function AccountActions({ companyId, companyName, canClaim, ownerName }: { companyId: number; companyName: string; canClaim: boolean; ownerName: string | null }) {
  const toast = useToast();
  const [busy, start] = useTransition();
  const claim = () =>
    start(async () => {
      const res = await claimAccount(companyId);
      if (!res.ok) return toast({ title: "Couldn’t claim the account", sub: res.error, tone: "error" });
      const prev = res.data!;
      toast({
        title: "Account claimed",
        sub: `${companyName} is now in your list`,
        undo: async () => {
          const u = await undoClaim(companyId, prev.prevOwnerId, prev.prevOwnerSince);
          if (!u.ok) toast({ title: "Couldn’t undo", sub: u.error, tone: "error" });
        },
      });
    });
  return (
    <div className="flex w-full flex-wrap items-center gap-2.5 md:w-auto">
      <Link
        href={`/log?company=${companyId}`}
        className="inline-flex h-[52px] flex-[1_1_100%] items-center justify-center gap-2 rounded-full bg-cta pr-[22px] pl-[18px] text-[15px] font-bold text-on-cta shadow-[0_10px_24px_-12px_rgba(0,169,80,0.8)] hover:bg-cta-hover hover:text-on-cta hover:no-underline md:h-[46px] md:flex-none"
      >
        <Icon name="notebook-pen" size={17} />
        Log a visit
      </Link>
      {canClaim && (
        <button type="button" onClick={claim} disabled={busy} title={ownerName ? `Currently owned by ${ownerName}` : "Nobody owns this account yet"} className={secondary}>
          <Icon name={busy ? "loader-circle" : "hand"} size={16} className={busy ? "animate-spin" : undefined} />
          Claim account
        </button>
      )}
      <Link href={`/deals/new?company=${companyId}`} className={secondary}>
        <Icon name="plus" size={16} />
        New deal
      </Link>
    </div>
  );
}
