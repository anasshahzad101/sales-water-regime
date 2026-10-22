/**
 * Local-development store: keeps every table in ./.data/db.json.
 * Defaults and update timestamps come from the same schema the MySQL store uses.
 * Not for production — Vercel's filesystem is read-only and not shared between servers.
 */
import fs from "node:fs";
import path from "node:path";
import { getTableColumns } from "drizzle-orm";
import { TABLES } from "@/lib/db/schema";
import { isScalar, type NewRow, type Op, type Query, type Row, type Store, type TableName, type Where } from "./store";

type Data = { version: 1; seq: Partial<Record<TableName, number>>; tables: Partial<Record<TableName, Record<string, unknown>[]>> };

export const JSON_DB_FILE = process.env.JSON_DB_FILE || path.join(/*turbopackIgnore: true*/ process.cwd(), ".data", "db.json");

type ColumnMeta = {
  name: string;
  columnType: string;
  default?: unknown;
  defaultFn?: () => unknown;
  onUpdateFn?: () => unknown;
};
const columnsOf = (t: TableName) =>
  Object.entries(getTableColumns(TABLES[t])) as unknown as [string, ColumnMeta][];
const dateKeys = new Map<TableName, string[]>();
function dateColumns(t: TableName): string[] {
  if (!dateKeys.has(t)) dateKeys.set(t, columnsOf(t).filter(([, c]) => c.columnType === "MySqlDateTime").map(([k]) => k));
  return dateKeys.get(t)!;
}

function compare(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0;
  if (a == null) return -1;
  if (b == null) return 1;
  const av = a instanceof Date ? a.getTime() : a;
  const bv = b instanceof Date ? b.getTime() : b;
  if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv, "en", { sensitivity: "base" });
  return av < bv ? -1 : av > bv ? 1 : 0;
}
const same = (a: unknown, b: unknown) =>
  a instanceof Date || b instanceof Date ? compare(a, b) === 0 : typeof a === "string" && typeof b === "string" ? a.toLowerCase() === b.toLowerCase() : a === b;

