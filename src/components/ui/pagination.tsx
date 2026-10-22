import Link from "next/link";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";

/** "Showing 1–25 of 334" plus page links that keep the current filters. */
export function Pagination({
  total,
  page,
  pageSize,
  params,
  basePath,
}: {
  total: number;
  page: number;
  pageSize: number;
  params: Record<string, string | undefined>;
  basePath: string;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const href = (p: number) => {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v && k !== "page") q.set(k, v);
    if (p > 1) q.set("page", String(p));
    const s = q.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const nums: (number | "…")[] = [];
  for (let p = 1; p <= pages; p++) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) nums.push(p);
    else if (nums[nums.length - 1] !== "…") nums.push("…");
  }
  const btn = "flex size-9 items-center justify-center rounded-[10px] text-[13px] tabular-nums md:size-8";
  return (
    <div className="flex items-center gap-2 px-4 py-2.5 text-[13px] text-text-2 md:px-5">
      <span>
        Showing {from}–{to} of {total}
      </span>
      {pages > 1 && (
        <span className="ml-auto flex items-center gap-1">
          {page > 1 && (
            <Link href={href(page - 1)} aria-label="Previous page" className={cn(btn, "text-text-2 hover:bg-surface-2 hover:text-ink")}>
              <Icon name="chevron-left" size={16} />
            </Link>
          )}
          {nums.map((n, i) =>
            n === "…" ? (
              <span key={`e${i}`} className={btn}>
                …
              </span>
            ) : (
              <Link
                key={n}
                href={href(n)}
                aria-current={n === page ? "page" : undefined}
                className={cn(btn, "hover:no-underline", n === page ? "bg-brand-soft font-bold text-green" : "text-ink hover:bg-surface-2 hover:text-ink", Math.abs(n - page) > 1 && n !== 1 && n !== pages && "max-md:hidden")}
              >
                {n}
              </Link>
            ),
          )}
          {page < pages && (
            <Link href={href(page + 1)} aria-label="Next page" className={cn(btn, "text-text-2 hover:bg-surface-2 hover:text-ink")}>
              <Icon name="chevron-right" size={16} />
            </Link>
          )}
        </span>
      )}
    </div>
  );
}
