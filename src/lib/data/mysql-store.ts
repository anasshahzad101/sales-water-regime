/**
 * Live store: MySQL / MariaDB (Hostinger) through Drizzle + mysql2.
 *
 * Configure with either
 *   DATABASE_URL=mysql://USER:PASSWORD@HOST:3306/DATABASE   (URL-encode special characters)
 * or the separate DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME variables.
 * Optional: DB_SSL=true, DATABASE_POOL_MAX (default 3 — shared hosting limits connections).
 */
import { and, asc, count as countFn, desc, eq, getTableColumns, gt, gte, inArray, isNotNull, isNull, like, lt, lte, max, ne, not, or, sql, type SQL } from "drizzle-orm";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import type { MySqlColumn, MySqlTable } from "drizzle-orm/mysql-core";
import mysql from "mysql2/promise";
import * as schema from "@/lib/db/schema";
import { TABLES } from "@/lib/db/schema";
import { isScalar, type NewRow, type Op, type Query, type Row, type Store, type TableName, type Where } from "./store";

export function mysqlPoolOptions(): mysql.PoolOptions {
  const common: mysql.PoolOptions = {
    connectionLimit: Number(process.env.DATABASE_POOL_MAX ?? 3),
    waitForConnections: true,
    maxIdle: 1,
    idleTimeout: 30_000,
    enableKeepAlive: true,
    timezone: "Z",
    charset: "utf8mb4",
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  };
  if (process.env.DATABASE_URL) return { ...common, uri: process.env.DATABASE_URL };
  return {
    ...common,
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  };
}

type AnyTable = MySqlTable & { id: MySqlColumn };

export class MysqlStore implements Store {
  readonly kind = "mysql" as const;
  readonly pool: mysql.Pool;
  readonly db: MySql2Database<typeof schema>;

  constructor() {
    this.pool = mysql.createPool(mysqlPoolOptions());
    if (process.env.VERCEL) {
      // Lets Vercel close idle connections before a function instance is suspended.
      // It recognises mysql2's core pool, which the promise wrapper keeps in `.pool`.
      // Only an optimisation, so it must never stop the app (or a build script) from starting.
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { attachDatabasePool } = require("@vercel/functions") as typeof import("@vercel/functions");
        attachDatabasePool((this.pool as unknown as { pool: Parameters<typeof attachDatabasePool>[0] }).pool);
      } catch (e) {
        console.warn("attachDatabasePool skipped:", e instanceof Error ? e.message : e);
      }
    }
    this.db = drizzle(this.pool, { schema, mode: "default" });
  }

  private table(t: TableName): AnyTable {
    return TABLES[t] as unknown as AnyTable;
  }

  private cols(t: TableName): Record<string, MySqlColumn> {
    return getTableColumns(this.table(t)) as Record<string, MySqlColumn>;
  }

  private cond(t: TableName, where?: Where<Record<string, unknown>>): SQL | undefined {
    if (!where) return undefined;
    const cols = this.cols(t);
    const parts: (SQL | undefined)[] = [];
    for (const [key, c] of Object.entries(where)) {
      if (c === undefined) continue;
      if (key === "$or") {
        const subs = (c as Where<Record<string, unknown>>[]).map((w) => this.cond(t, w)).filter(Boolean) as SQL[];
        if (subs.length) parts.push(or(...subs));
        continue;
      }
      const col = cols[key];
      if (!col) throw new Error(`Unknown column ${t}.${key}`);
      if (isScalar(c)) {
        parts.push(c === null ? isNull(col) : eq(col, c));
        continue;
      }
      const op = c as Op<unknown>;
      if ("eq" in op) parts.push(op.eq === null ? isNull(col) : eq(col, op.eq));
      if ("ne" in op) parts.push(op.ne === null ? isNotNull(col) : or(ne(col, op.ne), isNull(col)));
      if (op.in) parts.push(op.in.length ? inArray(col, op.in) : sql`false`);
      if (op.notIn && op.notIn.length) parts.push(or(not(inArray(col, op.notIn)), isNull(col)));
      if (op.gt !== undefined) parts.push(gt(col, op.gt));
      if (op.gte !== undefined) parts.push(gte(col, op.gte));
      if (op.lt !== undefined) parts.push(lt(col, op.lt));
      if (op.lte !== undefined) parts.push(lte(col, op.lte));
      if (op.like !== undefined) parts.push(like(col, op.like));
    }
    const real = parts.filter(Boolean) as SQL[];
    return real.length ? and(...real) : undefined;
  }

  async list<T extends TableName>(t: T, q: Query<Row<T>> = {}): Promise<Row<T>[]> {
    const table = this.table(t);
    const cols = this.cols(t);
    let query = this.db
      .select()
      .from(table)
      .where(this.cond(t, q.where as Where<Record<string, unknown>>))
      .$dynamic();
    if (q.orderBy?.length) query = query.orderBy(...q.orderBy.map(([k, d]) => (d === "desc" ? desc(cols[k]) : asc(cols[k]))));
    if (q.limit != null) query = query.limit(q.limit);
    if (q.offset) query = query.offset(q.offset);
    return (await query) as Row<T>[];
  }

  async first<T extends TableName>(t: T, q: Query<Row<T>> = {}) {
    return (await this.list(t, { ...q, limit: 1 }))[0];
  }

  async get<T extends TableName>(t: T, id: number) {
    const table = this.table(t);
    const rows = await this.db.select().from(table).where(eq(table.id, id)).limit(1);
    return rows[0] as Row<T> | undefined;
  }

  async count<T extends TableName>(t: T, where?: Where<Row<T>>) {
    const [r] = await this.db
      .select({ n: countFn() })
      .from(this.table(t))
      .where(this.cond(t, where as Where<Record<string, unknown>>));
    return Number(r?.n ?? 0);
  }

  async insert<T extends TableName>(t: T, values: NewRow<T>): Promise<Row<T>> {
    const table = this.table(t);
    const [res] = await this.db.insert(table).values(values as never).$returningId();
    const id = (res as { id: number }).id;
    return (await this.get(t, id))!;
  }

  async update<T extends TableName>(t: T, id: number, patch: Partial<NewRow<T>>) {
    const table = this.table(t);
    if (Object.keys(patch).length) await this.db.update(table).set(patch as never).where(eq(table.id, id));
    return this.get(t, id);
  }

  async updateWhere<T extends TableName>(t: T, where: Where<Row<T>>, patch: Partial<NewRow<T>>) {
    const table = this.table(t);
    const [res] = await this.db
      .update(table)
      .set(patch as never)
      .where(this.cond(t, where as Where<Record<string, unknown>>));
    return (res as unknown as { affectedRows?: number }).affectedRows ?? 0;
  }

  async remove<T extends TableName>(t: T, id: number) {
    const table = this.table(t);
    await this.db.delete(table).where(eq(table.id, id));
  }

  async lastVisitByCompany(companyIds?: number[]) {
    const v = schema.visits;
    const rows = await this.db
      .select({ companyId: v.companyId, last: max(v.visitAt) })
      .from(v)
      .where(companyIds ? (companyIds.length ? inArray(v.companyId, companyIds) : sql`false`) : undefined)
      .groupBy(v.companyId);
    const out = new Map<number, Date>();
    for (const r of rows) {
      if (!r.last) continue;
      // MAX() comes back as text; DATETIME values are stored as UTC.
      const raw = r.last as unknown as string | Date;
      out.set(r.companyId, raw instanceof Date ? raw : new Date(`${String(raw).replace(" ", "T")}Z`));
    }
    return out;
  }

  async close() {
    await this.pool.end();
  }
}
