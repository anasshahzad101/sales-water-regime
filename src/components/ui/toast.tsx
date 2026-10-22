"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Icon } from "./icon";

export type ToastTone = "success" | "error" | "warning" | "info";
export type ToastInput = { title: string; sub?: string; tone?: ToastTone; undo?: () => void | Promise<void>; ms?: number };

const ToastContext = createContext<(t: ToastInput | string) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

const TONE_ICON: Record<ToastTone, string> = {
  success: "circle-check",
  error: "circle-alert",
  warning: "triangle-alert",
  info: "info",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<(ToastInput & { id: number }) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const arm = useCallback((input: ToastInput) => {
    if (timer.current) clearTimeout(timer.current);
    // Errors stay until dismissed; toasts with Undo get a little longer.
    if (input.tone === "error" && !input.ms) return;
    timer.current = setTimeout(() => setToast(null), input.ms ?? (input.undo ? 8000 : 6000));
  }, []);

  const show = useCallback(
    (t: ToastInput | string) => {
      const input = typeof t === "string" ? { title: t } : t;
      setToast({ ...input, id: Date.now() });
      arm(input);
    },
    [arm],
  );

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const tone = toast?.tone ?? "success";
  return (
    <ToastContext value={show}>
      {children}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          key={toast.id}
          onMouseEnter={() => timer.current && clearTimeout(timer.current)}
          onMouseLeave={() => arm(toast)}
          className="fixed z-[60] flex items-center gap-3 rounded-2xl bg-inverse-bg py-2.5 pr-2 pl-4 text-inverse-ink shadow-[var(--shadow-lg)] max-md:inset-x-3 max-md:bottom-[calc(98px+env(safe-area-inset-bottom))] md:top-20 md:right-8 md:w-[420px]"
        >
          <Icon name={TONE_ICON[tone]} size={20} style={{ color: `var(--toast-${tone})` }} />
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-sm font-semibold">{toast.title}</span>
            {toast.sub && <span className="truncate text-[12.5px] opacity-85">{toast.sub}</span>}
          </span>
          {toast.undo && (
            <button
              type="button"
              onClick={async () => {
                const u = toast.undo!;
                setToast(null);
                await u();
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-inverse-line bg-transparent px-3 text-[13px] font-semibold text-inverse-accent"
            >
              <Icon name="undo-2" size={14} />
              Undo
            </button>
          )}
          <button
            type="button"
            aria-label="Dismiss"
            onClick={() => setToast(null)}
            className="flex size-9 items-center justify-center rounded-full border-0 bg-transparent text-inverse-ink"
          >
            <Icon name="x" size={16} />
          </button>
        </div>
      )}
    </ToastContext>
  );
}
