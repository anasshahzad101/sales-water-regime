import "server-only";
import { LOST_REASONS, OUTCOME_GRACE_HOURS, STAGES, stageOf, type Hue } from "@/lib/constants";
import { store, type Row } from "@/lib/data/store";
import { money } from "@/lib/format";
import { daysInStage, dormancy, isClosePassed, isOpenStage, isStuck, outcomeHoursLeft } from "@/lib/rules";
import { addDays, daysBetween, fmtCalendar, fmtDate, fmtDayMonth, fmtTime, humanizeHours, pktDate } from "@/lib/time";
import { companyLine, lookups, type Lookups } from "./common";

// ---------------------------------------------------------------- date range

export type RangeKey = "month" | "quarter" | "year" | "custom";
export type CockpitRange = { key: RangeKey; fromYmd: string; toYmd: string; from: Date; to: Date; text: string };

const isYmd = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
const startOfDay = (ymd: string) => new Date(`${ymd}T00:00:00+05:00`);
const endOfDay = (ymd: string) => new Date(`${ymd}T23:59:59.999+05:00`);
const pktNoon = (ymd: string) => `${ymd}T12:00:00+05:00`;

/** "1–22 Oct 2026", "1 Oct – 22 Oct 2026", "1 Sep 2025 – 22 Oct 2026" */
function rangeLabel(fromYmd: string, toYmd: string): string {
  if (fromYmd === toYmd) return fmtDate(pktNoon(toYmd));
  if (fromYmd.slice(0, 7) === toYmd.slice(0, 7)) return `${Number(fromYmd.slice(8))}–${fmtDate(pktNoon(toYmd))}`;
  if (fromYmd.slice(0, 4) === toYmd.slice(0, 4)) return `${fmtDayMonth(pktNoon(fromYmd))} – ${fmtDate(pktNoon(toYmd))}`;
  return `${fmtDate(pktNoon(fromYmd))} – ${fmtDate(pktNoon(toYmd))}`;
}

/** Reads ?range=month|quarter|year|custom&from=YYYY-MM-DD&to=YYYY-MM-DD (PKT calendar dates). Default: this quarter. */
export function resolveRange(sp: Record<string, string | string[] | undefined>, now: Date): CockpitRange {
  const today = pktDate(now);
  const y = today.slice(0, 4);
  const m = Number(today.slice(5, 7));
  const raw = typeof sp.range === "string" ? sp.range : "quarter";
  const key: RangeKey = ["month", "quarter", "year", "custom"].includes(raw) ? (raw as RangeKey) : "quarter";

  if (key === "custom") {
    let fromYmd = isYmd(sp.from) ? sp.from : `${addDays(`${today.slice(0, 7)}-01`, -1).slice(0, 7)}-01`; // default: start of last month
    let toYmd = isYmd(sp.to) ? sp.to : today;
    if (fromYmd > toYmd) [fromYmd, toYmd] = [toYmd, fromYmd];
    if (toYmd > today) toYmd = today;
    if (fromYmd > toYmd) fromYmd = toYmd;
    return { key, fromYmd, toYmd, from: startOfDay(fromYmd), to: endOfDay(toYmd), text: rangeLabel(fromYmd, toYmd) };
  }
  const q = Math.floor((m - 1) / 3);
  const fromYmd = key === "month" ? `${today.slice(0, 7)}-01` : key === "quarter" ? `${y}-${String(q * 3 + 1).padStart(2, "0")}-01` : `${y}-01-01`;
  const label = rangeLabel(fromYmd, today);
  return {
    key,
    fromYmd,
    toYmd: today,
    from: startOfDay(fromYmd),
    to: now,
    text: key === "quarter" ? `Q${q + 1} · ${fromYmd.slice(0, 7) === today.slice(0, 7) ? `${fmtDayMonth(pktNoon(fromYmd))} – ${fmtDate(pktNoon(today))}` : label}` : label,
  };
}

// ---------------------------------------------------------------- flags (shared by the Cockpit tiles and the drill-down lists)

export type FlagKey = "outcome" | "stuck" | "dormant" | "close";
export const FLAG_KEYS: FlagKey[] = ["outcome", "stuck", "dormant", "close"];

export const FLAG_DEFS: Record<FlagKey, { label: string; title: string; rule: string; c1: string; c2: string; c4: string }> = {
  outcome: { label: "Outcome overdue", title: "overdue outcomes", rule: "Visits with no outcome more than 48 hours after the visit.", c1: "Visit", c2: "Company", c4: "Overdue by" },
  stuck: { label: "Stuck", title: "stuck deals", rule: "Open deals that have been in the same stage for more than 30 days.", c1: "Deal", c2: "Stage", c4: "In stage" },
  dormant: { label: "Dormant", title: "dormant accounts", rule: "Owned accounts with no visit in the last 60 days.", c1: "Account", c2: "City", c4: "Last visit" },
  close: { label: "Close passed", title: "overdue close dates", rule: "Open deals whose expected close date has passed.", c1: "Deal", c2: "Expected close", c4: "Days past" },
};

