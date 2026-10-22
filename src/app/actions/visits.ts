"use server";

import { refresh } from "next/cache";
import { fail, guard, ok, type ActionResult } from "@/lib/action-result";
import { logAction } from "@/lib/audit";
import { canChange, requireActionUser } from "@/lib/auth/dal";
import { LATE_REASON_MIN, OUTCOME_KEYS, SKIP_REASONS, VISIT_TYPE_KEYS, outcomeOf } from "@/lib/constants";
import { store } from "@/lib/data/store";
import { isOutcomeOverdue } from "@/lib/rules";
import { addDays, fmtDateTime, parsePktLocal, pktDate } from "@/lib/time";

async function visitFor(user: Awaited<ReturnType<typeof requireActionUser>>, visitId: number) {
  const v = await store().get("visits", visitId);
  if (!v) throw new Error("Visit not found.");
  if (!canChange(user, v.salespersonId)) throw new Error("Only the salesperson or a manager can change this visit.");
  return v;
}

/** Sets the outcome of a pending visit, enforcing the skip reason and the 48-hour late reason. */
export async function setVisitOutcome(input: {
  visitId: number;
  outcome: string;
  skipReason?: string | null;
  lateReason?: string | null;
}): Promise<ActionResult<{ company: string; label: string }>> {
  return guard(async () => {
    const user = await requireActionUser({ edit: true });
    const v = await visitFor(user, input.visitId);
    if (v.outcome !== "pending") return fail("This visit already has an outcome.");
    if (!OUTCOME_KEYS.includes(input.outcome as never) || input.outcome === "pending") return fail("Choose an outcome.");

    const now = new Date();
    const fieldErrors: Record<string, string> = {};
    const skip = input.outcome === "skipped" ? (input.skipReason ?? "").trim() : null;
    if (input.outcome === "skipped" && !SKIP_REASONS.includes(skip as never)) fieldErrors.skip = "Choose why this visit was skipped.";
    const overdue = isOutcomeOverdue(v.visitAt, now);
    const late = overdue ? (input.lateReason ?? "").trim() : null;
    if (overdue && (late ?? "").length < LATE_REASON_MIN) fieldErrors.late = `Add a short reason (at least ${LATE_REASON_MIN} characters).`;
    if (Object.keys(fieldErrors).length) return fail("Some details are missing.", fieldErrors);

    await store().update("visits", v.id, { outcome: input.outcome, skipReason: skip, lateReason: late, outcomeSetAt: now });
    const company = (await store().get("companies", v.companyId))?.name ?? "—";
    const label = outcomeOf(input.outcome).label;
    await logAction(user, "visit", v.id, "outcome set", `${v.visitType} — ${company}: ${label}${skip ? ` (${skip})` : ""}${late ? ` · late: ${late}` : ""}`);
    refresh();
    return ok({ company, label });
  });
}

/** Undo right after saving an outcome — puts the visit back to pending. */
export async function undoVisitOutcome(visitId: number): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireActionUser({ edit: true });
    const v = await visitFor(user, visitId);
    if (v.outcome === "pending") return ok();
    if (!v.outcomeSetAt || Date.now() - v.outcomeSetAt.getTime() > 15 * 60_000) return fail("Too late to undo — open the visit to change it.");
    await store().update("visits", v.id, { outcome: "pending", skipReason: null, lateReason: null, outcomeSetAt: null });
    await logAction(user, "visit", v.id, "outcome undone", `${v.visitType} visit #${v.id}`);
    refresh();
    return ok();
  });
}

/** Ticks a follow-up ("next action") done, or back to open. */
export async function setNextActionDone(visitId: number, done: boolean): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireActionUser({ edit: true });
    const v = await visitFor(user, visitId);
    if (!v.nextAction) return fail("This visit has no next action.");
    await store().update("visits", v.id, { nextActionDoneAt: done ? new Date() : null });
    await logAction(user, "visit", v.id, done ? "next action done" : "next action reopened", v.nextAction);
    refresh();
    return ok();
  });
}


export type NewVisitInput = {
  companyId: number | null;
  dealId: number | null;
  visitType: string;
  visitAt: string; // datetime-local value, PKT
  contactMet: string;
  discussion: string;
  outcome: string;
  skipReason: string;
  lateReason: string;
  nextAction: string;
  nextActionDate: string; // YYYY-MM-DD
};

