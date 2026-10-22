import { getCurrentUser } from "@/lib/auth/dal";
import { buildXlsx, xlsxResponse } from "@/lib/excel";
import { requestNow } from "@/lib/queries/common";
import { listAccounts, parseAccountFilters, type AccountRow } from "@/lib/queries/accounts";

/** Excel export of the Accounts list, honouring the same filters as the page. */
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.mustChangePassword) return new Response("Sign in to export.", { status: 401 });
  if (user.isCeo) return new Response("Exports are available to Sales, Managers and Admins.", { status: 403 });

  const sp = Object.fromEntries(new URL(request.url).searchParams.entries());
  const { now } = await requestNow();
  const { rows } = await listAccounts(user, parseAccountFilters(sp, user), now);

  const statusLabel = { active: "Active", dormant: "Dormant", archived: "Archived" } as const;
  const buffer = await buildXlsx<AccountRow>(
    "Accounts",
    [
      { header: "Company", width: 36, value: (r) => r.name },
      { header: "Brand", width: 20, value: (r) => r.brand },
      { header: "Plant / site", width: 28, value: (r) => r.plantUnit },
      { header: "Parent group", width: 22, value: (r) => r.group },
      { header: "Sector", width: 24, value: (r) => r.sector },
      { header: "Sub-sector", width: 24, value: (r) => r.sub },
      { header: "City", width: 16, value: (r) => r.city },
      { header: "Priority", width: 9, value: (r) => r.priority },
      { header: "Lead source", width: 13, value: (r) => r.leadSource },
      { header: "Owner", width: 20, value: (r) => r.owner ?? "Unassigned" },
      { header: "Status", width: 11, value: (r) => statusLabel[r.status] },
      // Shifted to PKT so Excel (which ignores timezones) shows the Pakistan calendar date.
      { header: "Last visit", width: 13, numFmt: "dd mmm yyyy", value: (r) => (r.lastVisit ? new Date(r.lastVisit.getTime() + 5 * 3600_000) : null) },
      { header: "Days since visit", width: 15, value: (r) => r.days },
      { header: "Water need", width: 32, value: (r) => r.waterNeed },
      { header: "Est. capacity (MLD)", width: 18, numFmt: "0.000", value: (r) => r.capacityMld },
      { header: "Website", width: 24, value: (r) => r.website },
      { header: "Notes", width: 60, value: (r) => r.notes },
    ],
    rows,
  );
  return xlsxResponse(buffer, "accounts", rows.length);
}
