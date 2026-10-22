import "server-only";
import type { CurrentUser } from "@/lib/auth/dal";
import { canChange } from "@/lib/auth/dal";
import { SOLUTION_TYPES, STAGES, stageOf, type StageKey } from "@/lib/constants";
import { store, type Row, type Where } from "@/lib/data/store";
import { initials } from "@/lib/format";
import { daysInStage, isClosePassed, isOpenStage, isStuck, outcomeHoursLeft } from "@/lib/rules";
import { fmtCalendar, fmtDate, fmtDateTime, pktDate } from "@/lib/time";
import { companyLine, lookups } from "./common";

// ---------------------------------------------------------------- Team Pulse filters
export type PulseFilters = { scope: "mine" | "team"; owner: number | null; sols: string[] };

/** Reads ?scope, ?owner and ?sol (comma-separated) with role-based defaults. */
export function pulseFilters(user: CurrentUser, sp: Record<string, string | string[] | undefined>): PulseFilters {
  const one = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const scopeParam = one("scope");
  const scope: PulseFilters["scope"] = scopeParam === "mine" || scopeParam === "team" ? scopeParam : user.role === "sales" ? "mine" : "team";
  const owner = scope === "team" && /^\d+$/.test(one("owner")) ? Number(one("owner")) : null;
  const sols = one("sol")
    .split(",")
    .filter((s) => (SOLUTION_TYPES as readonly string[]).includes(s));
  return { scope, owner, sols };
}

function pulseWhere(user: CurrentUser, f: PulseFilters): Where<Row<"deals">> {
  const where: Where<Row<"deals">> = {};
  if (f.scope === "mine") where.ownerId = user.id;
  else if (f.owner) where.ownerId = f.owner;
  if (f.sols.length) where.solutionType = { in: f.sols };
  return where;
}

export type PulseCard = {
  id: number;
  title: string;
  company: string;
  value: number | null;
  sol: string | null;
  owner: string;
  ownerInitials: string;
  stage: StageKey;
  days: number;
  stuck: boolean;
  closePassed: boolean;
  close: string;
  closedOn: string;
  lostReason: string | null;
};
export type PulseColumn = { key: StageKey; count: number; total: number; cards: PulseCard[] };

export async function filteredDeals(user: CurrentUser, f: PulseFilters) {
  return store().list("deals", { where: pulseWhere(user, f), orderBy: [["valuePkr", "desc"]] });
}

export async function getPulse(user: CurrentUser, f: PulseFilters, now: Date) {
  const db = store();
  const today = pktDate(now);
  const [L, deals] = await Promise.all([lookups(), filteredDeals(user, f)]);
  const companyIds = [...new Set(deals.map((d) => d.companyId))];
  const companies = new Map(
    (companyIds.length ? await db.list("companies", { where: { id: { in: companyIds } } }) : []).map((c) => [c.id, c]),
  );
  const card = (d: Row<"deals">): PulseCard => {
    const owner = d.ownerId ? L.userById.get(d.ownerId) : undefined;
    return {
      id: d.id,
      title: d.title,
      company: companies.get(d.companyId)?.name ?? "—",
      value: d.valuePkr,
      sol: d.solutionType,
      owner: owner ? owner.name.split(" ")[0] : "Unassigned",
      ownerInitials: owner ? initials(owner.name) : "—",
      stage: d.stage as StageKey,
      days: daysInStage(d.stageEnteredAt, now),
      stuck: isStuck(d, now),
      closePassed: isClosePassed(d, today),
      close: fmtCalendar(d.expectedClose),
      closedOn: d.closedAt ? fmtDate(d.closedAt) : fmtCalendar(d.expectedClose),
      lostReason: d.lostReason,
    };
  };
  const columns: PulseColumn[] = STAGES.map((s) => {
    const list = deals.filter((d) => d.stage === s.key);
    return { key: s.key, count: list.length, total: list.reduce((n, d) => n + (d.valuePkr ?? 0), 0), cards: list.map(card) };
  });
  const people = L.users.filter((u) => u.isActive && (u.role === "sales" || u.role === "manager")).map((u) => ({ id: u.id, name: u.name }));
  return { columns, people };
}

// ---------------------------------------------------------------- New deal
export async function companyOptions() {
  const [L, companies] = await Promise.all([lookups(), store().list("companies", { where: { status: { ne: "archived" } }, orderBy: [["name", "asc"]] })]);
  return companies.map((c) => ({ id: c.id, name: c.name, sub: companyLine(c, L), priority: c.priority }));
}

