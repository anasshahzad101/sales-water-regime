import { getCurrentUser } from "@/lib/auth/dal";
import { stageOf } from "@/lib/constants";
import { store } from "@/lib/data/store";
import { buildXlsx, xlsxResponse } from "@/lib/excel";
import { daysInStage, isClosePassed, isStuck } from "@/lib/rules";
import { lookups } from "@/lib/queries/common";
import { filteredDeals, pulseFilters } from "@/lib/queries/deals";
import { pktDate } from "@/lib/time";

/** The Team Pulse deals, with the same filters as the board, as .xlsx. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return new Response("Sign in again.", { status: 401 });
  if (user.isCeo) return new Response("You don’t have access to Team Pulse.", { status: 403 });

  const sp = Object.fromEntries(new URL(request.url).searchParams.entries());
  const filters = pulseFilters(user, sp);
  const now = new Date();
  const today = pktDate(now);
  const [L, deals] = await Promise.all([lookups(), filteredDeals(user, filters)]);
  const ids = [...new Set(deals.map((d) => d.companyId))];
  const companies = new Map((ids.length ? await store().list("companies", { where: { id: { in: ids } } }) : []).map((c) => [c.id, c]));

  const buf = await buildXlsx(
    "Pipeline",
    [
      { header: "Deal", width: 44, value: (d) => d.title },
      { header: "Company", width: 36, value: (d) => companies.get(d.companyId)?.name },
      { header: "Stage", width: 20, value: (d) => stageOf(d.stage).label },
      { header: "Value (PKR)", width: 18, numFmt: "#,##0", value: (d) => d.valuePkr },
      { header: "Probability %", width: 14, value: (d) => d.probability },
      { header: "Weighted (PKR)", width: 18, numFmt: "#,##0", value: (d) => (d.valuePkr == null ? null : Math.round((d.valuePkr * d.probability) / 100)) },
      { header: "Solution", width: 11, value: (d) => d.solutionType },
      { header: "Owner", width: 20, value: (d) => (d.ownerId ? L.userById.get(d.ownerId)?.name : null) },
      { header: "Expected close", width: 15, value: (d) => d.expectedClose },
      { header: "Days in stage", width: 13, value: (d) => daysInStage(d.stageEnteredAt, now) },
      { header: "Stuck", width: 8, value: (d) => (isStuck(d, now) ? "Yes" : "") },
      { header: "Close passed", width: 13, value: (d) => (isClosePassed(d, today) ? "Yes" : "") },
      { header: "Lost reason", width: 26, value: (d) => d.lostReason },
    ],
    deals,
  );
  return xlsxResponse(buf, "pipeline", deals.length);
}
