import "server-only";
import { connection } from "next/server";
import { cache } from "react";
import { OUTCOME_GRACE_HOURS } from "@/lib/constants";
import { store, type Row } from "@/lib/data/store";
import { pktDate } from "@/lib/time";

/** Request time — call after any runtime API so pages render with a fresh clock. */
export async function requestNow() {
  await connection();
  const now = new Date();
  return { now, today: pktDate(now) };
}

/** Small reference tables, loaded once per request. */
export const lookups = cache(async () => {
  const db = store();
  const [users, sectors, subSectors, cities, groups] = await Promise.all([
    db.list("users", { orderBy: [["name", "asc"]] }),
    db.list("sectors", { orderBy: [["name", "asc"]] }),
    db.list("subSectors", { orderBy: [["name", "asc"]] }),
    db.list("cities", { orderBy: [["name", "asc"]] }),
    db.list("parentGroups", { orderBy: [["name", "asc"]] }),
  ]);
  return {
    users,
    sectors,
    subSectors,
    cities,
    groups,
    userById: new Map(users.map((u) => [u.id, u])),
    sectorById: new Map(sectors.map((s) => [s.id, s])),
    subSectorById: new Map(subSectors.map((s) => [s.id, s])),
    cityById: new Map(cities.map((c) => [c.id, c])),
    groupById: new Map(groups.map((g) => [g.id, g])),
  };
});

export type Lookups = Awaited<ReturnType<typeof lookups>>;

/** Pending-outcome badge for the menu: total waiting and how many are past 48 hours. */
export async function outcomeBadge(userId: number, now: Date) {
  const db = store();
  const cutoff = new Date(now.getTime() - OUTCOME_GRACE_HOURS * 3600_000);
  const [count, overdue] = await Promise.all([
    db.count("visits", { salespersonId: userId, outcome: "pending" }),
    db.count("visits", { salespersonId: userId, outcome: "pending", visitAt: { lt: cutoff } }),
  ]);
  return { count, overdue };
}

/** "Lyallpur Denim Mills" plus "LDM Denim · Plant 2 · Faisalabad" style detail line. */
export function companyLine(c: Row<"companies">, L: Lookups) {
  const city = c.cityId ? L.cityById.get(c.cityId)?.name : null;
  // The imported site text often already names the city ("Sundar Industrial Estate, Lahore").
  const showCity = city && !(c.plantUnit ?? "").toLowerCase().includes(city.toLowerCase());
  return [c.brand, c.plantUnit, showCity ? city : null].filter(Boolean).join(" · ");
}
