"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { createVisit, deleteRecentVisit, getCompanyVisitContext } from "@/app/actions/visits";
import { CompanyPicker, type CompanyOption } from "@/components/ui/company-picker";
import { Icon } from "@/components/ui/icon";
import { DateTimeInput, DealPicker, type DealOption } from "@/components/ui/inputs";
import { FieldError, fieldClass, textareaClass } from "@/components/ui/kit";
import { hueClass } from "@/components/ui/pills";
import { useToast } from "@/components/ui/toast";
import { LATE_REASON_MIN, OUTCOMES, OUTCOME_GRACE_HOURS, SKIP_REASONS, VISIT_TYPES, outcomeOf } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { parsePktLocal } from "@/lib/time";

type Contact = { id: number; name: string; title: string | null };
type Errors = Partial<Record<"companyId" | "visitType" | "visitAt" | "outcome" | "skipReason" | "lateReason" | "nextActionDate", string>>;

const ERROR_ORDER: (keyof Errors)[] = ["companyId", "visitType", "visitAt", "outcome", "skipReason", "lateReason", "nextActionDate"];

export function LogForm({
  companies,
  initialCompanyId,
  initialDealId,
  initialContext,
  fromAccount,
  nowValue,
}: {
  companies: CompanyOption[];
  initialCompanyId: number | null;
  initialDealId: number | null;
  initialContext: { companyId: number; deals: DealOption[]; contacts: Contact[] } | null;
  fromAccount: { id: number; name: string } | null;
  nowValue: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [companyId, setCompanyId] = useState<number | null>(initialCompanyId);
  const [ctx, setCtx] = useState<{ companyId: number; deals: DealOption[]; contacts: Contact[] } | null>(initialContext);
  const deals = ctx && ctx.companyId === companyId ? ctx.deals : [];
  const contacts = ctx && ctx.companyId === companyId ? ctx.contacts : [];
  const [dealId, setDealId] = useState<number | null>(initialDealId);
  const [visitType, setVisitType] = useState("Visit");
  const [contact, setContact] = useState("");
  const [contactOther, setContactOther] = useState("");
  const [discussion, setDiscussion] = useState("");
  const [outcome, setOutcome] = useState("pending");
  const [skip, setSkip] = useState("");
  const [late, setLate] = useState("");
  const [next, setNext] = useState("");
  const [nextDate, setNextDate] = useState("");
  const [visitAt, setVisitAt] = useState(nowValue);
  const [errors, setErrors] = useState<Errors>({});
  const [saving, startSaving] = useTransition();
  const company = companyId ? companies.find((c) => c.id === companyId) : undefined;

  useEffect(() => {
    if (!companyId || ctx?.companyId === companyId) return;
    let live = true;
    getCompanyVisitContext(companyId).then((res) => {
      if (!live) return;
      setCtx({ companyId, ...res });
      setDealId((d) => (d && res.deals.some((x) => x.id === d) ? d : null));
    });
    return () => {
      live = false;
    };
  }, [companyId, ctx?.companyId]);

  const at = parsePktLocal(visitAt);
  // Compared with the time the page was opened (good enough for a form that is filled in minutes).
  const pageOpenedAt = parsePktLocal(nowValue);
  const isOld = !!at && !!pageOpenedAt && pageOpenedAt.getTime() - at.getTime() > OUTCOME_GRACE_HOURS * 3600_000;
  const needsLate = isOld && outcome !== "pending";

  const validate = (): Errors => {
    const e: Errors = {};
    if (!companyId) e.companyId = "Choose the company you visited.";
    if (outcome === "skipped" && !skip) e.skipReason = "Choose why this visit was skipped.";
    if (isOld && outcome === "pending") e.outcome = "This visit is more than 48 hours old — set the outcome now.";
    if (needsLate && late.trim().length < LATE_REASON_MIN) e.lateReason = `Say why this is being logged late (at least ${LATE_REASON_MIN} characters).`;
    if (nextDate && !next.trim()) e.nextActionDate = "Add the next action, or clear the date.";
    return e;
  };

  const save = () => {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) {
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const contactMet = contact === "other" ? contactOther : (contacts.find((c) => String(c.id) === contact)?.name ?? "");
    startSaving(async () => {
      const res = await createVisit({
        companyId,
        dealId,
        visitType,
        visitAt,
        contactMet,
        discussion,
        outcome,
        skipReason: skip,
        lateReason: late,
        nextAction: next,
        nextActionDate: nextDate,
      });
      if (!res.ok) {
        if (res.fieldErrors) {
          setErrors(res.fieldErrors as Errors);
          window.scrollTo({ top: 0, behavior: "smooth" });
        } else toast({ title: "Couldn’t save the visit", sub: res.error, tone: "error" });
        return;
      }
      const d = res.data!;
      toast({
        title: "Visit logged",
        sub: outcome === "pending" ? `${visitType} · ${d.company} · outcome due by ${d.dueBy}` : `${visitType} · ${d.company} · ${outcomeOf(outcome).label}`,
        undo: async () => {
          const u = await deleteRecentVisit(d.visitId);
          if (!u.ok) toast({ title: "Couldn’t undo", sub: u.error, tone: "error" });
        },
      });
      router.push(fromAccount ? `/accounts/${fromAccount.id}` : "/my-week");
    });
  };

  const errList = ERROR_ORDER.map((k) => errors[k]).filter(Boolean) as string[];
  const chip = (on: boolean) => (on ? "border-primary bg-brand-soft text-green font-semibold" : "border-line-strong bg-surface text-ink font-medium");
  const cancelHref = fromAccount ? `/accounts/${fromAccount.id}` : "/my-week";

  return (
    <div className="flex flex-col gap-5">
      <div className="hidden flex-col gap-1.5 md:flex">
        {fromAccount && (
          <span className="flex items-center gap-1.5 text-[13px] text-text-3">
            <Link href="/accounts" className="text-text-2">
              Accounts
            </Link>
            <Icon name="chevron-right" size={13} />
            <Link href={`/accounts/${fromAccount.id}`} className="text-text-2">
              {fromAccount.name}
            </Link>
            <Icon name="chevron-right" size={13} />
            Log a visit
          </span>
        )}
        <h1 className="m-0 font-display text-[28px] font-semibold tracking-[-0.02em]">Log a visit</h1>
        <p className="m-0 text-[14.5px] text-text-2">Record what happened. Calls, emails and meetings count too.</p>
      </div>

      {errList.length > 0 && (
        <div role="alert" className="flex items-start gap-3 rounded-[14px] bg-red-bg px-4 py-3.5 text-red">
          <Icon name="circle-alert" size={18} className="mt-0.5" />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-bold">Fix {errList.length === 1 ? "1 thing" : `${errList.length} things`} before saving</span>
            {errList.map((m) => (
              <span key={m} className="text-[13.5px] text-ink">
                · {m}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-[22px] rounded-[18px] border border-line bg-surface px-4 py-[18px] shadow-[var(--shadow-sm)] md:p-7">
        {/* company */}
        <div className="flex flex-col gap-2">
          <span className="text-[13.5px] font-semibold">
            Company <span className="text-red">*</span>
          </span>
          {company ? (
            <div className="flex items-center gap-3 rounded-[14px] border border-line-strong bg-surface-2 py-3 pr-2 pl-3.5">
              <span className="flex size-[38px] flex-none items-center justify-center rounded-xl bg-brand-soft text-green">
                <Icon name="factory" size={18} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-semibold">{company.name}</span>
                {company.sub && <span className="text-[13px] text-text-2">{company.sub}</span>}
              </span>
              <button
                type="button"
                onClick={() => {
                  setCompanyId(null);
                  setDealId(null);
                  setContact("");
                }}
                className="h-11 rounded-full border-0 bg-transparent px-3 text-sm font-semibold text-link hover:bg-surface"
              >
                Change
              </button>
            </div>
          ) : (
            <CompanyPicker
              companies={companies}
              value={null}
              autoFocus={!initialCompanyId}
              error={!!errors.companyId}
              onChange={(id) => {
                setCompanyId(id);
                setErrors((e) => ({ ...e, companyId: undefined }));
              }}
            />
          )}
          {errors.companyId && <FieldError>{errors.companyId}</FieldError>}
        </div>

        {/* deal */}
        {company && (
          <div className="flex flex-col gap-2">
            <span className="text-[13.5px] font-semibold">
              Deal <span className="font-normal text-text-3">· optional</span>
            </span>
            {ctx?.companyId === companyId ? (
              <DealPicker deals={deals} value={dealId} onChange={setDealId} companyChosen />
            ) : (
              <span className="flex h-[50px] items-center gap-2 rounded-[14px] border border-line px-3 text-sm text-text-3">
                <Icon name="loader-circle" size={16} className="animate-spin" />
                Loading open deals…
              </span>
            )}
          </div>
        )}

        {/* visit type */}
        <div className="flex flex-col gap-2">
          <span className="text-[13.5px] font-semibold">Visit type</span>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-6">
            {VISIT_TYPES.map((t) => (
              <button
                key={t.key}
                type="button"
                aria-pressed={visitType === t.key}
                onClick={() => setVisitType(t.key)}
                className={cn("flex h-11 items-center gap-2 rounded-xl border px-3 text-left text-sm md:h-[38px]", chip(visitType === t.key))}
              >
                <Icon name={t.icon} size={16} />
                <span className="truncate">{t.key}</span>
              </button>
            ))}
          </div>
        </div>

        {/* date + contact */}
        <div className="grid grid-cols-1 gap-[18px] md:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-[13.5px] font-semibold">Date &amp; time</span>
            <DateTimeInput name="visitAt" defaultValue={nowValue} error={!!errors.visitAt} onValueChange={setVisitAt} />
            {errors.visitAt ? <FieldError>{errors.visitAt}</FieldError> : <span className="text-[12.5px] text-text-3">Defaults to now, Pakistan time.</span>}
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-[13.5px] font-semibold">Contact met</span>
            <span className="relative flex">
              <select value={contact} onChange={(e) => setContact(e.target.value)} className={cn(fieldClass, "appearance-none pr-10")} disabled={!company}>
                <option value="">{company ? "Choose a contact" : "Choose a company first"}</option>
                {contacts.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                    {c.title ? ` — ${c.title}` : ""}
                  </option>
                ))}
                <option value="other">Someone not listed</option>
              </select>
              <Icon name="chevron-down" size={16} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-text-3" />
            </span>
            {contact === "other" && <input value={contactOther} onChange={(e) => setContactOther(e.target.value)} placeholder="Name and role" className={fieldClass} maxLength={240} />}
          </div>
        </div>

        {/* discussion */}
        <label className="flex flex-col gap-1.5">
          <span className="text-[13.5px] font-semibold">Discussion</span>
          <textarea
            rows={4}
            value={discussion}
            onChange={(e) => setDiscussion(e.target.value)}
            placeholder="What was discussed, who else was there, anything technical worth remembering"
            className={cn(textareaClass, "min-h-[104px] resize-y")}
            maxLength={4000}
          />
        </label>

        {/* outcome */}
        <div className="flex flex-col gap-2.5">
          <span className="text-[13.5px] font-semibold">
            Outcome <span className="text-red">*</span>
          </span>
          <div className="flex flex-wrap gap-2">
            {OUTCOMES.map((o) => {
              const on = outcome === o.key;
              return (
                <button
                  key={o.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setOutcome(o.key);
                    setErrors((e) => ({ ...e, outcome: undefined, skipReason: undefined }));
                  }}
                  className={cn(
                    "inline-flex h-11 items-center gap-[7px] rounded-full border pr-3.5 pl-3 text-sm md:h-[38px]",
                    on ? cn(hueClass(o.hue), "border-current font-bold") : "border-line-strong bg-surface font-medium text-ink",
                  )}
                >
                  <Icon name={o.icon} size={15} style={{ color: `var(--${o.hue})` }} />
                  {o.key === "skipped" ? "Skipped" : o.label}
                </button>
              );
            })}
          </div>
          {errors.outcome && <FieldError>{errors.outcome}</FieldError>}
          <div className="flex items-start gap-2.5 rounded-xl bg-aqua-bg px-3.5 py-3 text-[13.5px] leading-normal text-ink">
            <Icon name="timer" size={16} className="mt-0.5 text-aqua" />
            <span>
              <b>Not sure yet? Leave it as Pending.</b> You have 48 hours to set the outcome from My Week. After that the visit is overdue and you&apos;ll need to give a late reason.
            </span>
          </div>
          {outcome === "skipped" && (
            <div className="flex flex-col gap-2 pt-1">
              <span className="text-[13.5px] font-semibold">
                Skip reason <span className="text-red">*</span>
              </span>
              <div className="flex flex-wrap gap-2">
                {SKIP_REASONS.map((r) => (
                  <button
                    key={r}
                    type="button"
                    aria-pressed={skip === r}
                    onClick={() => {
                      setSkip(r);
                      setErrors((e) => ({ ...e, skipReason: undefined }));
                    }}
                    className={cn("inline-flex h-11 items-center gap-1.5 rounded-full border pr-3 pl-2.5 text-[13.5px] md:h-[38px]", chip(skip === r))}
                  >
                    <Icon name={skip === r ? "circle-check" : "circle"} size={14} />
                    {r}
                  </button>
                ))}
              </div>
              {errors.skipReason && <FieldError>{errors.skipReason}</FieldError>}
            </div>
          )}
          {needsLate && (
            <label className="flex flex-col gap-1.5 pt-1">
              <span className="text-[13.5px] font-semibold">
                Why is this being logged late? <span className="text-red">*</span>
              </span>
              <textarea
                rows={3}
                value={late}
                onChange={(e) => {
                  setLate(e.target.value);
                  setErrors((x) => ({ ...x, lateReason: undefined }));
                }}
                placeholder="e.g. Was travelling between sites with no network"
                className={cn(textareaClass, "min-h-[84px] resize-y", errors.lateReason && "border-red")}
              />
              {errors.lateReason ? (
                <FieldError>{errors.lateReason}</FieldError>
              ) : (
                <span className="text-[12.5px] text-text-3">This visit is more than 48 hours ago. The reason is saved with the visit and visible to your manager.</span>
              )}
            </label>
          )}
        </div>

        {/* next action */}
        <div className="grid grid-cols-1 gap-[18px] border-t border-line pt-[18px] md:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13.5px] font-semibold">Next action</span>
            <input
              value={next}
              onChange={(e) => {
                setNext(e.target.value);
                setErrors((x) => ({ ...x, nextActionDate: undefined }));
              }}
              placeholder="e.g. Send revised ETP proposal"
              className={fieldClass}
              maxLength={240}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[13.5px] font-semibold">Next action date</span>
            <span className={cn("wr-field flex h-12 items-center gap-2 rounded-xl border bg-input px-3 md:h-11", errors.nextActionDate ? "border-red" : "border-line-strong")}>
              <Icon name="calendar-days" size={17} className="text-text-3" />
              <input type="date" value={nextDate} onChange={(e) => setNextDate(e.target.value)} className="h-full min-w-0 flex-1 border-0 bg-transparent text-base text-ink outline-none md:text-[14.5px]" />
            </span>
            {errors.nextActionDate ? (
              <FieldError>{errors.nextActionDate}</FieldError>
            ) : (
              <span className="text-[12.5px] text-text-3">{next ? "Leave empty for a week from today." : "Shows up in Due this week."}</span>
            )}
          </label>
        </div>

        {/* desktop actions */}
        <div className="hidden items-center justify-end gap-2.5 border-t border-line pt-[18px] md:flex">
          <span className="mr-auto text-[12.5px] text-text-3">Saved to the account timeline and the audit log.</span>
          <Link href={cancelHref} className="inline-flex h-[42px] items-center rounded-full border border-line-strong bg-surface px-[18px] text-sm font-semibold text-ink hover:bg-surface-2 hover:text-ink hover:no-underline">
            Cancel
          </Link>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex h-[42px] items-center gap-2 rounded-full border-0 bg-primary px-[22px] text-sm font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-70"
          >
            <Icon name={saving ? "loader-circle" : "check"} size={16} className={saving ? "animate-spin" : undefined} />
            {saving ? "Saving…" : "Save visit"}
          </button>
        </div>
      </div>

      {/* phone sticky save */}
      <div className="sticky bottom-[calc(86px+env(safe-area-inset-bottom))] z-10 -mx-4 flex gap-2.5 border-t border-line bg-surface px-4 pt-3 pb-4 md:hidden">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex h-[52px] flex-1 items-center justify-center gap-2 rounded-full border-0 bg-primary text-base font-semibold text-on-primary disabled:opacity-70"
        >
          {saving && <Icon name="loader-circle" size={18} className="animate-spin" />}
          {saving ? "Saving…" : "Save visit"}
        </button>
      </div>
    </div>
  );
}
