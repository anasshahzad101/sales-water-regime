/**
 * Database schema (MySQL / MariaDB).
 *
 * This file is the single definition of every table. The live site uses it through
 * Drizzle against Hostinger MariaDB; the local JSON store reuses the same column
 * names and defaults so both behave alike.
 *
 * All timestamps are stored as UTC DATETIME(3); dates without a time are YYYY-MM-DD strings.
 */
import {
  boolean,
  date,
  datetime,
  decimal,
  index,
  int,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

const now = () => new Date();
const ts = (name: string) => datetime(name, { mode: "date", fsp: 3 });
const created = () => ts("created_at").notNull().$defaultFn(now);
const updated = () => ts("updated_at").notNull().$defaultFn(now).$onUpdateFn(now);
const money = (name: string) => decimal(name, { precision: 16, scale: 2, mode: "number" });

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 160 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 120 }).notNull(),
  role: varchar("role", { length: 16 }).notNull().default("sales"),
  region: varchar("region", { length: 80 }),
  isActive: boolean("is_active").notNull().default(true),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  // Bumped on password change/reset, role change or deactivation so old sessions stop working.
  sessionVersion: int("session_version").notNull().default(1),
  failedAttempts: int("failed_attempts").notNull().default(0),
  lockedUntil: ts("locked_until"),
  lastLoginAt: ts("last_login_at"),
  createdAt: created(),
});

export const sectors = mysqlTable("sectors", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull().unique(),
});

export const subSectors = mysqlTable(
  "sub_sectors",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    sectorId: int("sector_id")
      .notNull()
      .references(() => sectors.id, { onDelete: "cascade" }),
  },
  (t) => [uniqueIndex("uq_sub_sector").on(t.sectorId, t.name)],
);

export const cities = mysqlTable("cities", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 120 }).notNull().unique(),
  province: varchar("province", { length: 80 }),
});

export const parentGroups = mysqlTable("parent_groups", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 200 }).notNull().unique(),
});

export const companies = mysqlTable(
  "companies",
  {
    id: int("id").autoincrement().primaryKey(),
    name: varchar("name", { length: 240 }).notNull(),
    brand: varchar("brand", { length: 240 }),
    plantUnit: varchar("plant_unit", { length: 240 }),
    parentGroupId: int("parent_group_id").references(() => parentGroups.id, { onDelete: "set null" }),
    sectorId: int("sector_id").references(() => sectors.id, { onDelete: "set null" }),
    subSectorId: int("sub_sector_id").references(() => subSectors.id, { onDelete: "set null" }),
    cityId: int("city_id").references(() => cities.id, { onDelete: "set null" }),
    priority: varchar("priority", { length: 4 }),
    leadSource: varchar("lead_source", { length: 40 }),
    waterNeed: text("water_need"),
    capacityMld: decimal("capacity_mld", { precision: 10, scale: 3, mode: "number" }),
    website: varchar("website", { length: 240 }),
    notes: text("notes"),
    // active / archived — "dormant" is derived from visit history, see lib/rules.ts
    status: varchar("status", { length: 16 }).notNull().default("active"),
    ownerId: int("owner_id").references(() => users.id, { onDelete: "set null" }),
    ownerSince: ts("owner_since"),
    createdById: int("created_by_id").references(() => users.id, { onDelete: "set null" }),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    index("ix_company_name").on(t.name),
    index("ix_company_owner").on(t.ownerId),
    index("ix_company_sector").on(t.sectorId),
    index("ix_company_city").on(t.cityId),
  ],
);

