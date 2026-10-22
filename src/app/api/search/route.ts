import { getCurrentUser } from "@/lib/auth/dal";
import { stageOf } from "@/lib/constants";
import { store } from "@/lib/data/store";
import { lookups } from "@/lib/queries/common";

/** Global search: companies (name, brand, plant) and deals (title). */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return Response.json({ error: "Not signed in" }, { status: 401 });

  const q = (new URL(request.url).searchParams.get("q") ?? "").trim().slice(0, 80);
  if (q.length < 2) return Response.json({ hits: [] });
  const like = `%${q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;

  const db = store();
  const [L, companies, deals] = await Promise.all([
    lookups(),
    db.list("companies", {
      where: { $or: [{ name: { like } }, { brand: { like } }, { plantUnit: { like } }] },
      orderBy: [["name", "asc"]],
      limit: 8,
    }),
    db.list("deals", { where: { title: { like } }, orderBy: [["updatedAt", "desc"]], limit: 6 }),
  ]);
  const dealCompanies = await Promise.all(deals.map((d) => db.get("companies", d.companyId)));

  const hits = [
    ...companies.map((c) => ({
      type: "company" as const,
      id: c.id,
      title: c.name,
      sub: [c.brand, c.plantUnit, c.cityId ? L.cityById.get(c.cityId)?.name : null, c.sectorId ? L.sectorById.get(c.sectorId)?.name : null]
        .filter(Boolean)
        .join(" · ") || "Company",
      href: `/accounts/${c.id}`,
    })),
    ...deals.map((d, i) => ({
      type: "deal" as const,
      id: d.id,
      title: d.title,
      sub: `${dealCompanies[i]?.name ?? "—"} · ${stageOf(d.stage).label}`,
      href: `/deals/${d.id}`,
    })),
  ];
  return Response.json({ hits });
}
