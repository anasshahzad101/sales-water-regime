import "server-only";
import type { CurrentUser } from "@/lib/auth/dal";
import { PRIORITIES } from "@/lib/constants";
import { store, type Row, type Where } from "@/lib/data/store";
import { initials } from "@/lib/format";
import { dormancy, displayStatus } from "@/lib/rules";
import { daysSince } from "@/lib/time";
import { companyLine, lookups, type Lookups } from "./common";

export const ACCOUNTS_PAGE_SIZE = 25;

type SP = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

export type AccountFilters = {
  q: string;
  sector: string;
  city: string;
  pri: string;
  owner: string;
  unassigned: boolean;
  dormant: boolean;
  scope: "mine" | "all";
  sort: "asc" | "desc";
  page: number;
  more: number;
};

/** Reads list filters from the URL. Scope defaults to My accounts for Sales, All for everyone else. */
export function parseAccountFilters(sp: SP, user: CurrentUser): AccountFilters {
  const scope = one(sp.scope);
  const pri = one(sp.pri);
  return {
    q: one(sp.q).trim().slice(0, 80),
    sector: /^\d+$/.test(one(sp.sector)) ? one(sp.sector) : "",
    city: /^\d+$/.test(one(sp.city)) ? one(sp.city) : "",
    pri: (PRIORITIES as readonly string[]).includes(pri) ? pri : "",
    owner: /^\d+$/.test(one(sp.owner)) ? one(sp.owner) : "",
    unassigned: one(sp.unassigned) === "1",
    dormant: one(sp.dormant) === "1",
    scope: scope === "mine" || scope === "all" ? scope : user.role === "sales" ? "mine" : "all",
    sort: one(sp.sort) === "desc" ? "desc" : "asc",
    page: Math.max(1, Number(one(sp.page)) || 1),
    more: Math.max(0, Math.min(40, Number(one(sp.more)) || 0)),
  };
}

export type AccountRow = {
  id: number;
  name: string;
  bp: string;
  brand: string | null;
  plantUnit: string | null;
  group: string | null;
  sector: string | null;
  sub: string | null;
  city: string | null;
  priority: string | null;
  leadSource: string | null;
  waterNeed: string | null;
  capacityMld: number | null;
  website: string | null;
  notes: string | null;
  ownerId: number | null;
  owner: string | null;
  ownerInitials: string;
  isMine: boolean;
  status: "active" | "dormant" | "archived";
  lastVisit: Date | null;
  days: number | null;
};

const escapeLike = (s: string) => s.replace(/[%_\\]/g, (m) => `\\${m}`);

function toRow(c: Row<"companies">, L: Lookups, user: CurrentUser, last: Date | null, now: Date): AccountRow {
  const owner = c.ownerId ? L.userById.get(c.ownerId) : undefined;
  const d = dormancy(c, last, now);
  return {
    id: c.id,
    name: c.name,
    bp: [c.brand, c.plantUnit].filter(Boolean).join(" · "),
    brand: c.brand,
    plantUnit: c.plantUnit,
    group: c.parentGroupId ? (L.groupById.get(c.parentGroupId)?.name ?? null) : null,
    sector: c.sectorId ? (L.sectorById.get(c.sectorId)?.name ?? null) : null,
    sub: c.subSectorId ? (L.subSectorById.get(c.subSectorId)?.name ?? null) : null,
    city: c.cityId ? (L.cityById.get(c.cityId)?.name ?? null) : null,
    priority: c.priority,
    leadSource: c.leadSource,
    waterNeed: c.waterNeed,
    capacityMld: c.capacityMld,
    website: c.website,
    notes: c.notes,
    ownerId: c.ownerId,
    owner: owner?.name ?? null,
    ownerInitials: owner ? initials(owner.name) : "",
    isMine: c.ownerId === user.id,
    status: displayStatus(c.status, d.dormant),
    lastVisit: last,
    days: last ? daysSince(last, now) : null,
  };
}

