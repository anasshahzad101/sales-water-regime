"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { createDeal, type NewDealState } from "@/app/actions/deals";
import { CompanyPicker, type CompanyOption } from "@/components/ui/company-picker";
import { Icon } from "@/components/ui/icon";
import { FieldError } from "@/components/ui/kit";
import { useToast } from "@/components/ui/toast";
import { OPEN_STAGES, SOLUTION_TYPES, stageOf } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { money } from "@/lib/format";

const input = "wr-field h-12 w-full min-w-0 rounded-xl border bg-input px-3 text-base text-ink outline-none md:h-11 md:text-[14.5px]";
const chipOn = "border-primary bg-brand-soft text-green";
const chipOff = "border-line-strong bg-surface text-ink";

export function NewDealForm({ companies, from }: { companies: CompanyOption[]; from: { id: number; name: string } | null }) {
  const [state, action, pending] = useActionState<NewDealState, FormData>(createDeal, {});
  const [companyId, setCompanyId] = useState<number | null>(from?.id ?? null);
  const [stage, setStage] = useState<string>("lead");
  const [sol, setSol] = useState<string>("");
  const [value, setValue] = useState("");
  const [prob, setProb] = useState("10");
  const [title, setTitle] = useState("");
  const [close, setClose] = useState("");
  const [notes, setNotes] = useState("");
  const [probTouched, setProbTouched] = useState(false);
  const [local, setLocal] = useState<Record<string, string>>({});
  const router = useRouter();
  const toast = useToast();

  useEffect(() => {
    if (state.ok && state.id) {
      toast({ title: "Deal created", sub: `${state.title} · ${state.company}` });
      router.push(`/deals/${state.id}`);
    }
  }, [state, router, toast]);

  const n = value ? Number(value) : 0;
  const p = Number(prob) || 0;
  const back = from ? `/accounts/${from.id}` : "/pulse";
  // Client checks win; a key set to "" means the user has since fixed that field.
  const err = (k: string) => (k in local ? local[k] : state.fieldErrors?.[k]);

  return (
    <div className="flex flex-col gap-5">
      <div className="hidden flex-col gap-1.5 md:flex">
        <span className="flex items-center gap-1.5 text-[13px] text-text-3">
          <Link href={back} className="text-text-2">
            {from ? from.name : "Team Pulse"}
          </Link>
          <Icon name="chevron-right" size={13} />
          New deal
        </span>
        <h1 className="m-0 font-display text-[28px] font-semibold tracking-[-0.02em]">New deal</h1>
        <p className="m-0 text-[14.5px] text-text-2">You&apos;ll be the owner. You can change the stage later from the deal page.</p>
      </div>

      <form
        action={action}
        noValidate
        onSubmit={(e) => {
          const errs: Record<string, string> = {};
          if (!companyId) errs.companyId = "Choose a company.";
          if (!title.trim()) errs.title = "Give the deal a short title.";
          if (Object.keys(errs).length) e.preventDefault();
          setLocal(errs);
        }}
        className="flex flex-col gap-5 rounded-[18px] border border-line bg-surface px-4 py-[18px] shadow-[var(--shadow-sm)] md:p-7"
      >
        {state.error && !state.fieldErrors && <FieldError>{state.error}</FieldError>}

        <div className="flex flex-col gap-1.5">
          <span className="text-[13.5px] font-semibold">
            Company <span className="text-red">*</span>
          </span>
          <CompanyPicker
            companies={companies}
            value={companyId}
            onChange={(id) => {
              setCompanyId(id);
              setLocal((l) => ({ ...l, companyId: "" }));
            }}
            error={!!err("companyId")}
          />
          <span className={cn("text-[12.5px]", err("companyId") ? "font-medium text-red" : "text-text-3")}>
            {err("companyId") || (from ? "Pre-filled from the account you came from." : "Type to filter by company, brand, plant or city.")}
          </span>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13.5px] font-semibold">
            Deal title <span className="text-red">*</span>
          </span>
          <input
            name="title"
            maxLength={240}
            placeholder="e.g. ETP expansion, Plant 2"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              if (err("title")) setLocal((l) => ({ ...l, title: "" }));
            }}
            className={cn(input, err("title") ? "border-red" : "border-line-strong")}
          />
          {err("title") && <span className="text-[13px] font-medium text-red">{err("title")}</span>}
        </label>

        <div className="flex flex-col gap-2">
          <span className="text-[13.5px] font-semibold">Stage</span>
          <input type="hidden" name="stage" value={stage} />
          <div className="flex flex-wrap gap-2">
            {OPEN_STAGES.map((k) => {
              const st = stageOf(k);
              const on = stage === k;
              return (
                <button
                  key={k}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setStage(k);
                    if (!probTouched) setProb(String(st.p));
                  }}
                  className={cn("inline-flex h-11 items-center gap-1.5 rounded-full border pr-3.5 pl-3 text-[13.5px] font-semibold md:h-[38px]", on ? chipOn : chipOff)}
                >
                  <Icon name={st.icon} size={14} style={{ color: `var(--${st.hue})` }} />
                  {st.label}
                </button>
              );
            })}
          </div>
          <span className="text-[12.5px] text-text-3">New deals usually start at Lead. To record Won or Lost, use the deal page.</span>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[13.5px] font-semibold">Solution type</span>
          <input type="hidden" name="solutionType" value={sol} />
          <div className="flex flex-wrap gap-2">
            {SOLUTION_TYPES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={sol === s}
                onClick={() => setSol(sol === s ? "" : s)}
                className={cn("h-11 min-w-14 rounded-xl border px-3.5 text-[13.5px] font-bold md:h-[38px]", sol === s ? chipOn : chipOff)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13.5px] font-semibold">Value</span>
            <span className={cn("wr-field flex h-12 items-center overflow-hidden rounded-xl border bg-input md:h-11", err("valuePkr") ? "border-red" : "border-line-strong")}>
              <span className="flex h-full items-center border-r border-line bg-bg-alt px-3 text-[13px] font-bold text-text-2">PKR</span>
              <input
                inputMode="numeric"
                placeholder="0"
                value={value ? Number(value).toLocaleString("en-US") : ""}
                onChange={(e) => setValue(e.target.value.replace(/[^\d]/g, "").slice(0, 13))}
                className="h-full min-w-0 flex-1 border-0 bg-transparent px-3 text-right text-base text-ink tabular-nums outline-none md:text-[14.5px]"
              />
              <input type="hidden" name="valuePkr" value={value} />
            </span>
            <span className={cn("text-[12.5px]", err("valuePkr") ? "text-red" : "text-text-3")}>
              {err("valuePkr") || (n ? `= ${money(n)}` : "Full amount in rupees, e.g. 86,500,000")}
            </span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13.5px] font-semibold">Probability</span>
            <span className={cn("wr-field flex h-12 items-center overflow-hidden rounded-xl border bg-input md:h-11", err("probability") ? "border-red" : "border-line-strong")}>
              <input
                name="probability"
                inputMode="numeric"
                value={prob}
                onChange={(e) => {
                  setProb(String(Math.min(100, Number(e.target.value.replace(/[^\d]/g, "") || 0))));
                  setProbTouched(true);
                }}
                className="h-full min-w-0 flex-1 border-0 bg-transparent px-3 text-right text-base text-ink tabular-nums outline-none md:text-[14.5px]"
              />
              <span className="flex h-full items-center border-l border-line bg-bg-alt px-3 text-[13px] font-bold text-text-2">%</span>
            </span>
            <span className={cn("text-[12.5px]", err("probability") ? "text-red" : "text-text-3")}>
              {err("probability") || (n ? `Weighted: ${money((n * p) / 100)}` : "Defaults from the stage; change it if you know better.")}
            </span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13.5px] font-semibold">Expected close</span>
            <span className={cn("wr-field flex h-12 items-center gap-2 rounded-xl border bg-input px-3 md:h-11", err("expectedClose") ? "border-red" : "border-line-strong")}>
              <Icon name="calendar-days" size={17} className="text-text-3" />
              <input name="expectedClose" type="date" value={close} onChange={(e) => setClose(e.target.value)} className="h-full min-w-0 flex-1 border-0 bg-transparent text-base text-ink outline-none md:text-[14.5px]" />
            </span>
            {err("expectedClose") && <span className="text-[12.5px] text-red">{err("expectedClose")}</span>}
          </label>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13.5px] font-semibold">Notes</span>
          <textarea
            name="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Scope, competitors, decision makers"
            className="wr-field min-h-[84px] resize-y rounded-xl border border-line-strong bg-input p-3 text-base leading-normal text-ink outline-none md:text-[14.5px]"
          />
        </label>

        <div className="flex justify-end gap-2.5 border-t border-line pt-[18px]">
          <Link
            href={back}
            className="inline-flex h-[50px] flex-1 items-center justify-center rounded-full border border-line-strong bg-surface px-[18px] text-sm font-semibold text-ink hover:bg-surface-2 hover:text-ink hover:no-underline md:h-[42px] md:flex-none"
          >
            Cancel
          </Link>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-[50px] flex-1 items-center justify-center gap-2 rounded-full border-0 bg-primary px-[22px] text-sm font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-60 md:h-[42px] md:flex-none"
          >
            <Icon name={pending ? "loader-circle" : "check"} size={16} className={pending ? "animate-spin" : undefined} />
            Create deal
          </button>
        </div>
      </form>
    </div>
  );
}
