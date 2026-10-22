/* eslint-disable @next/next/no-img-element */
import type { ReactNode } from "react";

/** Brand panel + form column used by the sign-in and first-password screens. */
export function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col bg-bg md:grid md:grid-cols-[minmax(380px,44%)_minmax(0,1fr)]">
      <div className="flex flex-col items-start bg-nav-bg px-6 pt-3 pb-7 md:justify-between md:gap-10 md:px-14 md:py-12">
        <img src="/brand/logo-white.png" alt="Water Regime" className="block h-auto w-[150px] md:w-[200px]" />
        <div className="hidden max-w-[420px] flex-col gap-3.5 md:flex">
          <span className="font-display text-[34px] leading-[1.15] font-semibold tracking-[-0.02em] text-[#E6F2EC]">Sales Hub</span>
          <span className="text-base leading-relaxed text-[#9DB5AB]">
            Accounts, visits and deals for the Water Regime sales team, in one place.
          </span>
        </div>
        <span className="hidden text-[12.5px] text-[#9DB5AB] md:block">Water Regime (Pvt.) Ltd. · Internal use only</span>
      </div>
      <div className="flex flex-1 justify-center px-5 pt-7 pb-10 md:items-center md:p-12">
        <div className="flex w-full max-w-[400px] flex-col gap-5">{children}</div>
      </div>
    </div>
  );
}
