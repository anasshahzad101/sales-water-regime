"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { checkDuplicateCompanies, createCompany, type CreateCompanyState } from "@/app/actions/accounts";
import { Icon } from "@/components/ui/icon";
import { FieldError } from "@/components/ui/kit";
import { useToast } from "@/components/ui/toast";
import { LEAD_SOURCES, PRIORITIES } from "@/lib/constants";
import { cn } from "@/lib/cn";

type Options = {
  sectors: { id: number; name: string }[];
  subSectors: { id: number; name: string; sectorId: number }[];
  cities: { id: number; name: string }[];
};
type Dupe = { id: number; name: string; sub: string };

const input =
  "wr-field h-12 w-full min-w-0 rounded-xl border bg-input px-3 text-base text-ink outline-none placeholder:text-text-3 md:h-11 md:text-[14.5px]";
const label = "text-[13.5px] font-semibold";
const PRI_ICON: Record<string, string> = { P1: "signal-high", P2: "signal-medium", P3: "signal-low" };

export function AddCompanyForm({ options }: { options: Options }) {
  const [state, action, pending] = useActionState<CreateCompanyState, FormData>(createCompany, {});
  const [name, setName] = useState("");
  const [nameErr, setNameErr] = useState("");
  const [sector, setSector] = useState("");
  const [sub, setSub] = useState("");
  const [priority, setPriority] = useState("P2");
  const [source, setSource] = useState<string>("Target");
  const [dupes, setDupes] = useState<Dupe[]>([]);
  const router = useRouter();
  const toast = useToast();
  const fe = state.fieldErrors ?? {};

  useEffect(() => {
    const term = name.trim();
    if (term.length < 4) return;
    let live = true;
    const t = setTimeout(async () => {
      const hits = await checkDuplicateCompanies(term);
      if (live) setDupes(hits);
    }, 300);
    return () => {
      live = false;
      clearTimeout(t);
    };
  }, [name]);

  useEffect(() => {
    if (state.ok && state.id) {
      toast({ title: "Company added", sub: `${state.name} · owner: you` });
      router.push(`/accounts/${state.id}`);
    } else if (state.error && !state.fieldErrors) {
      toast({ title: "Couldn’t add the company", sub: state.error, tone: "error" });
    }
  }, [state, router, toast]);

  const shownDupes = name.trim().length >= 4 ? dupes : [];
  const subs = options.subSectors.filter((s) => String(s.sectorId) === sector);
  const sectorName = options.sectors.find((s) => String(s.id) === sector)?.name;
  const shownNameErr = nameErr || fe.name;
  const chip = (on: boolean) => (on ? "border-primary bg-brand-soft text-green" : "border-line-strong bg-surface text-ink");

  return (
    <form
      action={action}
      noValidate
      onSubmit={(e) => {
        if (!name.trim()) {
          e.preventDefault();
          setNameErr("Enter the company name.");
        }
      }}
      className="flex flex-col gap-5 rounded-[18px] border border-line bg-surface px-4 py-[18px] shadow-[var(--shadow-sm)] md:p-7"
    >
      <label className="flex flex-col gap-1.5">
        <span className={label}>
          Company name <span className="text-red">*</span>
        </span>
        <input
          name="name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setNameErr("");
          }}
          placeholder="Legal or trading name"
          autoComplete="off"
          className={cn(input, "px-3", shownNameErr ? "border-red" : "border-line-strong")}
        />
        {shownNameErr && <FieldError>{shownNameErr}</FieldError>}
      </label>

      {shownDupes.length > 0 && (
        <div role="status" className="-mt-2 flex flex-col gap-2.5 rounded-[14px] bg-amber-bg px-4 py-3.5">
          <span className="flex items-center gap-2 text-sm font-bold text-amber">
            <Icon name="copy" size={16} />
            Possible duplicates — check before adding
          </span>
          {shownDupes.map((d) => (
            <div key={d.id} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2.5">
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-semibold">{d.name}</span>
                <span className="text-[12.5px] text-text-2">{d.sub}</span>
              </span>
              <Link
                href={`/accounts/${d.id}`}
                className="flex h-9 items-center rounded-full border border-line-strong bg-surface px-3 text-[13px] font-semibold whitespace-nowrap text-ink hover:bg-surface-2 hover:text-ink hover:no-underline"
              >
                Open existing
              </Link>
            </div>
          ))}
          <span className="text-[13px] text-ink">Different plant or company? Carry on — you can add a new plant unit of the same group.</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[
          { n: "brand", l: "Brand", ph: "e.g. LDM Denim" },
          { n: "plantUnit", l: "Plant unit", ph: "e.g. Plant 2" },
          { n: "group", l: "Parent group", ph: "e.g. Lyallpur Group" },
        ].map((f) => (
          <label key={f.n} className="flex flex-col gap-1.5">
            <span className={label}>{f.l}</span>
            <input name={f.n} placeholder={f.ph} autoComplete="off" className={cn(input, "border-line-strong")} />
          </label>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <label className="flex flex-col gap-1.5">
          <span className={label}>Sector</span>
          <SelectBox
            name="sectorId"
            value={sector}
            onChange={(v) => {
              setSector(v);
              setSub("");
            }}
            placeholder="Choose sector"
            options={options.sectors.map((s) => ({ v: String(s.id), l: s.name }))}
            error={!!fe.sectorId}
          />
          {fe.sectorId && <FieldError>{fe.sectorId}</FieldError>}
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Sub-sector</span>
          <SelectBox
            name="subSectorId"
            value={sub}
            onChange={setSub}
            placeholder={sector ? "Choose sub-sector" : "Pick a sector first"}
            options={subs.map((s) => ({ v: String(s.id), l: s.name }))}
            disabled={!sector}
          />
          <span className="text-[12.5px] text-text-3">{sector ? `${subs.length} option${subs.length === 1 ? "" : "s"} for ${sectorName}` : "Options depend on the sector"}</span>
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>City</span>
          <SelectBox name="cityId" placeholder="Choose city" options={options.cities.map((c) => ({ v: String(c.id), l: c.name }))} error={!!fe.cityId} />
          {fe.cityId && <FieldError>{fe.cityId}</FieldError>}
        </label>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className={label}>Priority</span>
          <input type="hidden" name="priority" value={priority} />
          <div className="flex gap-2">
            {PRIORITIES.map((p) => (
              <button
                key={p}
                type="button"
                aria-pressed={priority === p}
                onClick={() => setPriority(p)}
                className={cn("flex h-12 flex-1 items-center justify-center gap-1.5 rounded-xl border text-sm font-semibold md:h-11", chip(priority === p))}
              >
                <Icon name={PRI_ICON[p]} size={15} />
                {p}
              </button>
            ))}
          </div>
          <span className="text-[12.5px] text-text-3">P1 is the highest.</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className={label}>Lead source</span>
          <input type="hidden" name="leadSource" value={source} />
          <div className="grid grid-cols-2 gap-2">
            {LEAD_SOURCES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={source === s}
                onClick={() => setSource(s)}
                className={cn("h-11 rounded-xl border text-[13.5px] font-semibold md:h-[38px]", chip(source === s))}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <label className="flex flex-col gap-1.5">
          <span className={label}>Water need</span>
          <input name="waterNeed" placeholder="e.g. ETP upgrade + reuse" className={cn(input, "border-line-strong")} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Estimated capacity</span>
          <span className={cn("wr-field flex h-12 items-center overflow-hidden rounded-xl border bg-input md:h-11", fe.capacityMld ? "border-red" : "border-line-strong")}>
            <input
              name="capacityMld"
              inputMode="decimal"
              placeholder="0.0"
              className="h-full min-w-0 flex-1 border-0 bg-transparent px-3 text-base text-ink tabular-nums outline-none placeholder:text-text-3 md:text-[14.5px]"
            />
            <span className="flex h-full items-center border-l border-line bg-bg-alt px-3 text-[13px] font-bold text-text-2">MLD</span>
          </span>
          {fe.capacityMld ? <FieldError>{fe.capacityMld}</FieldError> : <span className="text-[12.5px] text-text-3">Million litres per day</span>}
        </label>
        <label className="flex flex-col gap-1.5">
          <span className={label}>Website</span>
          <span className={cn("wr-field flex h-12 items-center overflow-hidden rounded-xl border bg-input md:h-11", fe.website ? "border-red" : "border-line-strong")}>
            <span className="flex h-full items-center border-r border-line bg-bg-alt px-2.5 text-[13px] text-text-2">https://</span>
            <input
              name="website"
              placeholder="company.pk"
              autoComplete="off"
              className="h-full min-w-0 flex-1 border-0 bg-transparent px-3 text-base text-ink outline-none placeholder:text-text-3 md:text-[14.5px]"
            />
          </span>
          {fe.website && <FieldError>{fe.website}</FieldError>}
        </label>
      </div>

      <label className="flex flex-col gap-1.5">
        <span className={label}>Notes</span>
        <textarea
          name="notes"
          rows={3}
          placeholder="How you heard about them, decision makers, timing"
          className="wr-field min-h-[84px] resize-y rounded-xl border border-line-strong bg-input p-3 text-base leading-normal text-ink outline-none placeholder:text-text-3 md:text-[14.5px]"
        />
      </label>

      <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-line pt-[18px]">
        <Link
          href="/accounts"
          className="flex h-[50px] items-center justify-center rounded-full border border-line-strong bg-surface px-[18px] text-sm font-semibold text-ink hover:bg-surface-2 hover:text-ink hover:no-underline max-md:flex-1 md:h-[42px]"
        >
          Cancel
        </Link>
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-[50px] items-center justify-center gap-2 rounded-full border-0 bg-primary px-[22px] text-sm font-semibold text-on-primary hover:bg-primary-hover disabled:opacity-60 max-md:flex-1 md:h-[42px]"
        >
          <Icon name={pending ? "loader-circle" : "check"} size={16} className={pending ? "animate-spin" : undefined} />
          Add company
        </button>
      </div>
    </form>
  );
}

function SelectBox({
  name,
  value,
  onChange,
  placeholder,
  options,
  disabled,
  error,
}: {
  name: string;
  value?: string;
  onChange?: (v: string) => void;
  placeholder: string;
  options: { v: string; l: string }[];
  disabled?: boolean;
  error?: boolean;
}) {
  return (
    <span className="relative flex">
      <select
        name={name}
        {...(value !== undefined ? { value, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => onChange?.(e.target.value) } : { defaultValue: "" })}
        disabled={disabled}
        className={cn(
          "wr-field h-12 w-full min-w-0 appearance-none rounded-xl border pr-[38px] pl-3 text-base outline-none md:h-11 md:text-[14.5px]",
          disabled ? "bg-bg-alt text-text-3" : "bg-input text-ink",
          error ? "border-red" : "border-line-strong",
        )}
      >
        <option value="">{placeholder}</option>
        {options.map((o) => (
          <option key={o.v} value={o.v}>
            {o.l}
          </option>
        ))}
      </select>
      <Icon name="chevron-down" size={16} className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-text-3" />
    </span>
  );
}