export const contacts = mysqlTable(
  "contacts",
  {
    id: int("id").autoincrement().primaryKey(),
    companyId: int("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 160 }).notNull(),
    title: varchar("title", { length: 160 }),
    email: varchar("email", { length: 160 }),
    phone: varchar("phone", { length: 60 }),
    linkedin: varchar("linkedin", { length: 240 }),
    isPrimary: boolean("is_primary").notNull().default(false),
    verified: boolean("verified").notNull().default(false),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("ix_contact_company").on(t.companyId)],
);

export const deals = mysqlTable(
  "deals",
  {
    id: int("id").autoincrement().primaryKey(),
    title: varchar("title", { length: 240 }).notNull(),
    companyId: int("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    ownerId: int("owner_id").references(() => users.id, { onDelete: "set null" }),
    stage: varchar("stage", { length: 16 }).notNull().default("lead"),
    stageEnteredAt: ts("stage_entered_at").notNull().$defaultFn(now),
    // Stage before the latest change — lets "Undo" restore it.
    previousStage: varchar("previous_stage", { length: 16 }),
    previousStageEnteredAt: ts("previous_stage_entered_at"),
    solutionType: varchar("solution_type", { length: 16 }),
    valuePkr: money("value_pkr"),
    probability: int("probability").notNull().default(10),
    expectedClose: date("expected_close", { mode: "string" }),
    lostReason: varchar("lost_reason", { length: 80 }),
    lostNote: text("lost_note"),
    notes: text("notes"),
    closedAt: ts("closed_at"),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [
    index("ix_deal_company").on(t.companyId),
    index("ix_deal_owner").on(t.ownerId),
    index("ix_deal_stage").on(t.stage),
  ],
);

export const visits = mysqlTable(
  "visits",
  {
    id: int("id").autoincrement().primaryKey(),
    companyId: int("company_id")
      .notNull()
      .references(() => companies.id, { onDelete: "cascade" }),
    dealId: int("deal_id").references(() => deals.id, { onDelete: "set null" }),
    salespersonId: int("salesperson_id")
      .notNull()
      .references(() => users.id),
    visitType: varchar("visit_type", { length: 32 }).notNull().default("Visit"),
    visitAt: ts("visit_at").notNull(),
    contactMet: varchar("contact_met", { length: 240 }),
    discussion: text("discussion"),
    outcome: varchar("outcome", { length: 16 }).notNull().default("pending"),
    skipReason: varchar("skip_reason", { length: 80 }),
    lateReason: text("late_reason"),
    outcomeNote: text("outcome_note"),
    outcomeSetAt: ts("outcome_set_at"),
    nextAction: varchar("next_action", { length: 240 }),
    nextActionDate: date("next_action_date", { mode: "string" }),
    nextActionDoneAt: ts("next_action_done_at"),
    createdAt: created(),
  },
  (t) => [
    index("ix_visit_company").on(t.companyId),
    index("ix_visit_salesperson").on(t.salespersonId, t.outcome),
    index("ix_visit_deal").on(t.dealId),
    index("ix_visit_at").on(t.visitAt),
  ],
);

export const proposals = mysqlTable(
  "proposals",
  {
    id: int("id").autoincrement().primaryKey(),
    dealId: int("deal_id")
      .notNull()
      .references(() => deals.id, { onDelete: "cascade" }),
    reference: varchar("reference", { length: 80 }),
    submittedOn: date("submitted_on", { mode: "string" }),
    amountPkr: money("amount_pkr"),
    status: varchar("status", { length: 16 }).notNull().default("Submitted"),
    notes: text("notes"),
    createdAt: created(),
    updatedAt: updated(),
  },
  (t) => [index("ix_proposal_deal").on(t.dealId)],
);

export const auditLog = mysqlTable(
  "audit_log",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("user_id").references(() => users.id, { onDelete: "set null" }),
    entity: varchar("entity", { length: 24 }).notNull(),
    entityId: int("entity_id"),
    action: varchar("action", { length: 40 }).notNull(),
    detail: text("detail"),
    createdAt: created(),
  },
  (t) => [index("ix_audit_created").on(t.createdAt), index("ix_audit_entity").on(t.entity, t.entityId)],
);

export const TABLES = {
  users,
  sectors,
  subSectors,
  cities,
  parentGroups,
  companies,
  contacts,
  deals,
  visits,
  proposals,
  auditLog,
} as const;