// ---------------------------------------------------------------- Deal detail
export type DealView = NonNullable<Awaited<ReturnType<typeof getDealView>>>;

export async function getDealView(user: CurrentUser, id: number, now: Date) {
  const db = store();
  const deal = await db.get("deals", id);
  if (!deal) return null;
  const today = pktDate(now);
  const [L, company, proposals, visits] = await Promise.all([
    lookups(),
    db.get("companies", deal.companyId),
    db.list("proposals", { where: { dealId: id }, orderBy: [["submittedOn", "asc"], ["id", "asc"]] }),
    db.list("visits", { where: { dealId: id }, orderBy: [["visitAt", "desc"]] }),
  ]);
  const propIds = proposals.map((p) => p.id);
  const [dealLog, propLog, allRefs] = await Promise.all([
    db.list("auditLog", { where: { entity: "deal", entityId: id }, orderBy: [["createdAt", "desc"]], limit: 30 }),
    propIds.length ? db.list("auditLog", { where: { entity: "proposal", entityId: { in: propIds } }, orderBy: [["createdAt", "desc"]], limit: 30 }) : Promise.resolve([]),
    db.list("proposals", { where: { reference: { like: `WR-P-${today.slice(0, 4)}-%` } } }),
  ]);
  const owner = deal.ownerId ? L.userById.get(deal.ownerId) : undefined;
  const city = company?.cityId ? L.cityById.get(company.cityId)?.name : null;
  const st = stageOf(deal.stage);
  const nextNum = allRefs.reduce((m, p) => Math.max(m, Number(/-(\d+)$/.exec(p.reference ?? "")?.[1] ?? 0)), 0) + 1;

  const history = [...dealLog, ...propLog]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 12)
    .map((h) => ({
      id: h.id,
      text: `${h.action.charAt(0).toUpperCase()}${h.action.slice(1)}${h.detail ? `: ${h.detail}` : ""}`,
      meta: `${fmtDateTime(h.createdAt)} · ${h.userId ? (L.userById.get(h.userId)?.name ?? "—") : "System"}`,
      recent: now.getTime() - h.createdAt.getTime() < 86_400_000,
    }));
  // Imported deals have no "created" audit entry, so show when the record appeared.
  if (!dealLog.some((h) => h.action === "created")) {
    history.push({ id: 0, text: "Deal added", meta: fmtDateTime(deal.createdAt), recent: false });
  }

  return {
    id: deal.id,
    title: deal.title,
    stage: deal.stage as StageKey,
    stageDefault: st.p,
    open: isOpenStage(deal.stage),
    value: deal.valuePkr,
    probability: deal.probability,
    expectedClose: deal.expectedClose,
    expectedCloseLabel: fmtCalendar(deal.expectedClose),
    days: daysInStage(deal.stageEnteredAt, now),
    stuck: isStuck(deal, now),
    closePassed: isClosePassed(deal, today),
    solution: deal.solutionType,
    notes: deal.notes,
    lostReason: deal.lostReason,
    lostNote: deal.lostNote,
    company: {
      id: company?.id ?? deal.companyId,
      name: company?.name ?? "—",
      line: company ? companyLine(company, L) : "",
      city,
      need: company?.waterNeed ?? null,
    },
    owner: owner ? owner.name : "Unassigned",
    canEdit: canChange(user, deal.ownerId),
    isCeo: user.isCeo,
    proposals: proposals.map((p) => ({
      id: p.id,
      reference: p.reference ?? `Proposal #${p.id}`,
      submitted: fmtCalendar(p.submittedOn),
      amount: p.amountPkr,
      status: p.status,
      notes: p.notes,
    })),
    nextRef: `WR-P-${today.slice(0, 4)}-${String(nextNum).padStart(3, "0")}`,
    today,
    visits: visits.map((v) => ({
      id: v.id,
      type: v.visitType,
      when: fmtDateTime(v.visitAt),
      who: L.userById.get(v.salespersonId)?.name ?? "—",
      notes: v.discussion ?? v.contactMet ?? "",
      outcome: v.outcome,
      hrsLeft: v.outcome === "pending" ? outcomeHoursLeft(v.visitAt, now) : null,
    })),
    history,
  };
}
