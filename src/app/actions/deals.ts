"use server";

import { refresh } from "next/cache";
import { fail, guard, ok, type ActionResult } from "@/lib/action-result";
import { logAction } from "@/lib/audit";
import { canChange, requireActionUser, type CurrentUser } from "@/lib/auth/dal";
import { LOST_REASONS, OPEN_STAGES, PROPOSAL_STATUSES, SOLUTION_TYPES, STAGE_KEYS, stageOf, type StageKey } from "@/lib/constants";
import { store, type Row } from "@/lib/data/store";
import { money } from "@/lib/format";
import { isOpenStage } from "@/lib/rules";
import { fmtCalendar } from "@/lib/time";

const isDate = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(`${s}T00:00:00Z`));
const toInt = (v: unknown) => {
  const n = Number(String(v ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : NaN;
};

async function dealFor(user: CurrentUser, dealId: number) {
  const d = await store().get("deals", dealId);
  if (!d) throw new Error("Deal not found.");
  if (!canChange(user, d.ownerId)) throw new Error("Only the deal owner or a manager can change this deal.");
  return d;
}

// ---------------------------------------------------------------- create
export type NewDealState = { ok?: boolean; id?: number; title?: string; company?: string; error?: string; fieldErrors?: Record<string, string> };

export async function createDeal(_prev: NewDealState, form: FormData): Promise<NewDealState> {
  const res = await guard(async () => {
    const user = await requireActionUser({ edit: true });
    const db = store();
    const f = (k: string) => String(form.get(k) ?? "").trim();
    const fieldErrors: Record<string, string> = {};

    const companyId = Number(f("companyId"));
    const company = companyId ? await db.get("companies", companyId) : undefined;
    if (!company) fieldErrors.companyId = "Choose a company.";
    const title = f("title").slice(0, 240);
    if (!title) fieldErrors.title = "Give the deal a short title.";
    const stage = f("stage") || "lead";
    if (!OPEN_STAGES.includes(stage as StageKey)) fieldErrors.stage = "Choose a stage. Record Won or Lost from the deal page.";
    const sol = f("solutionType");
    if (sol && !(SOLUTION_TYPES as readonly string[]).includes(sol)) fieldErrors.solutionType = "Choose a solution type.";
    const value = f("valuePkr") ? toInt(f("valuePkr")) : null;
    if (value != null && (Number.isNaN(value) || value < 0)) fieldErrors.valuePkr = "Enter the value in rupees.";
    const prob = f("probability") === "" ? stageOf(stage).p : toInt(f("probability"));
    if (Number.isNaN(prob) || prob < 0 || prob > 100) fieldErrors.probability = "Use 0–100.";
    const close = f("expectedClose");
    if (close && !isDate(close)) fieldErrors.expectedClose = "Use a valid date.";
    if (Object.keys(fieldErrors).length) return fail("Check the highlighted fields.", fieldErrors);

    const d = await db.insert("deals", {
      title,
      companyId: company!.id,
      ownerId: user.id,
      stage,
      stageEnteredAt: new Date(),
      solutionType: sol || null,
      valuePkr: value,
      probability: Math.round(prob),
      expectedClose: close || null,
      notes: f("notes").slice(0, 4000) || null,
    });
    await logAction(user, "deal", d.id, "created", `${title} — ${company!.name} · ${stageOf(stage).label}${value ? ` · ${money(value)}` : ""}`);
    refresh();
    return ok({ id: d.id, title, company: company!.name });
  });
  if (!res.ok) return { error: res.error, fieldErrors: res.fieldErrors };
  return { ok: true, ...res.data };
}

// ---------------------------------------------------------------- stage
export type StageSnapshot = { probability: number; lostReason: string | null; lostNote: string | null; closedAt: string | null };

export async function changeDealStage(input: {
  dealId: number;
  stage: string;
  lostReason?: string | null;
  lostNote?: string | null;
}): Promise<ActionResult<{ from: string; to: string; snapshot: StageSnapshot }>> {
  return guard(async () => {
    const user = await requireActionUser({ edit: true });
    const d = await dealFor(user, input.dealId);
    const stage = input.stage as StageKey;
    if (!STAGE_KEYS.includes(stage)) return fail("Choose a stage.");
    if (stage === d.stage) return fail("The deal is already at that stage.");

    let lostReason: string | null = null;
    let lostNote: string | null = null;
    if (stage === "lost") {
      lostReason = (input.lostReason ?? "").trim();
      lostNote = (input.lostNote ?? "").trim().slice(0, 2000) || null;
      if (!(LOST_REASONS as readonly string[]).includes(lostReason)) return fail("Pick the main reason.", { lost: "Pick the main reason." });
      if (lostReason === "Other (specify)" && !lostNote) return fail("Add a short note for “Other”.", { lost: "Add a short note for “Other”." });
    }

    const now = new Date();
    const probability = stage === "won" ? 100 : stage === "lost" ? 0 : isOpenStage(d.stage) ? d.probability : stageOf(stage).p;
    const snapshot: StageSnapshot = {
      probability: d.probability,
      lostReason: d.lostReason,
      lostNote: d.lostNote,
      closedAt: d.closedAt ? d.closedAt.toISOString() : null,
    };
    await store().update("deals", d.id, {
      stage,
      stageEnteredAt: now,
      previousStage: d.stage,
      previousStageEnteredAt: d.stageEnteredAt,
      probability,
      lostReason,
      lostNote,
      closedAt: stage === "won" || stage === "lost" ? now : null,
    });
    const from = stageOf(d.stage).label;
    const to = stageOf(stage).label;
    await logAction(user, "deal", d.id, "stage changed", `${d.title}: ${from} → ${to}${lostReason ? ` (${lostReason})` : ""}`);
    refresh();
    return ok({ from, to, snapshot });
  });
}

/** Undo the last stage change (within 15 minutes), restoring the previous stage and its timer. */
export async function undoDealStage(dealId: number, snapshot: StageSnapshot): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireActionUser({ edit: true });
    const d = await dealFor(user, dealId);
    if (!d.previousStage || !d.previousStageEnteredAt) return fail("Nothing to undo.");
    if (Date.now() - d.stageEnteredAt.getTime() > 15 * 60_000) return fail("Too late to undo — change the stage instead.");
    const prob = Math.max(0, Math.min(100, Math.round(Number(snapshot.probability) || 0)));
    const lostReason = snapshot.lostReason && (LOST_REASONS as readonly string[]).includes(snapshot.lostReason) ? snapshot.lostReason : null;
    const closedAt = snapshot.closedAt && !Number.isNaN(Date.parse(snapshot.closedAt)) ? new Date(snapshot.closedAt) : null;
    await store().update("deals", d.id, {
      stage: d.previousStage,
      stageEnteredAt: d.previousStageEnteredAt,
      previousStage: null,
      previousStageEnteredAt: null,
      probability: prob,
      lostReason: d.previousStage === "lost" ? lostReason : null,
      lostNote: d.previousStage === "lost" ? (snapshot.lostNote ?? null) : null,
      closedAt: d.previousStage === "won" || d.previousStage === "lost" ? closedAt : null,
    });
    await logAction(user, "deal", d.id, "stage change undone", `${d.title}: back to ${stageOf(d.previousStage).label}`);
    refresh();
    return ok();
  });
}