/** Log a visit. The outcome can be set now or within 48 hours from My Week. */
export async function createVisit(input: NewVisitInput): Promise<ActionResult<{ visitId: number; company: string; companyId: number; dueBy: string }>> {
  return guard(async () => {
    const user = await requireActionUser({ edit: true });
    const db = store();
    const fieldErrors: Record<string, string> = {};

    const company = input.companyId ? await db.get("companies", input.companyId) : undefined;
    if (!company) fieldErrors.companyId = "Choose the company you visited.";

    const type = VISIT_TYPE_KEYS.includes(input.visitType) ? input.visitType : null;
    if (!type) fieldErrors.visitType = "Choose a visit type.";

    const now = new Date();
    const at = parsePktLocal(input.visitAt) ?? now;
    if (at.getTime() > now.getTime() + 5 * 60_000) fieldErrors.visitAt = "A visit can’t be in the future — log it after it happens.";
    else if (at.getTime() < now.getTime() - 90 * 86_400_000) fieldErrors.visitAt = "That’s more than 90 days ago — check the date.";

    let dealId = input.dealId;
    if (dealId) {
      const deal = await db.get("deals", dealId);
      if (!deal || deal.companyId !== input.companyId) dealId = null;
    }

    const outcome = OUTCOME_KEYS.includes(input.outcome as never) ? input.outcome : "pending";
    const skip = outcome === "skipped" ? input.skipReason.trim() : "";
    if (outcome === "skipped" && !SKIP_REASONS.includes(skip as never)) fieldErrors.skipReason = "Choose why this visit was skipped.";
    const overdue = isOutcomeOverdue(at, now);
    if (overdue && outcome === "pending") fieldErrors.outcome = "This visit is more than 48 hours old — set the outcome now.";
    const late = overdue && outcome !== "pending" ? input.lateReason.trim() : "";
    if (overdue && outcome !== "pending" && late.length < LATE_REASON_MIN) {
      fieldErrors.lateReason = `Say why this is being logged late (at least ${LATE_REASON_MIN} characters).`;
    }

    const nextAction = input.nextAction.trim().slice(0, 240);
    const nextDate = input.nextActionDate.trim();
    if (nextDate && !/^\d{4}-\d{2}-\d{2}$/.test(nextDate)) fieldErrors.nextActionDate = "Use a valid date.";
    else if (nextDate && !nextAction) fieldErrors.nextActionDate = "Add the next action, or clear the date.";
    else if (nextDate && nextDate < pktDate(at)) fieldErrors.nextActionDate = "The next action can’t be before the visit.";

    if (Object.keys(fieldErrors).length) return fail("Check the highlighted fields.", fieldErrors);

    const v = await db.insert("visits", {
      companyId: company!.id,
      dealId,
      salespersonId: user.id,
      visitType: type!,
      visitAt: at,
      contactMet: input.contactMet.trim().slice(0, 240) || null,
      discussion: input.discussion.trim().slice(0, 4000) || null,
      outcome,
      skipReason: skip || null,
      lateReason: late || null,
      outcomeSetAt: outcome === "pending" ? null : now,
      nextAction: nextAction || null,
      nextActionDate: nextAction ? nextDate || addDays(pktDate(now), 7) : null,
    });
    await logAction(user, "visit", v.id, "created", `${type} — ${company!.name}${outcome !== "pending" ? `: ${outcomeOf(outcome).label}` : ""}`);
    refresh();
    return ok({ visitId: v.id, company: company!.name, companyId: company!.id, dueBy: fmtDateTime(new Date(at.getTime() + 48 * 3600_000)) });
  });
}

/** Undo for a visit logged moments ago by the same person. */
export async function deleteRecentVisit(visitId: number): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireActionUser({ edit: true });
    const v = await store().get("visits", visitId);
    if (!v) return ok();
    if (v.salespersonId !== user.id || Date.now() - v.createdAt.getTime() > 15 * 60_000) return fail("Too late to undo this visit.");
    await store().remove("visits", v.id);
    await logAction(user, "visit", v.id, "deleted", `Undo right after logging (${v.visitType})`);
    refresh();
    return ok();
  });
}

/** Open deals and contacts of a company, for the Log a visit form. */
export async function getCompanyVisitContext(companyId: number) {
  await requireActionUser();
  const db = store();
  const [deals, contacts] = await Promise.all([
    db.list("deals", { where: { companyId, stage: { in: ["lead", "qualified", "proposal", "negotiation"] } }, orderBy: [["valuePkr", "desc"]] }),
    db.list("contacts", { where: { companyId }, orderBy: [["isPrimary", "desc"], ["name", "asc"]] }),
  ]);
  return {
    deals: deals.map((d) => ({ id: d.id, title: d.title, stage: d.stage, value: d.valuePkr })),
    contacts: contacts.map((c) => ({ id: c.id, name: c.name, title: c.title })),
  };
}
