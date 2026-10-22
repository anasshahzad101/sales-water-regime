/**
 * Storage layer. All app code reads and writes through `store()`; it never talks to a
 * database directly. Two back ends implement the same interface:
 *
 *   - MySQL / MariaDB (Hostinger) when DATABASE_URL or DB_HOST is set — the live site.
 *   - A JSON file at ./.data/db.json otherwise — local development only.
 */
import type { TABLES } from "@/lib/db/schema";

export type TableName = keyof typeof TABLES;
export type Row<T extends TableName> = (typeof TABLES)[T]["$inferSelect"];
export type NewRow<T extends TableName> = (typeof TABLES)[T]["$inferInsert"];

type Scalar = string | number | boolean | Date | null;
export type Op<V> = {
  eq?: V | null;
  ne?: V | null;
  in?: V[];
  notIn?: V[];
  gt?: V;
  gte?: V;
  lt?: V;
  lte?: V;
  /** SQL LIKE pattern, case-insensitive (`%` = any text). */
  like?: string;
};
export type Where<R> = {
  [K in keyof R]?: R[K] | null | Op<NonNullable<R[K]>>;
} & {
  /** Any of these sub-filters must match. */
  $or?: Where<R>[];
};
export type Order<R> = [keyof R & string, "asc" | "desc"];
export type Query<R> = { where?: Where<R>; orderBy?: Order<R>[]; limit?: number; offset?: number };

export interface Store {
  readonly kind: "mysql" | "json";
  list<T extends TableName>(table: T, q?: Query<Row<T>>): Promise<Row<T>[]>;
  first<T extends TableName>(table: T, q?: Query<Row<T>>): Promise<Row<T> | undefined>;
  get<T extends TableName>(table: T, id: number): Promise<Row<T> | undefined>;
  count<T extends TableName>(table: T, where?: Where<Row<T>>): Promise<number>;
  insert<T extends TableName>(table: T, values: NewRow<T>): Promise<Row<T>>;
  update<T extends TableName>(table: T, id: number, patch: Partial<NewRow<T>>): Promise<Row<T> | undefined>;
  updateWhere<T extends TableName>(table: T, where: Where<Row<T>>, patch: Partial<NewRow<T>>): Promise<number>;
  remove<T extends TableName>(table: T, id: number): Promise<void>;
  /** Latest visit time per company (optionally only for the given ids). */
  lastVisitByCompany(companyIds?: number[]): Promise<Map<number, Date>>;
  close(): Promise<void>;
}

export const isScalar = (v: unknown): v is Scalar =>
  v === null || v instanceof Date || ["string", "number", "boolean"].includes(typeof v);

export function usesMysql(): boolean {
  return !!(process.env.DATABASE_URL || process.env.DB_HOST);
}

const g = globalThis as unknown as { __wrStore?: Store };

export function store(): Store {
  if (g.__wrStore) return g.__wrStore;
  if (usesMysql()) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { MysqlStore } = require("./mysql-store") as typeof import("./mysql-store");
    g.__wrStore = new MysqlStore();
  } else {
    if (process.env.VERCEL) {
      throw new Error("DATABASE_URL (or DB_HOST, DB_USER, DB_PASSWORD, DB_NAME) must be set on Vercel.");
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { JsonStore } = require("./json-store") as typeof import("./json-store");
    g.__wrStore = new JsonStore();
  }
  return g.__wrStore;
}

export async function closeStore() {
  if (g.__wrStore) await g.__wrStore.close();
  g.__wrStore = undefined;
}