// ---------------------------------------------------------------- edit
export async function updateDeal(input: {
  dealId: number;
  title: string;
  valueMillions: string;
  probability: string;
  expectedClose: string;
  solutionType: string | null;
  notes: string;
}): Promise<ActionResult<{ title: string }>> {
  return guard(async () => {
    const user = await requireActionUser({ edit: true });
    const d = await dealFor(user, input.dealId);
    const fieldErrors: Record<string, string> = {};
    const title = input.title.trim().slice(0, 240);
    if (!title) fieldErrors.title = "Give the deal a short title.";
    const vm = input.valueMillions.trim() === "" ? null : Number(input.valueMillions.replace(/,/g, ""));
    if (vm != null && (!Number.isFinite(vm) || vm < 0)) fieldErrors.value = "Enter the value in millions, e.g. 86.5";
    const prob = Number(input.probability);
    if (!Number.isFinite(prob) || prob < 0 || prob > 100) fieldErrors.probability = "Use 0–100.";
    const close = input.expectedClose.trim();
    if (close && !isDate(close)) fieldErrors.expectedClose = "Use a valid date.";
    const sol = input.solutionType || null;
    if (sol && !(SOLUTION_TYPES as readonly string[]).includes(sol)) fieldErrors.solutionType = "Choose a solution type.";
    if (Object.keys(fieldErrors).length) return fail("Check the highlighted fields.", fieldErrors);

    const value = vm == null ? null : Math.round(vm * 1_000_000);
    const patch: Partial<Row<"deals">> = {
      title,
      valuePkr: value,
      probability: d.stage === "won" ? 100 : d.stage === "lost" ? 0 : Math.round(prob),
      expectedClose: close || null,
      solutionType: sol,
      notes: input.notes.trim().slice(0, 4000) || null,
    };
    const changes: string[] = [];
    if (d.title !== title) changes.push(`title “${d.title}” → “${title}”`);
    if ((d.valuePkr ?? null) !== value) changes.push(`value ${money(d.valuePkr)} → ${money(value)}`);
    if (d.probability !== patch.probability) changes.push(`probability ${d.probability}% → ${patch.probability}%`);
    if ((d.expectedClose ?? null) !== patch.expectedClose) changes.push(`expected close ${fmtCalendar(d.expectedClose)} → ${fmtCalendar(patch.expectedClose)}`);
    if ((d.solutionType ?? null) !== sol) changes.push(`solution ${d.solutionType ?? "—"} → ${sol ?? "—"}`);
    if ((d.notes ?? null) !== patch.notes) changes.push("notes edited");
    if (!changes.length) return ok({ title });

    await store().update("deals", d.id, patch);
    await logAction(user, "deal", d.id, "updated", `${title}: ${changes.join("; ")}`);
    refresh();
    return ok({ title });
  });
}