export type DrillRow = { key: string; href: string; a: string; a2: string; b: string; owner: string; d: string; ownerId: number | null };

type Base = {
  L: Lookups;
  deals: Row<"deals">[];
  companies: Row<"companies">[];
  companyById: Map<number, Row<"companies">>;
};

async function loadBase(): Promise<Base> {
  const db = store();
  const [L, deals, companies] = await Promise.all([lookups(), db.list("deals"), db.list("companies")]);
  return { L, deals, companies, companyById: new Map(companies.map((c) => [c.id, c])) };
}

const ownerName = (L: Lookups, id: number | null) => (id ? (L.userById.get(id)?.name ?? "—") : "Unassigned");

async function computeFlags(base: Base, now: Date): Promise<Record<FlagKey, DrillRow[]>> {
  const { L, deals, companies, companyById } = base;
  const db = store();
  const today = pktDate(now);
  const cutoff = new Date(now.getTime() - OUTCOME_GRACE_HOURS * 3600_000);
  const coName = (id: number) => companyById.get(id)?.name ?? "—";

  const overdueVisits = await db.list("visits", { where: { outcome: "pending", visitAt: { lt: cutoff } }, orderBy: [["visitAt", "asc"]] });
  const outcome: DrillRow[] = overdueVisits.map((v) => ({
    key: `v${v.id}`,
    href: `/accounts/${v.companyId}`,
    a: `${v.visitType} · ${fmtDate(v.visitAt)}`,
    a2: `${fmtTime(v.visitAt)} PKT`,
    b: coName(v.companyId),
    owner: ownerName(L, v.salespersonId),
    d: humanizeHours(-outcomeHoursLeft(v.visitAt, now)),
    ownerId: v.salespersonId,
  }));

  const open = deals.filter((d) => isOpenStage(d.stage));
  const stuck: DrillRow[] = open
    .filter((d) => isStuck(d, now))
    .map((d) => ({ d, days: daysInStage(d.stageEnteredAt, now) }))
    .sort((x, y) => y.days - x.days)
    .map(({ d, days }) => ({
      key: `d${d.id}`,
      href: `/deals/${d.id}`,
      a: d.title,
      a2: `${coName(d.companyId)} · ${money(d.valuePkr)}`,
      b: stageOf(d.stage).label,
      owner: ownerName(L, d.ownerId),
      d: `${days} d`,
      ownerId: d.ownerId,
    }));

  const close: DrillRow[] = open
    .filter((d) => isClosePassed(d, today))
    .map((d) => ({ d, past: daysBetween(d.expectedClose!, today) }))
    .sort((x, y) => y.past - x.past)
    .map(({ d, past }) => ({
      key: `d${d.id}`,
      href: `/deals/${d.id}`,
      a: d.title,
      a2: `${coName(d.companyId)} · ${money(d.valuePkr)}`,
      b: fmtCalendar(d.expectedClose),
      owner: ownerName(L, d.ownerId),
      d: `${past} d`,
      ownerId: d.ownerId,
    }));

  const owned = companies.filter((c) => c.ownerId && c.status !== "archived");
  const last = await db.lastVisitByCompany(owned.map((c) => c.id));
  const dormant: DrillRow[] = owned
    .map((c) => ({ c, lastAt: last.get(c.id) ?? null, info: dormancy(c, last.get(c.id) ?? null, now) }))
    .filter((x) => x.info.dormant)
    .sort((x, y) => (y.info.days ?? 0) - (x.info.days ?? 0))
    .map(({ c, lastAt, info }) => {
      const city = c.cityId ? (L.cityById.get(c.cityId)?.name ?? "—") : "—";
      const line = [c.brand, c.plantUnit].filter(Boolean).join(" · ");
      return {
        key: `c${c.id}`,
        href: `/accounts/${c.id}`,
        a: c.name,
        a2: line || companyLine(c, L) || (c.sectorId ? (L.sectorById.get(c.sectorId)?.name ?? "") : ""),
        b: city,
        owner: ownerName(L, c.ownerId),
        d: lastAt ? `${info.days} d · ${fmtDate(lastAt)}` : `${info.days} d · never visited`,
        ownerId: c.ownerId,
      };
    });

  return { outcome, stuck, dormant, close };
}

export async function getFlagDrill(flag: FlagKey, now: Date) {
  const flags = await computeFlags(await loadBase(), now);
  return { rows: flags[flag], counts: Object.fromEntries(FLAG_KEYS.map((k) => [k, flags[k].length])) as Record<FlagKey, number> };
}

