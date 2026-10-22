"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./icon";
import { useToast } from "./toast";

/**
 * Downloads the filtered list on screen as .xlsx. `href` is an /export/... route that
 * accepts the same query parameters as the page.
 */
export function ExportButton({ href, label = "Export to Excel", compact = false, className }: { href: string; label?: string; compact?: boolean; className?: string }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const run = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(href);
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const blob = await res.blob();
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "export.xlsx";
      const rows = res.headers.get("X-Row-Count");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      toast({ title: "Export ready", sub: `${name}${rows ? ` · ${rows} rows` : ""}`, tone: "info" });
    } catch (e) {
      toast({ title: "Couldn’t export", sub: e instanceof Error ? e.message.slice(0, 120) : "Try again.", tone: "error" });
    } finally {
      setBusy(false);
    }
  };
  return (
    <button
      type="button"
      onClick={run}
      aria-busy={busy}
      title={compact ? label : undefined}
      className={cn(
        "inline-flex h-10 flex-none items-center justify-center gap-2 rounded-full border border-line-strong bg-surface text-sm font-semibold hover:bg-surface-2 max-md:h-12",
        compact ? "w-12 md:w-auto md:px-4" : "px-4",
        busy ? "text-text-2" : "text-ink",
        className,
      )}
    >
      <Icon name={busy ? "loader-circle" : "file-spreadsheet"} size={16} className={cn("text-green", busy && "animate-spin")} />
      <span className={cn(compact && "max-md:hidden")}>{busy ? "Preparing .xlsx…" : label}</span>
    </button>
  );
}
