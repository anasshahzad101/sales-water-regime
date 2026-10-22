"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { setVisitOutcome, undoVisitOutcome } from "@/app/actions/visits";
import { Icon } from "@/components/ui/icon";
import { CountChip, countdown, CountdownPill, hueClass } from "@/components/ui/pills";
import { useToast } from "@/components/ui/toast";
import { LATE_REASON_MIN, OUTCOMES, SKIP_REASONS, outcomeOf, visitTypeIcon } from "@/lib/constants";
import { cn } from "@/lib/cn";
import type { PendingVisit } from "@/lib/queries/my-week";

const CHOICES = OUTCOMES.filter((o) => o.key !== "pending");
const EMPTY = new Set<number>();

export function OutcomeList({ visits, canEdit }: { visits: PendingVisit[]; canEdit: boolean }) {
  const toast = useToast();
  // Optimistically hidden rows; forgotten when fresh server data arrives.
  const [hiddenFor, setHiddenFor] = useState<{ src: PendingVisit[]; ids: Set<number> }>({ src: visits, ids: new Set() });
  const hidden = hiddenFor.src === visits ? hiddenFor.ids : EMPTY;
  const setHidden = (fn: (h: Set<number>) => Set<number>) => setHiddenFor((cur) => ({ src: visits, ids: fn(cur.src === visits ? cur.ids : new Set()) }));
  const [pending, setPending] = useState<{ id: number; key: string | null } | null>(null);
  const [sheet, setSheet] = useState<"pick" | "details" | null>(null);
  const [skipReason, setSkipReason] = useState("");
  const [lateReason, setLateReason] = useState("");
  const [errors, setErrors] = useState<{ skip?: string; late?: string }>({});
  const [busy, startTransition] = useTransition();

  const open = visits.filter((v) => !hidden.has(v.id));
  const overdueCount = open.filter((v) => v.hrsLeft <= 0).length;
  const pv = pending ? (visits.find((v) => v.id === pending.id) ?? null) : null;
  const po = pending?.key ? outcomeOf(pending.key) : null;
  const needsLate = !!pv && pv.hrsLeft <= 0;
  const isSkip = po?.key === "skipped";
  const stepTwo = isSkip && needsLate ? "Skip + late reason" : isSkip ? "Skip reason" : "Late reason";

  const reset = () => {
    setPending(null);
    setSheet(null);
    setErrors({});
    setSkipReason("");
    setLateReason("");
  };

  const commit = (v: PendingVisit, key: string, skip: string, late: string) => {
    startTransition(async () => {
      const res = await setVisitOutcome({ visitId: v.id, outcome: key, skipReason: skip, lateReason: late });
      if (!res.ok) {
        if (res.fieldErrors) setErrors({ skip: res.fieldErrors.skip, late: res.fieldErrors.late });
        else toast({ title: "Couldn’t save the outcome", sub: res.error, tone: "error" });
        return;
      }
      setHidden((h) => new Set(h).add(v.id));
      reset();
      toast({
        title: "Outcome saved",
        sub: `${outcomeOf(key).label} · ${v.company}`,
        undo: async () => {
          const u = await undoVisitOutcome(v.id);
          if (!u.ok) toast({ title: "Couldn’t undo", sub: u.error, tone: "error" });
        },
      });
    });
  };

  const pick = (v: PendingVisit, key: string, fromSheet = false) => {
    if (key === "skipped" || v.hrsLeft <= 0) {
      setPending({ id: v.id, key });
      setSkipReason("");
      setLateReason("");
      setErrors({});
      setSheet(fromSheet ? "details" : null);
    } else commit(v, key, "", "");
  };

  const save = () => {
    if (!pv || !po) return;
    const e: { skip?: string; late?: string } = {};
    if (isSkip && !skipReason) e.skip = "Choose why this visit was skipped.";
    if (needsLate && lateReason.trim().length < LATE_REASON_MIN) e.late = `Add a short reason (at least ${LATE_REASON_MIN} characters).`;
    if (e.skip || e.late) return setErrors(e);
    commit(pv, po.key, skipReason, lateReason);
  };

  const countChip =
    overdueCount > 0 ? (
      <CountChip tone="red" icon="alarm-clock">
        {open.length} · {overdueCount} overdue
      </CountChip>
    ) : open.length > 0 ? (
      <CountChip>{open.length}</CountChip>
    ) : null;

  const allClear = (
    <div className="flex items-center gap-3.5 border-line px-5 py-6 max-md:rounded-[18px] max-md:border max-md:bg-surface max-md:p-4 md:border-t">
      <span className="flex size-11 flex-none items-center justify-center rounded-full bg-green-bg text-green">
        <Icon name="circle-check" size={22} />
      </span>
      <div className="flex flex-col gap-0.5">
        <span className="text-[15px] font-semibold">All clear</span>
        <span className="text-[13.5px] leading-snug text-text-2">
          Every visit has an outcome.<span className="max-md:hidden"> New visits show up here with a 48-hour countdown.</span>
        </span>
      </div>
    </div>
  );

  /** Step 2 of a skipped or late outcome: shared by the desktop panel and the phone sheet. */
  const details = (phone: boolean) =>
    po && (
      <div className="flex flex-col gap-4">
        <div className={cn("flex items-center font-semibold", phone ? "gap-2 text-[12.5px]" : "gap-2.5 text-[12.5px]")}>
          <span className="inline-flex items-center gap-1.5 text-green">
            <span className="flex size-5 items-center justify-center rounded-full bg-green-bg">
              <Icon name="check" size={12} />
            </span>
            Outcome
          </span>
          <span className="h-px w-7 bg-line-strong" />
          <span className="inline-flex items-center gap-1.5 text-ink">
            <span className="flex size-5 items-center justify-center rounded-full bg-ink text-[11px] text-surface">2</span>
            {stepTwo}
          </span>
          {!phone && <span className="ml-auto text-xs font-medium text-text-3">Required before saving</span>}
        </div>
        <div className={cn("flex items-center gap-2.5", phone && "rounded-[14px] border border-line bg-surface-2 py-2.5 pr-1.5 pl-3")}>
          <span className={cn("inline-flex h-7 items-center gap-1.5 rounded-full pr-3 pl-2.5 font-semibold", phone ? "text-[13.5px]" : "text-[13px]", hueClass(po.hue))}>
            <Icon name={po.icon} size={14} />
            {po.label}
          </span>
          <button
            type="button"
            onClick={() => (phone ? (setSheet("pick"), setErrors({})) : reset())}
            className={cn("rounded-full border-0 bg-transparent px-2.5 font-semibold text-link", phone ? "ml-auto h-11 text-sm" : "h-7 text-[13px]")}
          >
            Change
          </button>
        </div>
        {isSkip && (
          <div className="flex flex-col gap-2">
            <span className="text-[13.5px] font-semibold">
              Skip reason <span className="text-red">*</span>
            </span>
            <div className={cn("flex gap-2", phone ? "flex-col gap-1.5" : "flex-wrap")}>
              {SKIP_REASONS.map((r) => {
                const sel = skipReason === r;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => {
                      setSkipReason(r);
                      setErrors((e) => ({ ...e, skip: undefined }));
                    }}
                    className={cn(
                      "inline-flex items-center rounded-full border text-left font-medium",
                      phone ? "min-h-12 gap-2.5 rounded-xl px-3.5 text-[14.5px]" : "h-[34px] gap-1.5 pr-3 pl-2.5 text-[13px]",
                      sel ? "border-primary bg-brand-soft text-green" : "border-line-strong bg-surface text-ink",
                    )}
                  >
                    <Icon name={sel ? "circle-check" : "circle"} size={phone ? 18 : 14} />
                    {r}
                  </button>
                );
              })}
            </div>
            {errors.skip && (
              <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-red">
                <Icon name="circle-alert" size={13} />
                {errors.skip}
              </span>
            )}
          </div>
        )}
        {needsLate && (
          <label className="flex flex-col gap-1.5">
            <span className={cn("font-semibold", phone ? "text-sm" : "text-[13.5px]")}>
              Why is this outcome late? <span className="text-red">*</span>
            </span>
            <textarea
              rows={3}
              value={lateReason}
              onChange={(e) => {
                setLateReason(e.target.value);
                setErrors((x) => ({ ...x, late: undefined }));
              }}
              placeholder={phone ? "e.g. Waited for the client's lab report" : "e.g. Waited for the client's lab report before confirming next steps"}
              className={cn(
                "wr-field border bg-input text-ink outline-none",
                phone ? "min-h-24 resize-none rounded-[14px] px-3.5 py-3 text-[15px] leading-normal" : "min-h-[84px] resize-y rounded-xl px-3 py-2.5 text-sm leading-normal",
                errors.late ? "border-red" : "border-line-strong",
              )}
            />
            {errors.late ? (
              <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-red">
                <Icon name="circle-alert" size={13} />
                {errors.late}
              </span>
            ) : (
              <span className="text-[12.5px] leading-snug text-text-3">
                {phone ? "" : `Required because this is ${countdown(pv!.hrsLeft).lateBy} past the 48-hour window. `}Saved with the visit and visible to your manager.
              </span>
            )}
          </label>
        )}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-full border-0 bg-primary font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-60",
              phone ? "h-[52px] flex-1 text-base" : "h-10 px-5 text-sm",
            )}
          >
            <Icon name={busy ? "loader-circle" : "check"} size={phone ? 18 : 15} className={busy ? "animate-spin" : undefined} />
            Save outcome
          </button>
          {!phone && (
            <button type="button" onClick={reset} className="h-10 rounded-full border-0 bg-transparent px-4 text-sm font-semibold text-text-2 hover:bg-bg-alt">
              Cancel
            </button>
          )}
        </div>
      </div>
    );

  return (
    <>
      {/* desktop */}
      <section className="hidden overflow-hidden rounded-[18px] border border-line bg-surface shadow-[var(--shadow-sm)] md:block">
        <div className="flex items-center gap-2.5 px-5 pt-[18px] pb-3.5">
          <h2 className="m-0 font-display text-[17px] font-semibold">Awaiting outcome</h2>
          {countChip}
          <span className="ml-auto flex items-center gap-1.5 text-[12.5px] text-text-3">
            <Icon name="info" size={14} />
            Every visit needs an outcome within 48 hrs
          </span>
        </div>
        {open.map((v) => {
          const c = countdown(v.hrsLeft);
          const expanded = !!po && pv?.id === v.id;
          return (
            <div
              key={v.id}
              className="flex flex-col gap-3 border-t border-line px-5 py-4"
              style={{ background: c.overdue ? "color-mix(in srgb, var(--red-bg) 45%, transparent)" : undefined }}
            >
              <div className="flex items-start gap-3.5">
                <span className="flex size-10 flex-none items-center justify-center rounded-xl bg-bg-alt text-text-2">
                  <Icon name={visitTypeIcon(v.type)} size={18} />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <div className="flex flex-wrap items-baseline gap-2">
                    <Link href={`/accounts/${v.companyId}`} className="text-[15px] font-semibold text-ink hover:text-ink">
                      {v.company}
                    </Link>
                    {v.sub && <span className="text-[13px] text-text-3">{v.sub}</span>}
                  </div>
                  <div className="text-[13px] text-text-2">
                    {v.type} · {v.when}
                    {v.contact ? ` · with ${v.contact}` : ""}
                  </div>
                </div>
                <CountdownPill hrsLeft={v.hrsLeft} title={`Outcome due ${v.dueAt}`} withBar />
              </div>
              {c.overdue && (
                <div className="flex items-center gap-2 pl-[54px] text-[13px] font-medium text-red">
                  <Icon name="triangle-alert" size={14} />
                  {c.lateBy} past the 48-hour window. You&apos;ll need to add a late reason.
                </div>
              )}
              {expanded ? (
                <div className="ml-[54px] rounded-[14px] border border-line bg-surface-2 p-4">{details(false)}</div>
              ) : (
                <div className="flex flex-wrap items-center gap-2 pl-[54px]">
                  {canEdit &&
                    CHOICES.map((o) => (
                      <button
                        key={o.key}
                        type="button"
                        title={o.label}
                        disabled={busy}
                        onClick={() => pick(v, o.key)}
                        className="inline-flex h-[34px] items-center gap-1.5 rounded-full border border-line-strong bg-surface pr-3 pl-2.5 text-[13px] font-medium text-ink hover:border-text-3 hover:bg-surface-2 disabled:opacity-60"
                      >
                        <Icon name={o.icon} size={15} style={{ color: `var(--${o.hue})` }} />
                        {o.short}
                      </button>
                    ))}
                  <Link href={`/visits?visit=${v.id}`} className="ml-auto text-[13px] font-semibold text-link">
                    Open visit
                  </Link>
                </div>
              )}
            </div>
          );
        })}
        {open.length === 0 && allClear}
      </section>

      {/* phone */}
      <section className="flex flex-col gap-3 md:hidden">
        <div className="flex items-center gap-2">
          <h2 className="m-0 font-display text-lg font-semibold">Awaiting outcome</h2>
          {countChip}
        </div>
        {open.map((v) => {
          const c = countdown(v.hrsLeft);
          return (
            <article
              key={v.id}
              className={cn("flex flex-col gap-2.5 rounded-[18px] border bg-surface px-4 pt-3.5 pb-4 shadow-[var(--shadow-sm)]", c.overdue ? "border-red" : "border-line")}
            >
              <div className="flex items-start gap-2.5">
                <Link href={`/accounts/${v.companyId}`} className="flex min-w-0 flex-1 flex-col gap-0.5 text-ink hover:text-ink hover:no-underline">
                  <span className="text-[15.5px] font-semibold">{v.company}</span>
                  {v.sub && <span className="text-[13px] text-text-3">{v.sub}</span>}
                </Link>
                <CountdownPill hrsLeft={v.hrsLeft} short />
              </div>
              <div className="flex items-center gap-2 text-[13.5px] text-text-2">
                <Icon name={visitTypeIcon(v.type)} size={15} />
                {v.type} · {v.whenShort}
              </div>
              {c.overdue && (
                <div className="flex items-start gap-2 text-[13px] leading-[1.4] font-medium text-red">
                  <Icon name="triangle-alert" size={14} className="mt-0.5" />
                  {c.lateBy} past 48 hrs — a late reason is required.
                </div>
              )}
              {canEdit && (
                <button
                  type="button"
                  onClick={() => {
                    setPending({ id: v.id, key: null });
                    setSheet("pick");
                    setErrors({});
                    setSkipReason("");
                    setLateReason("");
                  }}
                  className={cn(
                    "flex h-[46px] items-center justify-center gap-2 rounded-full text-[15px] font-semibold",
                    c.overdue ? "border-0 bg-primary text-on-primary" : "border border-line-strong bg-surface text-ink",
                  )}
                >
                  Set outcome
                </button>
              )}
            </article>
          );
        })}
        {open.length === 0 && allClear}
      </section>

      {/* phone bottom sheet */}
      {sheet && pv && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end md:hidden">
          <div className="absolute inset-0 bg-scrim" onClick={reset} />
          <div role="dialog" aria-label="Set outcome" className="relative flex max-h-[90%] flex-col gap-4 overflow-y-auto rounded-t-[28px] bg-surface px-5 pt-2 pb-[calc(30px+env(safe-area-inset-bottom))] shadow-[var(--shadow-lg)]">
            <div className="mx-auto mb-0.5 h-[5px] w-10 rounded-full bg-line-strong" />
            <div className="flex items-start gap-2">
              <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
                <span className="font-display text-[19px] font-semibold">{sheet === "details" ? "Almost done" : "Set outcome"}</span>
                <span className="text-[13.5px] text-text-2">
                  {pv.company} · {pv.type}
                </span>
                <span className="text-[13px] text-text-3">{pv.whenShort}</span>
              </div>
              <button type="button" onClick={reset} aria-label="Close" className="-mt-1.5 -mr-2.5 flex size-11 items-center justify-center rounded-full border-0 bg-transparent text-text-2">
                <Icon name="x" size={22} />
              </button>
            </div>
            {needsLate && (
              <div className="flex items-start gap-2.5 rounded-[14px] bg-red-bg px-3.5 py-3 text-[13.5px] leading-[1.4] font-medium text-red">
                <Icon name="alarm-clock" size={17} className="mt-0.5" />
                <span>Overdue by {countdown(pv.hrsLeft).lateBy}. After choosing an outcome you&apos;ll add a late reason — both are required.</span>
              </div>
            )}
            {sheet === "pick" && (
              <div className="flex flex-col gap-2">
                {CHOICES.map((o) => (
                  <button
                    key={o.key}
                    type="button"
                    disabled={busy}
                    onClick={() => pick(pv, o.key, true)}
                    className="flex min-h-14 items-center gap-3 rounded-[14px] border border-line bg-surface px-3 text-left text-ink disabled:opacity-60"
                  >
                    <span className={cn("flex size-9 flex-none items-center justify-center rounded-[10px]", hueClass(o.hue))}>
                      <Icon name={o.icon} size={18} />
                    </span>
                    <span className="flex-1 text-[15px] font-medium">{o.label}</span>
                    <Icon name="chevron-right" size={18} className="text-text-3" />
                  </button>
                ))}
              </div>
            )}
            {sheet === "details" && details(true)}
          </div>
        </div>
      )}
    </>
  );
}