const likeCache = new Map<string, RegExp>();
function likeRe(pattern: string): RegExp {
  let re = likeCache.get(pattern);
  if (!re) {
    let src = "";
    for (let i = 0; i < pattern.length; i++) {
      const ch = pattern[i];
      if (ch === "\\" && i + 1 < pattern.length) src += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      else if (ch === "%") src += ".*";
      else if (ch === "_") src += ".";
      else src += ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
    re = new RegExp(`^${src}$`, "is");
    likeCache.set(pattern, re);
  }
  return re;
}

function matchOp(value: unknown, op: Op<unknown>): boolean {
  if ("eq" in op && !(op.eq === null ? value == null : same(value, op.eq))) return false;
  if ("ne" in op && (op.ne === null ? value == null : same(value, op.ne))) return false;
  if (op.in && !op.in.some((x) => same(value, x))) return false;
  if (op.notIn && op.notIn.some((x) => same(value, x))) return false;
  if (op.gt !== undefined && !(value != null && compare(value, op.gt) > 0)) return false;
  if (op.gte !== undefined && !(value != null && compare(value, op.gte) >= 0)) return false;
  if (op.lt !== undefined && !(value != null && compare(value, op.lt) < 0)) return false;
  if (op.lte !== undefined && !(value != null && compare(value, op.lte) <= 0)) return false;
  if (op.like !== undefined && !(value != null && likeRe(op.like).test(String(value)))) return false;
  return true;
}

export function matches(row: Record<string, unknown>, where?: Where<Record<string, unknown>>): boolean {
  if (!where) return true;
  for (const [key, cond] of Object.entries(where)) {
    if (key === "$or") {
      const ors = cond as Where<Record<string, unknown>>[];
      if (ors.length && !ors.some((w) => matches(row, w))) return false;
      continue;
    }
    if (cond === undefined) continue;
    const value = row[key];
    if (isScalar(cond)) {
      if (cond === null ? value != null : !same(value, cond)) return false;
    } else if (!matchOp(value, cond as Op<unknown>)) return false;
  }
  return true;
}

export class JsonStore implements Store {
  readonly kind = "json" as const;
  private data: Data = { version: 1, seq: {}, tables: {} };
  private loadedMtime = -1;
  private writing: Promise<void> = Promise.resolve();

  private load() {
    let mtime = 0;
    try {
      mtime = fs.statSync(/*turbopackIgnore: true*/ JSON_DB_FILE).mtimeMs;
    } catch {
      mtime = 0;
    }
    if (mtime === this.loadedMtime) return;
    if (mtime === 0) {
      this.data = { version: 1, seq: {}, tables: {} };
    } else {
      const raw = JSON.parse(fs.readFileSync(/*turbopackIgnore: true*/ JSON_DB_FILE, "utf8")) as Data;
      for (const t of Object.keys(raw.tables) as TableName[]) {
        const keys = dateColumns(t);
        for (const row of raw.tables[t] ?? []) for (const k of keys) if (typeof row[k] === "string") row[k] = new Date(row[k] as string);
      }
      this.data = raw;
    }
    this.loadedMtime = mtime;
  }

  private persist() {
    const json = JSON.stringify(this.data);
    this.writing = this.writing.then(() => {
      fs.mkdirSync(/*turbopackIgnore: true*/ path.dirname(JSON_DB_FILE), { recursive: true });
      const tmp = `${JSON_DB_FILE}.${process.pid}.tmp`;
      fs.writeFileSync(/*turbopackIgnore: true*/ tmp, json);
      fs.renameSync(/*turbopackIgnore: true*/ tmp, JSON_DB_FILE);
      this.loadedMtime = fs.statSync(/*turbopackIgnore: true*/ JSON_DB_FILE).mtimeMs;
    });
    return this.writing;
  }

  private rows<T extends TableName>(t: T): Row<T>[] {
    this.load();
    return ((this.data.tables[t] ??= []) as unknown) as Row<T>[];
  }

  async list<T extends TableName>(t: T, q: Query<Row<T>> = {}): Promise<Row<T>[]> {
    let out = this.rows(t).filter((r) => matches(r as Record<string, unknown>, q.where as Where<Record<string, unknown>>));
    if (q.orderBy?.length) {
      const order = q.orderBy;
      out = [...out].sort((a, b) => {
        for (const [k, dir] of order) {
          const c = compare((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]);
          if (c) return dir === "desc" ? -c : c;
        }
        return 0;
      });
    }
    const start = q.offset ?? 0;
    out = q.limit != null ? out.slice(start, start + q.limit) : out.slice(start);
    return out.map((r) => ({ ...r }));
  }

  async first<T extends TableName>(t: T, q: Query<Row<T>> = {}) {
    return (await this.list(t, { ...q, limit: 1 }))[0];
  }

  async get<T extends TableName>(t: T, id: number) {
    const row = this.rows(t).find((r) => (r as { id: number }).id === id);
    return row ? { ...row } : undefined;
  }

  async count<T extends TableName>(t: T, where?: Where<Row<T>>) {
    return this.rows(t).filter((r) => matches(r as Record<string, unknown>, where as Where<Record<string, unknown>>)).length;
  }

  async insert<T extends TableName>(t: T, values: NewRow<T>): Promise<Row<T>> {
    const rows = this.rows(t);
    const row: Record<string, unknown> = {};
    for (const [key, col] of columnsOf(t)) {
      const v = (values as Record<string, unknown>)[key];
      if (v !== undefined) row[key] = v;
      else if (col.defaultFn) row[key] = col.defaultFn();
      else if (col.default !== undefined) row[key] = col.default;
      else row[key] = null;
    }
    if (row.id == null) {
      const highest = this.data.seq[t] ?? Math.max(0, ...rows.map((r) => (r as { id: number }).id));
      row.id = highest + 1;
    }
    this.data.seq[t] = Math.max(this.data.seq[t] ?? 0, row.id as number);
    rows.push(row as Row<T>);
    await this.persist();
    return { ...(row as Row<T>) };
  }

  private applyPatch<T extends TableName>(t: T, row: Record<string, unknown>, patch: Record<string, unknown>) {
    for (const [k, v] of Object.entries(patch)) if (v !== undefined) row[k] = v;
    for (const [key, col] of columnsOf(t)) if (col.onUpdateFn && patch[key] === undefined) row[key] = col.onUpdateFn();
  }

  async update<T extends TableName>(t: T, id: number, patch: Partial<NewRow<T>>) {
    const row = this.rows(t).find((r) => (r as { id: number }).id === id) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    this.applyPatch(t, row, patch as Record<string, unknown>);
    await this.persist();
    return { ...(row as Row<T>) };
  }

  async updateWhere<T extends TableName>(t: T, where: Where<Row<T>>, patch: Partial<NewRow<T>>) {
    const hit = this.rows(t).filter((r) => matches(r as Record<string, unknown>, where as Where<Record<string, unknown>>));
    for (const row of hit) this.applyPatch(t, row as Record<string, unknown>, patch as Record<string, unknown>);
    if (hit.length) await this.persist();
    return hit.length;
  }

  async remove<T extends TableName>(t: T, id: number) {
    const rows = this.rows(t);
    const i = rows.findIndex((r) => (r as { id: number }).id === id);
    if (i >= 0) {
      rows.splice(i, 1);
      await this.persist();
    }
  }

  async lastVisitByCompany(companyIds?: number[]) {
    const wanted = companyIds ? new Set(companyIds) : null;
    const out = new Map<number, Date>();
    for (const v of this.rows("visits")) {
      if (wanted && !wanted.has(v.companyId)) continue;
      const cur = out.get(v.companyId);
      if (!cur || v.visitAt > cur) out.set(v.companyId, v.visitAt);
    }
    return out;
  }

  async close() {
    await this.writing;
  }
}
