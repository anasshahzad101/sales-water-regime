import "server-only";
import type { CurrentUser } from "@/lib/auth/dal";
import { OUTCOME_KEYS, VISIT_TYPE_KEYS, outcomeOf } from "@/lib/constants";
import { store, type Row, type Where } from "@/lib/data/store";
import { pktDate } from "@/lib/time";
import { companyLine, lookups, type Lookups } from "./common";

export const RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "q", label: "This quarter" },
  { value: "all", label: "All time" },
] as const;
export const DEFAULT_RANGE = "30";

export type VisitFilters = { q: string; range: string; outcome: string; type: string; person: string; sort: "asc" | "desc"; page: number };

export function parseVisitFilters(sp: Record<string, string | string[] | undefined>): VisitFilters {
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");
  const range = RANGES.some((r) => r.value === s("range")) ? s("range") : DEFAULT_RANGE;
  return {
    q: s("q").trim().slice(0, 80),
    range,
    outcome: OUTCOME_KEYS.includes(s("outcome") as never) ? s("outcome") : "",
    type: VISIT_TYPE_KEYS.includes(s("type")) ? s("type") : "",
    person: /^\d+$/.test(s("person")) ? s("person") : "",
    sort: s("sort") === "asc" ? "asc" : "desc",
    page: Math.max(1, Number(s("page")) || 1),
  };
}

function rangeStart(range: string, now: Date): Date | null {
  if (range === "7") return new Date(now.getTime() - 7 * 86_400_000);
  if (range === "30") return new Date(now.getTime() - 30 * 86_400_000);
  if (range === "q") {
    const [y, m] = pktDate(now).split("-").map(Number);
    const qm = Math.floor((m - 1) / 3) * 3 + 1;
    return new Date(`${y}-${String(qm).padStart(2, "0")}-01T00:00:00+05:00`);
  }
  return null;
}

/** Builds the visit filter for a user (sales see their own; managers/admins the team). */
export async function visitWhere(user: CurrentUser, f: VisitFilters, now: Date): Promise<Where<Row<"visits">> | null> {
  const where: Where<Row<"visits">> = {};
  if (!user.isManager) where.salespersonId = user.id;
  else if (f.person) where.salespersonId = Number(f.person);
  const start = rangeStart(f.range, now);
  if (start) where.visitAt = { gte: start };
  if (f.outcome) where.outcome = f.outcome;
  if (f.type) where.visitType = f.type;
  if (f.q) {
    const like = `%${f.q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    const ids = (await store().list("companies", { where: { $or: [{ name: { like } }, { brand: { like } }, { plantUnit: { like } }] } })).map((c) => c.id);
    if (!ids.length) return null; // nothing can match
    where.companyId = { in: ids };
  }
  return where;
}

export type VisitRow = {
  id: number;
  companyId: number;
  company: string;
  sub: string;
  visitAt: Date;
  type: string;
  person: string;
  outcome: string;
  skipReason: string | null;
  lateReason: string | null;
  contact: string | null;
  discussion: string | null;
  next: string | null;
  nextDate: string | null;
  nextDone: boolean;
  dealId: number | null;
};

export async function toVisitRows(visits: Row<"visits">[], L: Lookups): Promise<VisitRow[]> {
  const ids = [...new Set(visits.map((v) => v.companyId))];
  const companies = new Map((ids.length ? await store().list("companies", { where: { id: { in: ids } } }) : []).map((c) => [c.id, c]));
  return visits.map((v) => {
    const c = companies.get(v.companyId);
    return {
      id: v.id,
      companyId: v.companyId,
      company: c?.name ?? "—",
      sub: c ? companyLine(c, L) : "",
      visitAt: v.visitAt,
      type: v.visitType,
      person: L.userById.get(v.salespersonId)?.name ?? "—",
      outcome: v.outcome,
      skipReason: v.skipReason,
      lateReason: v.lateReason,
      contact: v.contactMet,
      discussion: v.discussion,
      next: v.nextAction,
      nextDate: v.nextActionDate,
      nextDone: !!v.nextActionDoneAt,
      dealId: v.dealId,
    };
  });
}

export const PAGE_SIZE = 50;

export async function getVisits(user: CurrentUser, f: VisitFilters, now: Date) {
  const db = store();
  const L = await lookups();
  const where = await visitWhere(user, f, now);
  const people = L.users.filter((u) => u.role === "sales" || u.role === "manager");
  if (!where) return { rows: [] as VisitRow[], total: 0, people, L };
  const [total, visits] = await Promise.all([
    db.count("visits", where),
    db.list("visits", { where, orderBy: [["visitAt", f.sort]], limit: PAGE_SIZE, offset: (f.page - 1) * PAGE_SIZE }),
  ]);
  return { rows: await toVisitRows(visits, L), total, people, L };
}

export const outcomeShort = (k: string) => outcomeOf(k).short;
