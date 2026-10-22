"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";

type Hit = { type: "company" | "deal"; id: number; title: string; sub: string; href: string };

/** Global search over companies, brands, plants and deals ("/" opens it). */
export function SearchPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Fresh search each time it opens.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setQ("");
      setHits([]);
      setActive(0);
    }
  }
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => inputRef.current?.focus(), 10);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) return;
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        if (res.ok) {
          setHits(((await res.json()) as { hits: Hit[] }).hits);
          setActive(0);
        }
      } catch {
        // aborted or offline
      } finally {
        setLoading(false);
      }
    }, 160);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  if (!open) return null;
  const go = (h: Hit) => {
    onClose();
    router.push(h.href);
  };
  const companies = hits.filter((h) => h.type === "company");
  const deals = hits.filter((h) => h.type === "deal");
  const ordered = [...companies, ...deals];

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center md:pt-[12vh]" role="dialog" aria-label="Search">
      <div className="absolute inset-0 bg-scrim" onClick={onClose} />
      <div className="relative flex w-full flex-col overflow-hidden bg-surface shadow-[var(--shadow-lg)] max-md:h-full md:max-w-[620px] md:rounded-[18px] md:border md:border-line">
        <div className="flex items-center gap-3 border-b border-line px-4 max-md:pt-2">
          <Icon name="search" size={18} className="text-text-3" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(ordered.length - 1, a + 1));
              }
              if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(0, a - 1));
              }
              if (e.key === "Enter" && ordered[active]) go(ordered[active]);
            }}
            placeholder="Search companies, brands, plants or deals"
            className="h-14 flex-1 border-0 bg-transparent text-base text-ink outline-none placeholder:text-text-3"
            aria-label="Search"
          />
          {loading && <Icon name="loader-circle" size={16} className="animate-spin text-text-3" />}
          <button type="button" onClick={onClose} className="rounded-md border border-line px-2 py-0.5 text-[11.5px] font-semibold text-text-2">
            Esc
          </button>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2 max-md:max-h-none max-md:flex-1">
          {q.trim().length < 2 ? (
            <p className="m-0 px-3 py-6 text-center text-sm text-text-3">Type at least 2 letters.</p>
          ) : !loading && ordered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-3 py-8 text-center text-sm text-text-2">
              <Icon name="search-x" size={22} className="text-text-3" />
              No companies or deals match “{q.trim()}”.
            </div>
          ) : (
            [
              ["Companies", companies],
              ["Deals", deals],
            ].map(([label, list]) =>
              (list as Hit[]).length ? (
                <div key={label as string} className="flex flex-col">
                  <span className="px-3 pt-2 pb-1 text-[11px] font-bold tracking-[0.08em] text-text-3 uppercase">{label as string}</span>
                  {(list as Hit[]).map((h) => {
                    const idx = ordered.indexOf(h);
                    return (
                      <button
                        key={`${h.type}-${h.id}`}
                        type="button"
                        onMouseEnter={() => setActive(idx)}
                        onClick={() => go(h)}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border-0 px-3 py-2.5 text-left",
                          idx === active ? "bg-surface-2" : "bg-transparent",
                        )}
                      >
                        <span className="flex size-8 flex-none items-center justify-center rounded-[10px] bg-brand-soft text-green">
                          <Icon name={h.type === "company" ? "building-2" : "handshake"} size={16} />
                        </span>
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate text-sm font-semibold text-ink">{h.title}</span>
                          <span className="truncate text-[12.5px] text-text-2">{h.sub}</span>
                        </span>
                        <Icon name="chevron-right" size={16} className="ml-auto text-text-3" />
                      </button>
                    );
                  })}
                </div>
              ) : null,
            )
          )}
        </div>
      </div>
    </div>
  );
}
