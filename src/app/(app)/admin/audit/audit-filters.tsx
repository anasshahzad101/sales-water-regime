"use client";

import { SearchFilter, SelectFilter, useQuery, type Opt } from "@/components/ui/filters";

export function AuditFilterBar({
  q,
  user,
  entity,
  action,
  range,
  users,
  entities,
  actions,
  ranges,
}: {
  q: string;
  user: string;
  entity: string;
  action: string;
  range: string;
  users: Opt[];
  entities: Opt[];
  actions: Opt[];
  ranges: Opt[];
}) {
  const { set } = useQuery();
  const filtered = !!(q || user || entity || action || range);
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <SearchFilter value={q} placeholder="Search details, e.g. WR-P-2026 or Kohsar" className="flex-[1_1_100%] md:w-auto md:flex-[0_1_340px]" />
      <div className="grid w-full grid-cols-2 gap-2.5 md:contents">
        <SelectFilter param="user" value={user} options={users} allLabel="All users" label="User" />
        <SelectFilter param="entity" value={entity} options={entities} allLabel="All entities" label="Entity" />
        <SelectFilter param="action" value={action} options={actions} allLabel="All actions" label="Action" />
        <SelectFilter param="range" value={range} options={ranges} allLabel="Last 30 days" label="Date range" />
      </div>
      {filtered && (
        <button
          type="button"
          onClick={() => set({ q: null, user: null, entity: null, action: null, range: null })}
          className="h-9 rounded-full border-0 bg-transparent px-2.5 text-[13px] font-semibold text-link hover:underline"
        >
          Clear all
        </button>
      )}
    </div>
  );
}
