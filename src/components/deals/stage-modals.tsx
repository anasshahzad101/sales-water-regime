"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/overlay";
import { LOST_REASONS } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";

const cancelBtn = "h-[50px] flex-1 rounded-full border border-line-strong bg-surface text-[14.5px] font-semibold text-ink md:h-11";

type LostProps = {
  open: boolean;
  description: string;
  busy: boolean;
  /** Error from the server (e.g. a rejected reason). */
  error?: string;
  onEdit?: () => void;
  onClose: () => void;
  onConfirm: (reason: string, note: string) => void;
};

/** Moving a deal to Lost: a reason is required, and a note for “Other”. */
export function LostModal(props: LostProps) {
  // Mounted only while open, so every opening starts blank.
  return props.open ? <LostBody {...props} /> : null;
}

function LostBody({ description, busy, error, onEdit, onClose, onConfirm }: LostProps) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState("");
  const shown = err || error;
  const other = reason === "Other (specify)";

  const edited = () => {
    setErr("");
    onEdit?.();
  };
  const confirm = () => {
    if (!reason) return setErr("Pick the main reason.");
    if (other && !note.trim()) return setErr("Add a short note for “Other”.");
    onConfirm(reason, note);
  };

  return (
    <Modal open onClose={onClose} title="Move to Lost" description={description} width={520}>
      <div className="flex flex-col gap-2">
        <span className="text-[13.5px] font-semibold">
          Why was it lost? <span className="text-red">*</span>
        </span>
        <div role="radiogroup" className="flex flex-col gap-1.5">
          {LOST_REASONS.map((r) => {
            const on = reason === r;
            return (
              <button
                key={r}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => {
                  setReason(r);
                  edited();
                }}
                className={cn(
                  "flex min-h-12 items-center gap-2.5 rounded-xl border px-3 text-left text-sm text-ink md:min-h-[42px]",
                  on ? "border-red bg-red-bg font-semibold" : "border-line-strong bg-surface font-medium",
                )}
              >
                <Icon name={on ? "circle-dot" : "circle"} size={17} className={on ? "text-red" : "text-text-3"} />
                {r}
              </button>
            );
          })}
        </div>
        {shown && (
          <span className="flex items-center gap-1.5 text-[13px] font-medium text-red">
            <Icon name="circle-alert" size={14} />
            {shown}
          </span>
        )}
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13.5px] font-semibold">{other ? "Note (required for Other)" : "Note (optional)"}</span>
        <textarea
          rows={2}
          value={note}
          onChange={(e) => {
            setNote(e.target.value);
            edited();
          }}
          placeholder="e.g. Competitor quoted 12% lower with a 5-year O&M"
          className={cn(
            "wr-field min-h-16 resize-none rounded-xl border bg-input px-3 py-2.5 text-base leading-normal text-ink outline-none md:text-sm",
            shown && other ? "border-red" : "border-line-strong",
          )}
        />
      </label>
      <div className="flex gap-2.5">
        <button type="button" onClick={onClose} className={cancelBtn}>
          Cancel
        </button>
        <button
          type="button"
          onClick={confirm}
          disabled={busy}
          className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-full border-0 bg-danger text-[14.5px] font-semibold text-white disabled:opacity-60 md:h-11"
        >
          <Icon name={busy ? "loader-circle" : "circle-x"} size={16} className={busy ? "animate-spin" : undefined} />
          Move to Lost
        </button>
      </div>
    </Modal>
  );
}

/** Confirms marking a deal as Won (PO). */
export function WonModal({
  open,
  description,
  value,
  busy,
  onClose,
  onConfirm,
}: {
  open: boolean;
  description: string;
  value: number | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} title="Mark as Won (PO)" description={description} width={520}>
      <div className="flex items-start gap-3 rounded-[14px] bg-green-bg px-4 py-3.5">
        <Icon name="trophy" size={20} className="mt-0.5 text-green" />
        <span className="text-sm leading-normal">
          Mark as <b>Won (PO)</b>? Probability becomes 100% and {money(value)} counts as won in the Cockpit.
        </span>
      </div>
      <div className="flex gap-2.5">
        <button type="button" onClick={onClose} className={cancelBtn}>
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-full border-0 bg-primary text-[14.5px] font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-60 md:h-11"
        >
          {busy && <Icon name="loader-circle" size={16} className="animate-spin" />}
          Mark as Won
        </button>
      </div>
    </Modal>
  );
}
