import "server-only";
import type { CurrentUser } from "@/lib/auth/dal";
import { OPEN_STAGES, stageOf } from "@/lib/constants";
import { store, type Row } from "@/lib/data/store";
import { daysInStage, dormancy, isClosePassed, isStuck, outcomeHoursLeft } from "@/lib/rules";
import { addDays, daysBetween, fmtCalendar, fmtDate, fmtDateTime, fmtDayMonth, fmtTime, fmtWeekday, pktDate } from "@/lib/time";
import { companyLine, lookups } from "./common";

export type PendingVisit = {
  id: number;
  companyId: number;
  company: string;
  sub: string;
  type: string;
  when: string;
  whenShort: string;
  dueAt: string;
  contact: string | null;
  hrsLeft: number;
};
export type DueAction = {
  visitId: number;
  text: string;
  company: string;
  companyId: number;
  from: string;
  group: "overdue" | "today" | "later";
  done: boolean;
  chip: string;
};
export type MyDeal = {
  id: number;
  title: string;
  company: string;
  stage: string;
  value: number | null;
  days: number;
  stuck: boolean;
  closePassed: boolean;
  close: string;
};
export type FlagItem = { href: string; title: string; meta: string };

export async function getMyWeek(user: CurrentUser, now: Date) {
  const db = store();
  const today = pktDate(now);
  const weekEnd = addDays(today, 6);
  const [L, pending, actionRows, deals, myCompanies, visitCount] = await Promise.all([
    lookups(),
    db.list("visits", { where: { salespersonId: user.id, outcome: "pending" }, orderBy: [["visitAt", "asc"]] }),
    db.list("visits", {
      where: { salespersonId: user.id, nextAction: { ne: null }, nextActionDate: { gte: addDays(today, -60), lte: weekEnd } },
      orderBy: [["nextActionDate", "asc"]],
    }),
    db.list("deals", { where: { ownerId: user.id, stage: { in: OPEN_STAGES } }, orderBy: [["valuePkr", "desc"]] }),
    db.list("companies", { where: { ownerId: user.id } }),
    db.count("visits", { salespersonId: user.id }),
  ]);

  const actions = actionRows.filter((v) => !v.nextActionDoneAt || pktDate(v.nextActionDoneAt) === today);
  const companyIds = [...new Set([...pending, ...actions].map((v) => v.companyId).concat(deals.map((d) => d.companyId)))];
  const companies = new Map<number, Row<"companies">>(
    (companyIds.length ? await db.list("companies", { where: { id: { in: companyIds } } }) : []).map((c) => [c.id, c]),
  );
  for (const c of myCompanies) companies.set(c.id, c);
  const name = (id: number) => companies.get(id)?.name ?? "—";

  const pendingVisits: PendingVisit[] = pending.map((v) => {
    const c = companies.get(v.companyId);
    const isToday = pktDate(v.visitAt) === today;
    return {
      id: v.id,
      companyId: v.companyId,
      company: name(v.companyId),
      sub: c ? companyLine(c, L) : "",
      type: v.visitType,
      when: fmtDateTime(v.visitAt),
      whenShort: `${isToday ? "Today" : `${fmtWeekday(v.visitAt)} ${fmtDayMonth(v.visitAt)}`}, ${fmtTime(v.visitAt)} PKT`,
      dueAt: fmtDateTime(new Date(v.visitAt.getTime() + 48 * 3600_000)),
      contact: v.contactMet,
      hrsLeft: outcomeHoursLeft(v.visitAt, now),
    };
  });

  const dueActions: DueAction[] = actions.map((v) => {
    const date = v.nextActionDate!;
    const diff = daysBetween(today, date);
    const done = !!v.nextActionDoneAt;
    const group: DueAction["group"] = diff < 0 ? "overdue" : diff === 0 ? "today" : "later";
    return {
      visitId: v.id,
      text: v.nextAction!,
      company: name(v.companyId),
      companyId: v.companyId,
      from: `${v.visitType}, ${fmtDayMonth(v.visitAt)}`,
      group,
      done,
      chip: diff < 0 ? `${-diff} d overdue` : diff === 0 ? "Today" : `${fmtWeekday(`${date}T12:00:00+05:00`)} ${fmtDayMonth(`${date}T12:00:00+05:00`)}`,
    };
  });

  const myDeals: MyDeal[] = deals.map((d) => ({
    id: d.id,
    title: d.title,
    company: name(d.companyId),
    stage: d.stage,
    value: d.valuePkr,
    days: daysInStage(d.stageEnteredAt, now),
    stuck: isStuck(d, now),
    closePassed: isClosePassed(d, today),
    close: fmtCalendar(d.expectedClose),
  }));

  const lastVisits = await db.lastVisitByCompany(myCompanies.map((c) => c.id));
  const dormant: FlagItem[] = [];
  for (const c of myCompanies) {
    const last = lastVisits.get(c.id) ?? null;
    const d = dormancy(c, last, now);
    if (!d.dormant) continue;
    const city = c.cityId ? L.cityById.get(c.cityId)?.name : null;
    dormant.push({
      href: `/accounts/${c.id}`,
      title: c.name,
      meta: `${city ? `${city} · ` : ""}${last ? `no visit in ${d.days} d (last ${fmtDate(last)})` : `no visit since you took it on, ${d.days} d ago`}`,
    });
  }

  const stuck: FlagItem[] = myDeals
    .filter((d) => d.stuck)
    .map((d) => ({ href: `/deals/${d.id}`, title: `${d.company} — ${d.title}`, meta: `${d.days} d in ${stageOf(d.stage).label}` }));
  const closePassed: FlagItem[] = deals
    .filter((d) => isClosePassed(d, today))
    .map((d) => ({
      href: `/deals/${d.id}`,
      title: `${name(d.companyId)} — ${d.title}`,
      meta: `Expected ${fmtCalendar(d.expectedClose)} · ${daysBetween(d.expectedClose!, today)} d ago`,
    }));

  const isNew = visitCount === 0 && myCompanies.length === 0 && deals.length === 0;
  const totalCompanies = isNew ? await db.count("companies") : 0;

  return { pendingVisits, dueActions, myDeals, flags: { stuck, dormant, closePassed }, isNew, totalCompanies };
}
