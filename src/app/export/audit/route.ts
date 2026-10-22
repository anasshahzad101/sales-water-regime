import { getCurrentUser } from "@/lib/auth/dal";
import { buildXlsx, xlsxResponse } from "@/lib/excel";
import { getAuditForExport, parseAuditFilters } from "@/lib/queries/admin";
import { requestNow } from "@/lib/queries/common";
import { fmtDate, fmtTime } from "@/lib/time";

/** Audit log as .xlsx, with the same filters as /admin/audit (admins only). */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return new Response("Sign in again.", { status: 401 });
  if (!user.isAdmin) return new Response("Only admins can export the audit log.", { status: 403 });
  const { now } = await requestNow();
  const sp = Object.fromEntries(new URL(request.url).searchParams.entries());
  const rows = await getAuditForExport(parseAuditFilters(sp), now);
  const buf = await buildXlsx(
    "Audit log",
    [
      { header: "Date", width: 14, value: (r) => fmtDate(r.row.createdAt) },
      { header: "Time (PKT)", width: 12, value: (r) => fmtTime(r.row.createdAt) },
      { header: "Who", width: 22, value: (r) => r.who },
      { header: "Entity", width: 12, value: (r) => r.row.entity },
      { header: "Record #", width: 10, value: (r) => r.row.entityId },
      { header: "Action", width: 18, value: (r) => r.row.action },
      { header: "Detail", width: 80, value: (r) => r.row.detail },
    ],
    rows,
  );
  return xlsxResponse(buf, "audit-log", rows.length);
}