/** Filtered (unpaginated) account rows plus the reference data the filter bar needs. */
export async function listAccounts(user: CurrentUser, f: AccountFilters, now: Date) {
  const db = store();
  const where: Where<Row<"companies">> = {};
  if (f.scope === "mine") where.ownerId = user.id;
  if (f.owner) where.ownerId = f.scope === "mine" && Number(f.owner) !== user.id ? -1 : Number(f.owner);
  if (f.unassigned) where.ownerId = f.scope === "mine" || f.owner ? -1 : null;
  if (f.sector) where.sectorId = Number(f.sector);
  if (f.city) where.cityId = Number(f.city);
  if (f.pri) where.priority = f.pri;
  if (f.q) {
    const like = `%${escapeLike(f.q)}%`;
    where.$or = [{ name: { like } }, { brand: { like } }, { plantUnit: { like } }];
  }

  const [L, companies, total, unassigned, lastVisits] = await Promise.all([
    lookups(),
    db.list("companies", { where, orderBy: [["name", f.sort]] }),
    db.count("companies"),
    db.count("companies", { ownerId: null }),
    db.lastVisitByCompany(),
  ]);

  let rows = companies.map((c) => toRow(c, L, user, lastVisits.get(c.id) ?? null, now));
  if (f.dormant) rows = rows.filter((r) => r.status === "dormant");

  const owners = L.users.filter((u) => u.isActive && (u.role === "sales" || u.role === "manager"));
  return {
    rows,
    stats: { total, cities: L.cities.length, unassigned },
    options: {
      sectors: L.sectors.map((s) => ({ value: String(s.id), label: s.name })),
      cities: L.cities.map((c) => ({ value: String(c.id), label: c.name })),
      owners: owners.map((u) => ({ value: String(u.id), label: u.id === user.id ? `${u.name} (you)` : u.name })),
    },
    labels: {
      sector: f.sector ? L.sectorById.get(Number(f.sector))?.name : undefined,
      city: f.city ? L.cityById.get(Number(f.city))?.name : undefined,
      owner: f.owner ? L.userById.get(Number(f.owner))?.name : undefined,
    },
  };
}

/** Everything the account page shows. */
export async function getAccount(id: number, user: CurrentUser, now: Date) {
  const db = store();
  const company = await db.get("companies", id);
  if (!company) return null;
  const [L, contacts, deals, visits, lastMap] = await Promise.all([
    lookups(),
    db.list("contacts", { where: { companyId: id }, orderBy: [["isPrimary", "desc"], ["name", "asc"]] }),
    db.list("deals", { where: { companyId: id }, orderBy: [["updatedAt", "desc"]] }),
    db.list("visits", { where: { companyId: id }, orderBy: [["visitAt", "desc"]] }),
    db.lastVisitByCompany([id]),
  ]);
  const row = toRow(company, L, user, lastMap.get(id) ?? null, now);
  return {
    company,
    row,
    subline: companyLine(company, L),
    contacts,
    deals,
    visits: visits.map((v) => ({ ...v, who: L.userById.get(v.salespersonId)?.name ?? "—" })),
  };
}

// Words too common in company names to signal a duplicate on their own.
const STOPWORDS = new Set(
  "limited private pakistan company industries industry mills mill group textile textiles spinning weaving pharma pharmaceutical pharmaceuticals chemical chemicals foods food sugar steel cement power plant unit corporation international enterprises holdings".split(" "),
);

/** Up to 3 existing companies whose name, brand or group shares a distinctive word (4+ letters) with `name`. */
export async function findSimilarCompanies(name: string) {
  const all = [...new Set(name.toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4))];
  const words = (all.some((w) => !STOPWORDS.has(w)) ? all.filter((w) => !STOPWORDS.has(w)) : all).slice(0, 6);
  if (!words.length) return [];
  const db = store();
  const L = await lookups();
  const groupIds = L.groups.filter((g) => words.some((w) => g.name.toLowerCase().includes(w))).map((g) => g.id);
  const or: Where<Row<"companies">>[] = words.flatMap((w) => {
    const like = `%${escapeLike(w)}%`;
    return [{ name: { like } }, { brand: { like } }];
  });
  if (groupIds.length) or.push({ parentGroupId: { in: groupIds } });
  const candidates = await db.list("companies", { where: { $or: or }, orderBy: [["name", "asc"]], limit: 60 });
  const score = (c: Row<"companies">) => {
    const n = c.name.toLowerCase();
    const b = (c.brand ?? "").toLowerCase();
    const g = c.parentGroupId ? (L.groupById.get(c.parentGroupId)?.name ?? "").toLowerCase() : "";
    return words.reduce((s, w) => s + (n.includes(w) ? 3 + (n.startsWith(w) ? 1 : 0) : 0) + (b.includes(w) ? 2 : 0) + (g.includes(w) ? 2 : 0), 0);
  };
  const hits = candidates
    .map((c) => ({ c, s: score(c) }))
    .sort((x, y) => y.s - x.s || x.c.name.localeCompare(y.c.name))
    .slice(0, 3)
    .map((x) => x.c);
  return hits.map((c) => {
    const owner = c.ownerId ? L.userById.get(c.ownerId)?.name : null;
    return { id: c.id, name: c.name, sub: [companyLine(c, L), `owner ${owner ?? "unassigned"}`].filter(Boolean).join(" · ") };
  });
}

export async function addCompanyOptions() {
  const L = await lookups();
  return {
    sectors: L.sectors.map((s) => ({ id: s.id, name: s.name })),
    subSectors: L.subSectors.map((s) => ({ id: s.id, name: s.name, sectorId: s.sectorId })),
    cities: L.cities.map((c) => ({ id: c.id, name: c.name })),
  };
}
