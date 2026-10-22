/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import type { ReactNode } from "react";
import { Icon } from "./icon";

type Action = { label: string; icon: string; href?: string; onClick?: () => void; form?: (children: ReactNode) => ReactNode };

/** Full-bleed deep-teal error screen (403 / 404 / 500), the same in both themes. */
export function ErrorScreen({
  code,
  title,
  text,
  primary,
  secondary,
  reference,
}: {
  code: string;
  title: string;
  text: string;
  primary: Action;
  secondary?: Action;
  reference?: string;
}) {
  const btn = (a: Action, main: boolean) => {
    const cls = main
      ? "inline-flex h-[52px] items-center justify-center gap-2.5 rounded-full border-0 bg-[#00A950] px-6 text-base font-bold text-white shadow-[0_12px_28px_-12px_rgba(0,169,80,0.8)] hover:text-white hover:no-underline max-md:flex-[1_1_100%]"
      : "inline-flex h-[52px] items-center justify-center gap-2 rounded-full border border-white/20 bg-transparent px-[22px] text-[15px] font-semibold text-[#E6F2EC] hover:text-[#E6F2EC] hover:no-underline max-md:flex-[1_1_100%]";
    const inner = (
      <>
        <Icon name={a.icon} size={main ? 18 : 17} />
        {a.label}
      </>
    );
    if (a.href)
      return (
        <Link key={a.label} href={a.href} className={cls}>
          {inner}
        </Link>
      );
    if (a.form) return <span key={a.label}>{a.form(<button type="submit" className={cls}>{inner}</button>)}</span>;
    return (
      <button key={a.label} type="button" onClick={a.onClick} className={cls}>
        {inner}
      </button>
    );
  };
  return (
    <div className="flex min-h-screen flex-col bg-[#041C22] px-6 pt-5 pb-7 text-[#E6F2EC] md:px-16 md:py-10">
      <img src="/brand/logo-white.png" alt="Water Regime" className="block h-auto w-[120px] md:w-[150px]" />
      <div className="flex max-w-[600px] flex-1 flex-col justify-center gap-4 py-10">
        <span className="font-display text-[72px] leading-none font-semibold tracking-[-0.04em] text-[#9FF5C0] md:text-[120px]">{code}</span>
        <h1 className="m-0 font-display text-[26px] leading-[1.2] font-semibold tracking-[-0.02em] md:text-4xl">{title}</h1>
        <p className="m-0 text-base leading-relaxed text-pretty text-[#B7CCC2]">{text}</p>
        {reference && (
          <span className="inline-flex items-center gap-2 self-start rounded-full border border-white/20 px-3 py-1.5 font-mono text-[13px] text-[#B7CCC2]">
            <Icon name="hash" size={14} />
            {reference}
          </span>
        )}
        <div className="mt-3 flex flex-wrap gap-3">
          {btn(primary, true)}
          {secondary && btn(secondary, false)}
        </div>
      </div>
      <span className="text-[12.5px] text-[#9DB5AB]">WR Sales Hub · Water Regime (Pvt.) Ltd.</span>
    </div>
  );
}
