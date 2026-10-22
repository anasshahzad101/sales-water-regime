import { getCurrentUser } from "@/lib/auth/dal";
import { outcomeOf } from "@/lib/constants";
import { store } from "@/lib/data/store";
import { buildXlsx, xlsxResponse } from "@/lib/excel";
import { lookups } from "@/lib/queries/common";
import { parseVisitFilters, toVisitRows, visitWhere, type VisitRow } from "@/lib/queries/visits";
import { fmtCalendar, fmtDate, fmtTime } from "@/lib/time";

/** Visits on screen (same filters, no paging) as .xlsx. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return new Response("Sign in first.", { status: 401 });
  if (user.isCeo) return new Response("The CEO account opens visits from the Cockpit drill-downs.", { status: 403 });
  const sp = Object.fromEntries(new URL(request.url).searchParams);
  const f = parseVisitFilters(sp);
  const now = new Date();
  const where = await visitWhere(user, f, now);
  const visits = where ? await store().list("visits", { where, orderBy: [["visitAt", f.sort]], limit: 20_000 }) : [];
  const rows = await toVisitRows(visits, await lookups());
  const buf = await buildXlsx<VisitRow>(
    "Visits",
    [
      { header: "Date", width: 14, value: (r) => fmtDate(r.visitAt) },
      { header: "Time (PKT)", width: 11, value: (r) => fmtTime(r.visitAt) },
      { header: "Company", width: 36, value: (r) => r.company },
      { header: "Brand · plant · city", width: 32, value: (r) => r.sub },
      { header: "Type", width: 16, value: (r) => r.type },
      { header: "Salesperson", width: 18, value: (r) => r.person },
      { header: "Contact met", width: 22, value: (r) => r.contact },
      { header: "Outcome", width: 24, value: (r) => outcomeOf(r.outcome).label },
      { header: "Skip reason", width: 22, value: (r) => r.skipReason },
      { header: "Late reason", width: 30, value: (r) => r.lateReason },
      { header: "Discussion", width: 50, value: (r) => r.discussion },
      { header: "Next action", width: 30, value: (r) => r.next },
      { header: "Next action date", width: 15, value: (r) => (r.nextDate ? fmtCalendar(r.nextDate) : null) },
      { header: "Next action done", width: 12, value: (r) => (r.next ? (r.nextDone ? "Yes" : "No") : null) },
    ],
    rows,
  );
  return xlsxResponse(buf, "visits", rows.length);
}