// ---------------------------------------------------------------- cockpit

export type StageRow = { key: string; label: string; icon: string; hue: Hue; value: number; count: number; weighted: number | null };
export type LostRow = { reason: string; count: number; value: number };
export type PersonRow = {
  id: number;
  name: string;
  initials: string;
  role: string;
  region: string | null;
  open: number;
  value: number;
  weighted: number;
  visits: number;
  flags: { kind: FlagKey; label: string }[];
};

const weightOf = (d: Row<"deals">) => ((d.valuePkr ?? 0) * d.probability) / 100;
const sum = (list: Row<"deals">[], f: (d: Row<"deals">) => number = (d) => d.valuePkr ?? 0) => list.reduce((n, d) => n + f(d), 0);

/**
 * "In period" for Won, Win rate, Lost reasons and the Won/Lost rows of Pipeline by stage:
 * a deal counts when it was closed (moved to Won or Lost) inside the chosen range — its
 * closedAt, or stageEnteredAt for older rows without one. Open pipeline, weighted pipeline
 * and the flags are always "as of now", whatever the range.
 */
export async function getCockpit(now: Date, range: CockpitRange) {
  const base = await loadBase();
  const { L, deals, companies } = base;
  const db = store();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
  const [flags, visits7] = await Promise.all([computeFlags(base, now), db.list("visits", { where: { visitAt: { gte: weekAgo } } })]);

  const closedIn = (d: Row<"deals">) => {
    const at = d.closedAt ?? d.stageEnteredAt;
    return at >= range.from && at <= range.to;
  };
  const open = deals.filter((d) => isOpenStage(d.stage));
  const won = deals.filter((d) => d.stage === "won" && closedIn(d));
  const lost = deals.filter((d) => d.stage === "lost" && closedIn(d));
  const closedCount = won.length + lost.length;
  const winRate = closedCount ? Math.round((won.length / closedCount) * 100) : null;

  const owned = companies.filter((c) => c.ownerId).length;
  const visitors = new Set(visits7.map((v) => v.salespersonId));

  const stages: StageRow[] = STAGES.map((s) => {
    const list = isOpenStage(s.key) ? open.filter((d) => d.stage === s.key) : s.key === "won" ? won : lost;
    return { key: s.key, label: s.label, icon: s.icon, hue: s.hue, value: sum(list), count: list.length, weighted: isOpenStage(s.key) ? sum(list, weightOf) : null };
  });

  const known = new Set<string>(LOST_REASONS);
  const lostReasons: LostRow[] = LOST_REASONS.map((r) => {
    const list = lost.filter((d) => (known.has(d.lostReason ?? "") ? d.lostReason === r : r === "Other (specify)"));
    return { reason: r, count: list.length, value: sum(list) };
  }).sort((x, y) => y.value - x.value || y.count - x.count);

  const people: PersonRow[] = L.users
    .filter((u) => (u.role === "sales" || u.role === "manager") && u.isActive)
    .map((u) => {
      const mine = open.filter((d) => d.ownerId === u.id);
      const count = (k: FlagKey) => flags[k].filter((r) => r.ownerId === u.id).length;
      const f: PersonRow["flags"] = [];
      const ov = count("outcome");
      const st = count("stuck");
      const cp = count("close");
      const dm = count("dormant");
      if (ov) f.push({ kind: "outcome", label: `${ov} outcome` });
      if (st) f.push({ kind: "stuck", label: `${st} stuck` });
      if (cp) f.push({ kind: "close", label: `${cp} close` });
      if (dm) f.push({ kind: "dormant", label: `${dm} dormant` });
      return {
        id: u.id,
        name: u.name,
        initials: u.name
          .split(/\s+/)
          .slice(0, 2)
          .map((w) => w[0]?.toUpperCase() ?? "")
          .join(""),
        role: u.role === "manager" ? "Manager" : "Sales",
        region: u.region,
        open: mine.length,
        value: sum(mine),
        weighted: sum(mine, weightOf),
        visits: visits7.filter((v) => v.salespersonId === u.id).length,
        flags: f,
      };
    })
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name));

  return {
    kpis: {
      openValue: sum(open),
      openCount: open.length,
      weighted: sum(open, weightOf),
      wonValue: sum(won),
      wonCount: won.length,
      lostCount: lost.length,
      winRate,
      accounts: companies.length,
      owned,
      unassigned: companies.length - owned,
      visits7: visits7.length,
      visitors: visitors.size,
    },
    flagCounts: Object.fromEntries(FLAG_KEYS.map((k) => [k, flags[k].length])) as Record<FlagKey, number>,
    stages,
    lostReasons,
    lostTotal: { count: lost.length, value: sum(lost) },
    people,
  };
}

