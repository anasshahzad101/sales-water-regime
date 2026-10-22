import "server-only";
import { AUDIT_ENTITIES, roleLabel } from "@/lib/constants";
import { store, type Row, type Where } from "@/lib/data/store";
import { initials } from "@/lib/format";
import { addDays, fmtDate, fmtTime, pktDate } from "@/lib/time";

// ---------------------------------------------------------------- users

export type AdminUserRow = {
  id: number;
  name: string;
  email: string;
  initials: string;
  role: string;
  roleLabel: string;
  region: string | null;
  isActive: boolean;
  created: string;
  lastLogin: string | null;
  mustChangePassword: boolean;
  isMe: boolean;
};

/** Regions offered when adding a user (plus any already in use). */
export const BASE_REGIONS = ["Lahore", "Karachi", "Islamabad", "Faisalabad", "Multan", "Head office"];

export async function getAdminUsers(meId: number) {
  const users = await store().list("users", { orderBy: [["name", "asc"]] });
  const rows: AdminUserRow[] = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    initials: initials(u.name),
    role: u.role,
    roleLabel: roleLabel(u.role),
    region: u.region,
    isActive: u.isActive,
    created: fmtDate(u.createdAt),
    lastLogin: u.lastLoginAt ? fmtDate(u.lastLoginAt) : null,
    mustChangePassword: u.mustChangePassword,
    isMe: u.id === meId,
  }));
  const regions = [...new Set([...BASE_REGIONS, ...users.map((u) => u.region).filter((r): r is string => !!r)])];
  return { rows, regions, activeCount: users.filter((u) => u.isActive).length };
}

// ---------------------------------------------------------------- audit log

/** Actions recorded across the app, offered in the Action filter. */
export const AUDIT_ACTIONS = [
  "created",
  "updated",
  "deleted",
  "stage changed",
  "stage change undone",
  "claimed",
  "outcome set",
  "outcome undone",
  "status changed",
  "next action done",
  "next action reopened",
  "role changed",
  "password reset",
  "password set",
  "password changed",
  "activated",
  "deactivated",
  "sign-in locked",
] as const;

export const AUDIT_RANGES = [
  { value: "7", label: "Last 7 days" },
  { value: "q", label: "This quarter" },
  { value: "all", label: "All time" },
] as const; // "" (default) = last 30 days

export type AuditFilters = { q: string; user: string; entity: string; action: string; range: string };

export function parseAuditFilters(sp: Record<string, string | string[] | undefined>): AuditFilters & { page: number } {
  const s = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");
  const entity = s("entity");
  const range = s("range");
  return {
    q: s("q").slice(0, 80),
    user: /^\d+$/.test(s("user")) ? s("user") : "",
    entity: (AUDIT_ENTITIES as readonly string[]).includes(entity) ? entity : "",
    action: s("action").slice(0, 40),
    range: ["7", "q", "all"].includes(range) ? range : "",
    page: Math.max(1, Number(s("page")) || 1),
  };
}

/** Start of the selected range (PKT calendar), or null for all time. */
function rangeStart(range: string, now: Date): Date | null {
  const today = pktDate(now);
  if (range === "all") return null;
  if (range === "7") return new Date(`${addDays(today, -6)}T00:00:00+05:00`);
  if (range === "q") {
    const [y, m] = today.split("-").map(Number);
    const qm = Math.floor((m - 1) / 3) * 3 + 1;
    return new Date(`${y}-${String(qm).padStart(2, "0")}-01T00:00:00+05:00`);
  }
  return new Date(`${addDays(today, -29)}T00:00:00+05:00`);
}

async function auditWhere(f: AuditFilters, now: Date): Promise<Where<Row<"auditLog">>> {
  const where: Where<Row<"auditLog">> = {};
  if (f.user) where.userId = Number(f.user);
  if (f.entity) where.entity = f.entity;
  if (f.action) where.action = f.action;
  const start = rangeStart(f.range, now);
  if (start) where.createdAt = { gte: start };
  if (f.q) {
    const like = `%${f.q.replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
    const people = await store().list("users", { where: { name: { like } } });
    where.$or = [{ detail: { like } }, ...(people.length ? [{ userId: { in: people.map((p) => p.id) } }] : [])];
  }
  return where;
}

export type AuditEntryView = {
  id: number;
  day: string;
  time: string;
  who: string;
  initials: string;
  entity: string;
  action: string;
  detail: string;
};

export function toView(e: Row<"auditLog">, userById: Map<number, Row<"users">>): AuditEntryView {
  const u = e.userId ? userById.get(e.userId) : undefined;
  const who = u?.name ?? "System";
  return {
    id: e.id,
    day: pktDate(e.createdAt),
    time: `${fmtTime(e.createdAt)} PKT`,
    who,
    initials: u ? initials(u.name) : "S",
    entity: e.entity,
    action: e.action,
    detail: e.detail ?? "",
  };
}

export const AUDIT_PAGE_SIZE = 50;

export async function getAuditPage(f: AuditFilters, page: number, now: Date) {
  const db = store();
  const where = await auditWhere(f, now);
  const [total, rows, users] = await Promise.all([
    db.count("auditLog", where),
    db.list("auditLog", {
      where,
      orderBy: [
        ["createdAt", "desc"],
        ["id", "desc"],
      ],
      limit: AUDIT_PAGE_SIZE,
      offset: (page - 1) * AUDIT_PAGE_SIZE,
    }),
    db.list("users", { orderBy: [["name", "asc"]] }),
  ]);
  const userById = new Map(users.map((u) => [u.id, u]));
  return { total, entries: rows.map((e) => toView(e, userById)), users: users.map((u) => ({ id: u.id, name: u.name })) };
}

/** Every entry matching the filters (capped) — for the Excel export. */
export async function getAuditForExport(f: AuditFilters, now: Date) {
  const db = store();
  const where = await auditWhere(f, now);
  const [rows, users] = await Promise.all([
    db.list("auditLog", {
      where,
      orderBy: [
        ["createdAt", "desc"],
        ["id", "desc"],
      ],
      limit: 20_000,
    }),
    db.list("users"),
  ]);
  const userById = new Map(users.map((u) => [u.id, u]));
  return rows.map((e) => ({ row: e, who: (e.userId && userById.get(e.userId)?.name) || "System" }));
}
