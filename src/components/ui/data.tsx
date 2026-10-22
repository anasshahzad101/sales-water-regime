import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

/** Big-number tile. Pass `href` to make it a drill-down. */
export function KpiTile({
  icon,
  iconColor,
  label,
  value,
  valueColor,
  sub,
  title,
  href,
  children,
}: {
  icon: string;
  iconColor: string;
  label: string;
  value: ReactNode;
  valueColor?: string;
  sub?: ReactNode;
  title?: string;
  href?: string;
  children?: ReactNode;
}) {
  const body = (
    <>
      <span className="flex items-center gap-2 text-[13px] font-semibold text-text-2">
        <Icon name={icon} size={15} style={{ color: iconColor }} />
        {label}
        {href && <Icon name="arrow-up-right" size={14} className="ml-auto text-text-3" />}
      </span>
      <span className="font-display text-[26px] font-semibold tracking-[-0.02em] tabular-nums max-md:text-[22px]" style={valueColor ? { color: valueColor } : undefined}>
        {value}
      </span>
      {children}
      {sub && <span className="text-[12.5px] text-text-3">{sub}</span>}
    </>
  );
  const cls = "flex min-w-0 flex-col gap-1.5 rounded-[18px] border border-line bg-surface px-[18px] py-4 text-ink shadow-[var(--shadow-sm)]";
  return href ? (
    <Link href={href} title={title} className={cn(cls, "hover:border-line-strong hover:bg-surface-2 hover:text-ink hover:no-underline")}>
      {body}
    </Link>
  ) : (
    <div title={title} className={cls}>
      {body}
    </div>
  );
}

/** Row of small labelled figures separated by thin rules. */
export function StatRow({ items }: { items: { label: string; value: ReactNode; title?: string; color?: string }[] }) {
  return (
    <div className="flex flex-wrap items-baseline gap-4">
      {items.map((it, i) => (
        <span key={it.label} className="flex items-stretch gap-4">
          {i > 0 && <span className="w-px self-stretch bg-line" />}
          <span className="flex flex-col" title={it.title}>
            <span className="font-display text-lg font-semibold tabular-nums" style={it.color ? { color: it.color } : undefined}>
              {it.value}
            </span>
            <span className="text-xs text-text-3">{it.label}</span>
          </span>
        </span>
      ))}
    </div>
  );
}