// ---------------------------------------------------------------- proposals
export async function addProposal(input: {
  dealId: number;
  reference: string;
  submittedOn: string;
  amount: string;
}): Promise<ActionResult<{ reference: string; amount: number }>> {
  return guard(async () => {
    const user = await requireActionUser({ edit: true });
    const d = await dealFor(user, input.dealId);
    const fieldErrors: Record<string, string> = {};
    const amount = toInt(input.amount);
    if (!input.amount.trim() || Number.isNaN(amount) || amount <= 0) fieldErrors.amount = "Enter the proposal amount.";
    const date = input.submittedOn.trim();
    if (date && !isDate(date)) fieldErrors.submittedOn = "Use a valid date.";
    const reference = input.reference.trim().slice(0, 80);
    if (!reference) fieldErrors.reference = "Add a reference.";
    if (Object.keys(fieldErrors).length) return fail("Check the highlighted fields.", fieldErrors);

    const p = await store().insert("proposals", {
      dealId: d.id,
      reference,
      submittedOn: date || null,
      amountPkr: Math.round(amount),
      status: "Submitted",
    });
    const company = (await store().get("companies", d.companyId))?.name ?? "—";
    await logAction(user, "proposal", p.id, "created", `${reference} · ${company} · ${money(amount)}`);
    refresh();
    return ok({ reference, amount });
  });
}

export async function setProposalStatus(proposalId: number, status: string): Promise<ActionResult<{ reference: string }>> {
  return guard(async () => {
    const user = await requireActionUser({ edit: true });
    const p = await store().get("proposals", proposalId);
    if (!p) return fail("Proposal not found.");
    await dealFor(user, p.dealId);
    if (!PROPOSAL_STATUSES.some((s) => s.key === status)) return fail("Choose a status.");
    if (p.status === status) return ok({ reference: p.reference ?? "" });
    await store().update("proposals", p.id, { status });
    await logAction(user, "proposal", p.id, "status changed", `${p.reference ?? `#${p.id}`}: ${p.status} → ${status}`);
    refresh();
    return ok({ reference: p.reference ?? `#${p.id}` });
  });
}
