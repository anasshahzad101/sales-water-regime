"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { addProposal, changeDealStage, setProposalStatus, undoDealStage, updateDeal } from "@/app/actions/deals";
import { Icon } from "@/components/ui/icon";
import { Modal } from "@/components/ui/overlay";
import { CountdownPill, hueClass, OutcomePill, Pill } from "@/components/ui/pills";
import { useToast } from "@/components/ui/toast";
import { LOST_REASONS, PROPOSAL_STATUSES, SOLUTION_TYPES, STAGES, proposalStatusOf, stageOf, visitTypeIcon, type StageKey } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { money, moneyFull } from "@/lib/format";
import type { DealView as Deal } from "@/lib/queries/deals";

const card = "rounded-[18px] border border-line bg-surface shadow-[var(--shadow-sm)]";
const fieldBox = "wr-field flex h-12 items-center overflow-hidden rounded-xl border bg-input md:h-[42px]";
const addon = "flex h-full items-center bg-bg-alt px-2.5 text-[12.5px] font-bold text-text-2";
const fieldInput = "h-full min-w-0 flex-1 border-0 bg-transparent px-3 text-base text-ink outline-none md:text-sm";

export function DealView({ deal }: { deal: Deal }) {
  const toast = useToast();
  const [busy, startTransition] = useTransition();
  const [modal, setModal] = useState<null | "lost" | "won" | "edit">(null);
  const [lostReason, setLostReason] = useState("");
  const [lostNote, setLostNote] = useState("");
  const [lostErr, setLostErr] = useState("");
  const [addOpen, setAddOpen] = useState(false);

  const st = stageOf(deal.stage);
  const ro = !deal.canEdit;
  const order = STAGES.map((s) => s.key);
  const ci = order.indexOf(deal.stage);

  const runStage = (stage: StageKey, extra?: { lostReason: string; lostNote: string }) => {
    startTransition(async () => {
      const res = await changeDealStage({ dealId: deal.id, stage, lostReason: extra?.lostReason, lostNote: extra?.lostNote });
      if (!res.ok) {
        if (res.fieldErrors?.lost) setLostErr(res.fieldErrors.lost);
        else toast({ title: "Couldn’t change the stage", sub: res.error, tone: "error" });
        return;
      }
      setModal(null);
      const snapshot = res.data!.snapshot;
      const undo = async () => {
        const u = await undoDealStage(deal.id, snapshot);
        if (!u.ok) toast({ title: "Couldn’t undo", sub: u.error, tone: "error" });
      };
      const title = stage === "lost" ? "Moved to Lost" : stage === "won" ? "Marked as Won (PO)" : "Stage changed";
      const sub = stage === "lost" ? `${deal.title} · ${extra?.lostReason}` : stage === "won" ? `${deal.title} · ${money(deal.value)}` : `${res.data!.from} → ${res.data!.to}`;
      toast({ title, sub, undo });
    });
  };

  const pickStage = (k: StageKey) => {
    if (ro || busy || k === deal.stage) return;
    if (k === "lost") {
      setLostReason("");
      setLostNote("");
      setLostErr("");
      setModal("lost");
    } else if (k === "won") setModal("won");
    else runStage(k);
  };

  const confirmLost = () => {
    if (!lostReason) return setLostErr("Pick the main reason.");
    if (lostReason === "Other (specify)" && !lostNote.trim()) return setLostErr("Add a short note for “Other”.");
    runStage("lost", { lostReason, lostNote });
  };

  const kpis: { label: string; value: string; sub: string; title?: string; red?: boolean; small?: boolean }[] = [
    { label: "Value", value: money(deal.value), sub: moneyFull(deal.value), title: moneyFull(deal.value) },
    {
      label: "Probability",
      value: `${deal.probability}%`,
      sub: deal.stage === "won" ? "Set by Won" : deal.stage === "lost" ? "Set by Lost" : `Stage default ${deal.stageDefault}%`,
    },
    { label: "Weighted", value: money(deal.value == null ? null : (deal.value * deal.probability) / 100), sub: "Value × probability" },
    {
      label: "Expected close",
      value: deal.expectedCloseLabel,
      sub: !deal.expectedClose ? "Not set" : deal.closePassed ? "Date has passed" : deal.open ? "On track" : "Closed",
      red: deal.closePassed,
      small: true,
    },
    {
      label: "In stage",
      value: `${deal.days} d`,
      sub: deal.stuck ? "Stuck: over 30 days" : deal.open ? "Under the 30-day limit" : "Closed",
      red: deal.stuck,
    },
    { label: "Solution", value: deal.solution ?? "—", sub: deal.company.need ?? "" },
  ];

  return (
    <div className="flex flex-col gap-5">
      <span className="hidden items-center gap-1.5 text-[13px] text-text-3 md:flex">
        <Link href={deal.isCeo ? "/cockpit" : "/pulse"} className="text-text-2">
          {deal.isCeo ? "Cockpit" : "Team Pulse"}
        </Link>
        <Icon name="chevron-right" size={13} />
        <Link href={`/accounts/${deal.company.id}`} className="text-text-2">
          {deal.company.name}
        </Link>
        <Icon name="chevron-right" size={13} />
        <span className="truncate">{deal.title}</span>
      </span>

      {/* header card */}
      <section className={cn(card, "flex flex-col gap-5 px-4 py-[18px] md:p-6")}>
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex min-w-[260px] flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <Pill hue={st.hue} icon={st.icon} size="lg">
                {st.label}
              </Pill>
              {deal.stuck && (
                <Pill hue="red" icon="hourglass" size="lg">
                  Stuck · {deal.days} d in stage
                </Pill>
              )}
              {deal.closePassed && (
                <Pill hue="red" icon="calendar-x" size="lg">
                  Close date passed
                </Pill>
              )}
              {ro && (
                <span className="inline-flex h-[26px] items-center gap-[5px] rounded-full border border-line-strong px-2.5 text-[12.5px] font-semibold text-text-2">
                  <Icon name="eye" size={13} />
                  Read-only
                </span>
              )}
            </div>
            <h1 className="m-0 font-display text-[23px] leading-[1.15] font-semibold tracking-[-0.02em] md:text-[28px]">{deal.title}</h1>
            <span className="text-sm text-text-2">
              <Link href={`/accounts/${deal.company.id}`} className="font-semibold text-link">
                {deal.company.name}
              </Link>
              {deal.company.line ? ` · ${deal.company.line}` : ""} · owner {deal.owner}
            </span>
          </div>
          {!ro && (
            <div className="flex w-full flex-wrap gap-2.5 md:w-auto">
              <Link
                href={`/log?company=${deal.company.id}&deal=${deal.id}`}
                className="inline-flex h-[46px] flex-1 items-center justify-center gap-2 rounded-full bg-cta pr-[18px] pl-4 text-sm font-bold text-on-cta hover:bg-cta-hover hover:text-on-cta hover:no-underline md:h-10 md:flex-none"
              >
                <Icon name="notebook-pen" size={16} />
                Log a visit
              </Link>
              <button
                type="button"
                onClick={() => setModal("edit")}
                className="inline-flex h-[46px] flex-1 items-center justify-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-sm font-semibold text-ink hover:bg-surface-2 md:h-10 md:flex-none"
              >
                <Icon name="pencil" size={15} />
                Edit deal
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-[14px] border border-line bg-line md:grid-cols-6">
          {kpis.map((k) => (
            <div key={k.label} title={k.title} className="flex min-w-0 flex-col gap-1 bg-surface px-4 py-3.5">
              <span className="text-[11.5px] font-bold tracking-[0.05em] text-text-3 uppercase">{k.label}</span>
              <span
                className={cn("font-display font-semibold whitespace-nowrap tabular-nums", k.small ? "text-[15px] md:text-[17px]" : "text-lg md:text-xl", k.red ? "text-red" : "text-ink")}
              >
                {k.value}
              </span>
              <span className={cn("truncate text-[12.5px]", k.red ? "font-semibold text-red" : "text-text-3")}>{k.sub}</span>
            </div>
          ))}
        </div>

        {deal.stage === "lost" && (
          <div className="flex items-start gap-3 rounded-[14px] bg-red-bg px-4 py-3.5 text-red">
            <Icon name="circle-x" size={18} className="mt-0.5" />
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-bold">Lost · {deal.lostReason ?? "No reason recorded"}</span>
              <span className="text-[13.5px] text-ink">{deal.lostNote || "No extra note added."}</span>
            </div>
          </div>
        )}

        {!ro && (
          <div className="flex flex-col gap-2.5 border-t border-line pt-[18px]">
            <div className="flex flex-wrap items-baseline gap-2.5">
              <span className="text-sm font-bold">Change stage</span>
              <span className="text-[12.5px] text-text-3">Won sets probability to 100%. Lost needs a reason and sets it to 0%.</span>
            </div>
            <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
              {STAGES.map((s, i) => {
                const cur = s.key === deal.stage;
                const past = deal.stage !== "lost" && i < ci && s.key !== "lost";
                return (
                  <button
                    key={s.key}
                    type="button"
                    aria-pressed={cur}
                    disabled={busy}
                    onClick={() => pickStage(s.key)}
                    className={cn(
                      "flex h-12 items-center gap-2 rounded-xl px-3 text-left text-[13.5px] disabled:cursor-wait md:h-11",
                      cur ? cn("border-2 font-bold", hueClass(s.hue)) : "border bg-surface font-medium",
                      !cur && (past ? "text-text-2" : "text-ink"),
                    )}
                    style={{
                      borderColor: cur ? `var(--${s.hue})` : s.key === "lost" ? "color-mix(in srgb, var(--red) 35%, var(--line-strong))" : "var(--line-strong)",
                    }}
                  >
                    <Icon name={past ? "check" : s.icon} size={16} style={{ color: past ? "var(--text-3)" : `var(--${s.hue})` }} />
                    <span className="min-w-0 flex-1 truncate">{s.label}</span>
                    {cur && <span className="text-[11px] font-bold tracking-[0.04em] uppercase">Now</span>}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </section>

      {/* body */}
      <div className="grid items-start gap-6 md:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-6">
          <Proposals deal={deal} ro={ro} addOpen={addOpen} setAddOpen={setAddOpen} />

          <section className={cn(card, "overflow-hidden")}>
            <div className="flex items-center gap-2.5 px-5 pt-4 pb-3">
              <h2 className="m-0 font-display text-[17px] font-semibold">Related visits</h2>
              <span className="text-[13px] text-text-3">{deal.visits.length}</span>
            </div>
            {deal.visits.map((v) => (
              <div key={v.id} className="flex items-start gap-3 border-t border-line px-5 py-3">
                <span className="flex size-[34px] flex-none items-center justify-center rounded-[10px] bg-bg-alt text-text-2">
                  <Icon name={visitTypeIcon(v.type)} size={16} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                  <span className="text-sm font-semibold">
                    {v.type} <span className="font-normal text-text-2">· {v.when}</span>
                  </span>
                  <span className="text-[13px] text-text-2">
                    {v.who}
                    {v.notes ? ` · ${v.notes}` : ""}
                  </span>
                </span>
                {v.hrsLeft != null ? <CountdownPill hrsLeft={v.hrsLeft} /> : <OutcomePill outcome={v.outcome} short />}
              </div>
            ))}
            {deal.visits.length === 0 && (
              <div className="border-t border-line px-5 pt-3.5 pb-[18px] text-sm text-text-2">No visits linked to this deal yet. Pick this deal when you log a visit.</div>
            )}
          </section>
        </div>

        <div className="flex min-w-0 flex-col gap-6">
          <section className={cn(card, "flex flex-col gap-2 px-5 pt-4 pb-[18px]")}>
            <h2 className="m-0 font-display text-[17px] font-semibold">Notes</h2>
            <p className="m-0 text-sm leading-[1.55] whitespace-pre-line text-pretty text-ink">{deal.notes || "No notes yet."}</p>
          </section>
          <section className={cn(card, "overflow-hidden")}>
            <div className="px-5 pt-4 pb-2">
              <h2 className="m-0 font-display text-[17px] font-semibold">Change history</h2>
            </div>
            <div className="flex flex-col px-5 pt-1 pb-3.5">
              {deal.history.map((h, i) => (
                <div key={`${h.id}-${i}`} className="flex gap-3 py-2">
                  <span className="mt-1.5 size-2 flex-none rounded-full" style={{ background: h.recent ? "var(--green-solid)" : "var(--line-strong)" }} />
                  <span className="flex min-w-0 flex-col gap-0.5">
                    <span className="text-[13.5px] break-words">{h.text}</span>
                    <span className="text-[12.5px] text-text-3">{h.meta}</span>
                  </span>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* lost */}
      <Modal open={modal === "lost"} onClose={() => setModal(null)} title="Move to Lost" description={`${deal.title} · ${deal.company.name}`} width={520}>
        <div className="flex flex-col gap-2">
          <span className="text-[13.5px] font-semibold">
            Why was it lost? <span className="text-red">*</span>
          </span>
          <div role="radiogroup" className="flex flex-col gap-1.5">
            {LOST_REASONS.map((r) => {
              const on = lostReason === r;
              return (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setLostReason(r);
                    setLostErr("");
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
          {lostErr && (
            <span className="flex items-center gap-1.5 text-[13px] font-medium text-red">
              <Icon name="circle-alert" size={14} />
              {lostErr}
            </span>
          )}
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13.5px] font-semibold">{lostReason === "Other (specify)" ? "Note (required for Other)" : "Note (optional)"}</span>
          <textarea
            rows={2}
            value={lostNote}
            onChange={(e) => {
              setLostNote(e.target.value);
              setLostErr("");
            }}
            placeholder="e.g. Competitor quoted 12% lower with a 5-year O&M"
            className={cn(
              "wr-field min-h-16 resize-none rounded-xl border bg-input px-3 py-2.5 text-base leading-normal text-ink outline-none md:text-sm",
              lostErr && lostReason === "Other (specify)" ? "border-red" : "border-line-strong",
            )}
          />
        </label>
        <div className="flex gap-2.5">
          <button type="button" onClick={() => setModal(null)} className="h-[50px] flex-1 rounded-full border border-line-strong bg-surface text-[14.5px] font-semibold text-ink md:h-11">
            Cancel
          </button>
          <button
            type="button"
            onClick={confirmLost}
            disabled={busy}
            className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-full border-0 bg-danger text-[14.5px] font-semibold text-white disabled:opacity-60 md:h-11"
          >
            <Icon name={busy ? "loader-circle" : "circle-x"} size={16} className={busy ? "animate-spin" : undefined} />
            Move to Lost
          </button>
        </div>
      </Modal>

      {/* won */}
      <Modal open={modal === "won"} onClose={() => setModal(null)} title="Mark as Won (PO)" description={`${deal.title} · ${deal.company.name}`} width={520}>
        <div className="flex items-start gap-3 rounded-[14px] bg-green-bg px-4 py-3.5">
          <Icon name="trophy" size={20} className="mt-0.5 text-green" />
          <span className="text-sm leading-normal">
            Mark as <b>Won (PO)</b>? Probability becomes 100% and {money(deal.value)} counts as won in the Cockpit.
          </span>
        </div>
        <div className="flex gap-2.5">
          <button type="button" onClick={() => setModal(null)} className="h-[50px] flex-1 rounded-full border border-line-strong bg-surface text-[14.5px] font-semibold text-ink md:h-11">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => runStage("won")}
            disabled={busy}
            className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-full border-0 bg-primary text-[14.5px] font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-60 md:h-11"
          >
            {busy && <Icon name="loader-circle" size={16} className="animate-spin" />}
            Mark as Won
          </button>
        </div>
      </Modal>

      {modal === "edit" && <EditDeal deal={deal} onClose={() => setModal(null)} />}
    </div>
  );
}

function EditDeal({ deal, onClose }: { deal: Deal; onClose: () => void }) {
  const toast = useToast();
  const [busy, startTransition] = useTransition();
  const [title, setTitle] = useState(deal.title);
  const [value, setValue] = useState(deal.value != null ? String(+(deal.value / 1_000_000).toFixed(3)) : "");
  const [prob, setProb] = useState(String(deal.probability));
  const [close, setClose] = useState(deal.expectedClose ?? "");
  const [sol, setSol] = useState(deal.solution ?? "");
  const [notes, setNotes] = useState(deal.notes ?? "");
  const [errs, setErrs] = useState<Record<string, string>>({});
  const closed = !deal.open;

  const save = () =>
    startTransition(async () => {
      const res = await updateDeal({ dealId: deal.id, title, valueMillions: value, probability: prob, expectedClose: close, solutionType: sol || null, notes });
      if (!res.ok) {
        if (res.fieldErrors) setErrs(res.fieldErrors);
        else toast({ title: "Couldn’t save the deal", sub: res.error, tone: "error" });
        return;
      }
      toast({ title: "Deal updated", sub: res.data!.title });
      onClose();
    });

  const err = (k: string) => errs[k] && <span className="text-[12.5px] font-medium text-red">{errs[k]}</span>;

  return (
    <Modal open onClose={onClose} title="Edit deal" description={`${deal.title} · ${deal.company.name}`} width={520}>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="flex flex-col gap-1.5 md:col-span-2">
          <span className="text-[13px] font-semibold">Title</span>
          <span className={cn(fieldBox, errs.title ? "border-red" : "border-line-strong")}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={240} className={fieldInput} />
          </span>
          {err("title")}
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold">Value (millions)</span>
          <span className={cn(fieldBox, errs.value ? "border-red" : "border-line-strong")}>
            <span className={cn(addon, "border-r border-line")}>PKR</span>
            <input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ""))} className={cn(fieldInput, "text-right tabular-nums")} />
            <span className={cn(addon, "border-l border-line")}>M</span>
          </span>
          {err("value")}
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold">Probability</span>
          <span className={cn(fieldBox, errs.probability ? "border-red" : "border-line-strong", closed && "opacity-60")}>
            <input
              inputMode="numeric"
              disabled={closed}
              value={prob}
              onChange={(e) => setProb(String(Math.min(100, Number(e.target.value.replace(/[^\d]/g, "") || 0))))}
              className={cn(fieldInput, "text-right tabular-nums")}
            />
            <span className={cn(addon, "border-l border-line")}>%</span>
          </span>
          {closed ? <span className="text-[12.5px] text-text-3">Set by {stageOf(deal.stage).label}.</span> : err("probability")}
        </label>
        <label className="flex flex-col gap-1.5 md:col-span-2">
          <span className="text-[13px] font-semibold">Expected close</span>
          <span className={cn(fieldBox, "gap-2 pl-3", errs.expectedClose ? "border-red" : "border-line-strong")}>
            <Icon name="calendar-days" size={17} className="text-text-3" />
            <input type="date" value={close} onChange={(e) => setClose(e.target.value)} className={cn(fieldInput, "pl-0")} />
          </span>
          {err("expectedClose")}
        </label>
      </div>
      <div className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold">Solution type</span>
        <div className="flex flex-wrap gap-1.5">
          {SOLUTION_TYPES.map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={sol === s}
              onClick={() => setSol(sol === s ? "" : s)}
              className={cn(
                "h-10 min-w-12 rounded-[10px] border px-2.5 text-[13px] font-bold md:h-[34px]",
                sol === s ? "border-primary bg-brand-soft text-green" : "border-line-strong bg-surface text-ink",
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
      <label className="flex flex-col gap-1.5">
        <span className="text-[13px] font-semibold">Notes</span>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="wr-field min-h-[72px] resize-y rounded-xl border border-line-strong bg-input px-3 py-2.5 text-base leading-normal text-ink outline-none md:text-sm"
        />
      </label>
      <div className="flex gap-2.5">
        <button type="button" onClick={onClose} className="h-[50px] flex-1 rounded-full border border-line-strong bg-surface text-[14.5px] font-semibold text-ink md:h-11">
          Cancel
        </button>
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="flex h-[50px] flex-1 items-center justify-center gap-2 rounded-full border-0 bg-primary text-[14.5px] font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-60 md:h-11"
        >
          {busy && <Icon name="loader-circle" size={16} className="animate-spin" />}
          Save changes
        </button>
      </div>
    </Modal>
  );
}

function Proposals({ deal, ro, addOpen, setAddOpen }: { deal: Deal; ro: boolean; addOpen: boolean; setAddOpen: (v: boolean) => void }) {
  const toast = useToast();
  const [busy, startTransition] = useTransition();
  const [ref, setRef] = useState(deal.nextRef);
  const [date, setDate] = useState(deal.today);
  const [amount, setAmount] = useState("");
  const [errs, setErrs] = useState<Record<string, string>>({});
  const amt = amount ? Number(amount) : 0;

  const open = () => {
    setRef(deal.nextRef);
    setDate(deal.today);
    setAmount("");
    setErrs({});
    setAddOpen(true);
  };

  const save = () => {
    if (!amt) return setErrs({ amount: "Enter the proposal amount." });
    startTransition(async () => {
      const res = await addProposal({ dealId: deal.id, reference: ref, submittedOn: date, amount });
      if (!res.ok) {
        if (res.fieldErrors) setErrs(res.fieldErrors);
        else toast({ title: "Couldn’t add the proposal", sub: res.error, tone: "error" });
        return;
      }
      setAddOpen(false);
      toast({ title: "Proposal added", sub: `${res.data!.reference} · ${money(res.data!.amount)}` });
    });
  };

  const changeStatus = (id: number, status: string) =>
    startTransition(async () => {
      const res = await setProposalStatus(id, status);
      if (!res.ok) toast({ title: "Couldn’t update the proposal", sub: res.error, tone: "error" });
      else toast({ title: "Proposal updated", sub: `${res.data!.reference} · ${status}` });
    });

  return (
    <section className={cn(card, "overflow-hidden")}>
      <div className="flex items-center gap-2.5 pt-4 pr-4 pb-3 pl-5">
        <h2 className="m-0 font-display text-[17px] font-semibold">Proposals</h2>
        <span className="text-[13px] text-text-3">{deal.proposals.length}</span>
        {!ro && (
          <button
            type="button"
            onClick={open}
            className="ml-auto inline-flex h-11 items-center gap-1.5 rounded-full border-0 bg-transparent px-3 text-[13.5px] font-semibold text-link hover:bg-surface-2 md:h-[34px]"
          >
            <Icon name="plus" size={15} />
            Add proposal
          </button>
        )}
      </div>
      {deal.proposals.map((p) => {
        const s = proposalStatusOf(p.status);
        return (
          <div key={p.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-line px-5 py-3 md:grid-cols-[minmax(0,1fr)_120px_140px]">
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate font-mono text-[13.5px] font-semibold">{p.reference}</span>
              <span className="text-[12.5px] text-text-3">Submitted {p.submitted}</span>
            </span>
            <span title={moneyFull(p.amount)} className="text-right text-sm font-semibold tabular-nums">
              {money(p.amount)}
            </span>
            {ro ? (
              <span className="col-span-full md:col-span-1 md:justify-self-end">
                <Pill hue={s.hue} icon={s.icon}>
                  {s.key}
                </Pill>
              </span>
            ) : (
              <span className="relative inline-flex justify-self-start max-md:col-span-full md:justify-self-end">
                <select
                  aria-label="Update proposal status"
                  value={p.status}
                  disabled={busy}
                  onChange={(e) => changeStatus(p.id, e.target.value)}
                  className={cn("h-9 cursor-pointer appearance-none rounded-full border border-transparent pr-[30px] pl-3 text-[13px] font-bold outline-none md:h-[30px]", hueClass(s.hue))}
                >
                  {PROPOSAL_STATUSES.map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.key}
                    </option>
                  ))}
                </select>
                <Icon name="chevron-down" size={13} className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2" style={{ color: `var(--${s.hue})` }} />
              </span>
            )}
            {p.notes && <span className="col-span-full -mt-1 text-[13px] text-text-2">{p.notes}</span>}
          </div>
        );
      })}
      {deal.proposals.length === 0 && !addOpen && <div className="border-t border-line px-5 pt-3.5 pb-[18px] text-sm text-text-2">No proposals submitted yet.</div>}
      {addOpen && !ro && (
        <div className="flex flex-col gap-3.5 border-t border-line bg-surface-2 px-5 pt-4 pb-5">
          <span className="text-sm font-bold">New proposal</span>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold">Reference</span>
              <span className={cn(fieldBox, errs.reference ? "border-red" : "border-line-strong")}>
                <input value={ref} onChange={(e) => setRef(e.target.value)} maxLength={80} className={cn(fieldInput, "font-mono font-medium")} />
              </span>
              {errs.reference && <span className="text-[12.5px] text-red">{errs.reference}</span>}
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold">Submitted</span>
              <span className={cn(fieldBox, errs.submittedOn ? "border-red" : "border-line-strong")}>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={fieldInput} />
              </span>
              {errs.submittedOn && <span className="text-[12.5px] text-red">{errs.submittedOn}</span>}
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold">
                Amount <span className="text-red">*</span>
              </span>
              <span className={cn(fieldBox, errs.amount ? "border-red" : "border-line-strong")}>
                <span className={cn(addon, "border-r border-line")}>PKR</span>
                <input
                  inputMode="numeric"
                  placeholder="0"
                  value={amount ? Number(amount).toLocaleString("en-US") : ""}
                  onChange={(e) => {
                    setAmount(e.target.value.replace(/[^\d]/g, "").slice(0, 13));
                    setErrs((x) => ({ ...x, amount: "" }));
                  }}
                  className={cn(fieldInput, "px-2.5 text-right tabular-nums")}
                />
              </span>
              <span className={cn("text-[12.5px]", errs.amount ? "text-red" : "text-text-3")}>{errs.amount || (amt ? `= ${money(amt)}` : "Full amount in rupees")}</span>
            </label>
          </div>
          <div className="flex justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setAddOpen(false)}
              className="h-[46px] flex-1 rounded-full border border-line-strong bg-surface px-4 text-sm font-semibold text-ink md:h-10 md:flex-none"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy}
              className="inline-flex h-[46px] flex-1 items-center justify-center gap-2 rounded-full border-0 bg-primary px-[18px] text-sm font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-60 md:h-10 md:flex-none"
            >
              {busy && <Icon name="loader-circle" size={15} className="animate-spin" />}
              Add proposal
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
