"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Button } from "./kit";
import { Icon } from "./icon";

/** Esc to close, focus moves in on open and back to the trigger on close. */
function useOverlay(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => {
      const el = ref.current?.querySelector<HTMLElement>("[data-autofocus], input:not([type=hidden]), textarea, select, button");
      el?.focus();
    }, 20);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Tab" && ref.current) {
        const f = [...ref.current.querySelectorAll<HTMLElement>("a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),textarea,select")];
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.();
    };
  }, [open, onClose]);
  return ref;
}

function SheetHandle() {
  return <div className="mx-auto mb-1 h-[5px] w-10 flex-none rounded-full bg-line-strong md:hidden" />;
}

/**
 * Desktop: centred modal (decisions). Phone: bottom sheet.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  icon,
  iconTone = "brand",
  children,
  footer,
  width = 460,
  role = "dialog",
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  icon?: string;
  iconTone?: "brand" | "danger" | "warning";
  children?: ReactNode;
  footer?: ReactNode;
  width?: number;
  role?: "dialog" | "alertdialog";
}) {
  const ref = useOverlay(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center md:p-6">
      <div className="absolute inset-0 bg-scrim" onClick={onClose} />
      <div
        ref={ref}
        role={role}
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        className="relative flex max-h-[92vh] w-full flex-col gap-4 overflow-y-auto rounded-t-[28px] bg-surface px-5 pt-2 pb-[calc(24px+env(safe-area-inset-bottom))] shadow-[var(--shadow-lg)] md:rounded-[28px] md:p-6"
        style={{ maxWidth: width }}
      >
        <SheetHandle />
        <div className="flex items-start gap-3">
          {icon && (
            <span
              className={cn(
                "flex size-[38px] flex-none items-center justify-center rounded-xl",
                iconTone === "danger" ? "bg-red-bg text-red" : iconTone === "warning" ? "bg-amber-bg text-amber" : "bg-brand-soft text-green",
              )}
            >
              <Icon name={icon} size={18} />
            </span>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 className="m-0 font-display text-[19px] font-semibold tracking-[-0.01em] md:text-lg">{title}</h2>
            {description && <p className="m-0 text-[13.5px] leading-normal text-text-2">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="-mt-1 -mr-2 flex size-10 flex-none items-center justify-center rounded-full border-0 bg-transparent text-text-2 hover:bg-surface-2">
            <Icon name="x" size={20} />
          </button>
        </div>
        {children}
        {footer && <div className="flex gap-2 max-md:[&>*]:flex-1 md:justify-end">{footer}</div>}
      </div>
    </div>
  );
}

/**
 * Desktop: right-hand drawer (forms). Phone: bottom sheet.
 */
export function Drawer({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  width = 480,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}) {
  const ref = useOverlay(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end md:items-stretch md:justify-end">
      <div className="absolute inset-0 bg-scrim" onClick={onClose} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
        className="relative flex max-h-[92vh] w-full flex-col rounded-t-[28px] bg-surface shadow-[var(--shadow-lg)] md:h-full md:max-h-none md:rounded-none"
        style={{ maxWidth: width }}
      >
        <div className="flex flex-none flex-col gap-1 border-b border-line px-5 pt-2 pb-4 md:px-6 md:pt-6">
          <SheetHandle />
          <div className="flex items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <h2 className="m-0 font-display text-[19px] font-semibold tracking-[-0.01em]">{title}</h2>
              {description && <p className="m-0 text-[13.5px] leading-normal text-text-2">{description}</p>}
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="-mt-1 -mr-2 flex size-10 flex-none items-center justify-center rounded-full border-0 bg-transparent text-text-2 hover:bg-surface-2">
              <Icon name="x" size={20} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5 md:px-6">{children}</div>
        {footer && (
          <div className="flex flex-none gap-2 border-t border-line px-5 pt-3 pb-[calc(16px+env(safe-area-inset-bottom))] max-md:[&>*]:flex-1 md:justify-end md:px-6 md:py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/** Destructive confirmation. Cancel gets focus first. */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Delete",
  busy,
  icon = "trash-2",
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  busy?: boolean;
  icon?: string;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      icon={icon}
      iconTone="danger"
      role="alertdialog"
      width={420}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} data-autofocus>
            Cancel
          </Button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border-0 bg-danger px-5 text-[15px] font-semibold text-white hover:opacity-90 disabled:opacity-60"
          >
            {busy && <Icon name="loader-circle" size={16} className="animate-spin" />}
            {confirmLabel}
          </button>
        </>
      }
    />
  );
}
