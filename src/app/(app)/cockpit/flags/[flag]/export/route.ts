import { getCurrentUser } from "@/lib/auth/dal";
import { buildXlsx, xlsxResponse } from "@/lib/excel";
import { FLAG_DEFS, FLAG_KEYS, getFlagDrill, type DrillRow, type FlagKey } from "@/lib/queries/cockpit";

/** Downloads the drill-down list on screen as .xlsx. */
export async function GET(_request: Request, { params }: { params: Promise<{ flag: string }> }) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return new Response("Not signed in", { status: 401 });
  const { flag } = await params;
  if (!FLAG_KEYS.includes(flag as FlagKey)) return new Response("Unknown flag", { status: 404 });
  const def = FLAG_DEFS[flag as FlagKey];
  const { rows } = await getFlagDrill(flag as FlagKey, new Date());
  const buffer = await buildXlsx<DrillRow>(
    def.title,
    [
      { header: def.c1, width: 40, value: (r) => r.a },
      { header: "Detail", width: 36, value: (r) => r.a2 },
      { header: def.c2, width: 26, value: (r) => r.b },
      { header: "Owner", width: 22, value: (r) => r.owner },
      { header: def.c4, width: 22, value: (r) => r.d },
    ],
    rows,
  );
  return xlsxResponse(buffer, def.title.replace(/ /g, "-"), rows.length);
}
