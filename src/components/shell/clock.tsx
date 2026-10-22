"use client";

import { useSyncExternalStore } from "react";
import { fmtDate, fmtTime, fmtWeekday } from "@/lib/time";

// Ticks every 30 s; the snapshot is a stable number so React only re-renders on change.
const subscribe = (cb: () => void) => {
  const iv = setInterval(cb, 30_000);
  return () => clearInterval(iv);
};
const snapshot = () => Math.floor(Date.now() / 30_000) * 30_000;

/** "Thu 22 Oct 2026 · 9:12 AM PKT", ticking once a minute. */
export function Clock() {
  const ms = useSyncExternalStore(subscribe, snapshot, () => null);
  if (ms == null) return <span className="inline-block w-[210px]" />;
  const now = new Date(ms);
  return (
    <span>
      {fmtWeekday(now)} {fmtDate(now)} · {fmtTime(now)} PKT
    </span>
  );
}
