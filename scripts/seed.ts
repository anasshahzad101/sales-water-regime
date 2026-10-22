/**
 * Loads the starting data.
 *
 *   npm run db:seed            → Excel target accounts + WR pipeline + starting user accounts
 *   npm run db:seed -- --demo  → also adds sample salespeople, contacts, deals, visits and proposals
 *                                (local testing only — never run --demo against the live database)
 *
 * Writes to MySQL when DATABASE_URL / DB_HOST is set (running migrations first),
 * otherwise to the local JSON store (.data/db.json).
 * Idempotent: companies are matched by name, users by email, deals by company + title.
 * Starting accounts use SEED_DEFAULT_PASSWORD (default "ChangeMe123!") and must change it at first login.
 */
import { loadEnv } from "./env";
loadEnv();

import path from "node:path";
import ExcelJS from "exceljs";
import bcrypt from "bcryptjs";
import { closeStore, store } from "../src/lib/data/store";
import { runMigrations } from "./migrate";

const SEED_FILE = path.join(process.cwd(), "seed_data", "WR_Pakistan_Industry_Master_FINAL.xlsx");
const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD || "ChangeMe123!";
const DEMO = process.argv.includes("--demo");
const hashPassword = (pw: string) => bcrypt.hash(pw, 10);

const db = store();

// ---------------------------------------------------------------- helpers
type CV = ExcelJS.CellValue;
function txt(v: CV): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "object") {
    const o = v as unknown as Record<string, unknown>;
    if (Array.isArray(o.richText)) return (o.richText as { text: string }[]).map((r) => r.text).join("").trim() || null;
    if ("result" in o) return txt(o.result as CV);
    if ("text" in o) return String(o.text).trim() || null;
    return null;
  }
  const out = String(v).trim();
  return out || null;
}
function num(v: CV): number | null {
  const t = txt(v);
  if (t == null) return null;
  const n = Number(t.replace(/[,\s]|PKR/gi, ""));
  return Number.isFinite(n) ? n : null;
}

const SECTOR_ALIASES: Record<string, string> = { Pharmaceutical: "Pharmaceutical & Healthcare" };
const MAJOR = ["Karachi", "Lahore", "Islamabad", "Faisalabad", "Rawalpindi", "Multan", "Peshawar"];

/** Splits a messy "City / site" cell into a clean city plus the original site text. */
function splitLocation(raw: string | null): { city: string | null; site: string | null } {
  if (!raw) return { city: null, site: null };
  const original = raw.replace(/\s+/g, " ").trim();
  if (/to confirm/i.test(original)) return { city: "To confirm", site: original === "To confirm" ? null : original };
  let part = original.split(" / ")[0].trim();
  if (part.includes(",")) part = part.split(",").pop()!.trim();
  part = part.split(/\s[–—-]\s|[–—]/)[0].trim();
  const m = part.match(/^(.*?)\s*\((.*?)\)\s*$/);
  if (m) {
    const [, outside, inside] = m;
    const insideIsPlace = !/network|nationwide|fields|ops/i.test(inside);
    part = MAJOR.includes(outside.trim()) || !insideIsPlace ? outside.trim() : inside.trim();
  }
  const city = part || original;
  return { city, site: city === original ? null : original };
}

function solutionFrom(text: string | null): string | null {
  if (!text) return null;
  const t = text.toUpperCase();
  const found = ["RO", "ETP", "STP", "MBR", "ZLD", "UF"].filter((k) =>
    k === "RO" ? /(^|[^A-Z])(BW|HBW|SW)?RO([^A-Z]|$)/.test(t) : new RegExp(`(^|[^A-Z])${k}([^A-Z]|$)`).test(t),
  );
  if (found.length === 1) return found[0];
  if (found.length > 1) return "Mixed";
  return null;
}

const sectorCache = new Map<string, number>();
async function sectorId(name: string | null) {
  if (!name) return null;
  const clean = SECTOR_ALIASES[name] ?? name;
  if (!sectorCache.has(clean)) {
    const row = (await db.first("sectors", { where: { name: clean } })) ?? (await db.insert("sectors", { name: clean }));
    sectorCache.set(clean, row.id);
  }
  return sectorCache.get(clean)!;
}
async function subSectorId(sector: number | null, name: string | null) {
  if (!sector || !name) return null;
  const row =
    (await db.first("subSectors", { where: { sectorId: sector, name } })) ?? (await db.insert("subSectors", { name, sectorId: sector }));
  return row.id;
}
const cityCache = new Map<string, number>();
async function cityId(name: string | null, province: string | null) {
  if (!name) return null;
  if (!cityCache.has(name)) {
    const row = (await db.first("cities", { where: { name } })) ?? (await db.insert("cities", { name, province }));
    cityCache.set(name, row.id);
  }
  return cityCache.get(name)!;
}
async function groupId(name: string | null) {
  if (!name) return null;
  const row = (await db.first("parentGroups", { where: { name } })) ?? (await db.insert("parentGroups", { name }));
  return row.id;
}

// ---------------------------------------------------------------- users
type SeedUser = { name: string; email: string; role: string; region: string };
const STARTING_USERS: SeedUser[] = [
  { name: "Haroon Rasheed", email: "haroon@waterregime.com", role: "admin", region: "Head office" },
  { name: "Qasim Zafar", email: "qasim@waterregime.com", role: "admin", region: "Head office" },
  { name: "Khalid Usman", email: "khalid@waterregime.com", role: "ceo", region: "Head office" },
  { name: "Sales Manager", email: "manager@waterregime.com", role: "manager", region: "Lahore" },
  { name: "Sales Executive", email: "sales@waterregime.com", role: "sales", region: "Lahore" },
];
// Fictional people for local demos only (--demo).
const DEMO_USERS: SeedUser[] = [
  { name: "Ali Raza", email: "ali.raza@waterregime.com", role: "sales", region: "Lahore" },
  { name: "Sana Malik", email: "sana.malik@waterregime.com", role: "sales", region: "Karachi" },
  { name: "Bilal Ahmed", email: "bilal.ahmed@waterregime.com", role: "manager", region: "Lahore" },
  { name: "Hina Farooq", email: "hina.farooq@waterregime.com", role: "sales", region: "Islamabad" },
  { name: "Omar Sheikh", email: "omar.sheikh@waterregime.com", role: "sales", region: "Faisalabad" },
  { name: "Zainab Qureshi", email: "zainab.qureshi@waterregime.com", role: "ceo", region: "Head office" },
  { name: "Kamran Javed", email: "kamran.javed@waterregime.com", role: "admin", region: "Head office" },
];

async function seedUsers(list: SeedUser[], mustChange: boolean) {
  const hash = await hashPassword(DEFAULT_PASSWORD);
  const created: string[] = [];
  for (const u of list) {
    if (await db.first("users", { where: { email: u.email } })) continue;
    await db.insert("users", { ...u, passwordHash: hash, mustChangePassword: mustChange });
    created.push(u.email);
  }
  return created;
}

// ---------------------------------------------------------------- Excel
async function seedWorkbook() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(SEED_FILE);
  const stats = { companies: 0, skipped: 0, deals: 0 };
  const known = new Map((await db.list("companies")).map((c) => [c.name.toLowerCase(), c.id]));

  const targets = wb.getWorksheet("New Target Accounts");
  if (!targets) throw new Error("Sheet 'New Target Accounts' not found");
  for (let r = 2; r <= targets.rowCount; r++) {
    const row = targets.getRow(r);
    const c = (i: number) => row.getCell(i).value;
    const name = txt(c(2));
    if (!name || num(c(1)) == null) continue;
    if (known.has(name.toLowerCase())) {
      stats.skipped++;
      continue;
    }
    const [group, sector, sub, location, province, need, solution, dms, , basis, evidence, firstStep, remarks, , source] = [
      3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
    ].map((i) => txt(c(i)));
    const loc = splitLocation(location);
    const sec = await sectorId(sector);
    const notes = [
      solution && `WR solution: ${solution}`,
      dms && `Target decision-makers: ${dms}`,
      basis && `Basis: ${basis}`,
      evidence && `Evidence: ${evidence}`,
      firstStep && `Recommended first step: ${firstStep}`,
      remarks && `Remarks: ${remarks}`,
      source && `Source: ${source}`,
    ]
      .filter(Boolean)
      .join("\n");
    const pr = num(c(11));
    const created = await db.insert("companies", {
      name,
      parentGroupId: await groupId(group),
      sectorId: sec,
      subSectorId: await subSectorId(sec, sub),
      cityId: await cityId(loc.city, province),
      plantUnit: loc.site,
      priority: pr === 1 ? "P1" : pr === 3 ? "P3" : pr === 2 ? "P2" : null,
      leadSource: basis && /live/i.test(basis) ? "Live Signal" : "Target",
      waterNeed: need,
      notes: notes || null,
      status: "active",
    });
    known.set(name.toLowerCase(), created.id);
    stats.companies++;
  }

  // WR Active Pipeline → deals (skips the TOTAL row and footnotes, which have no row number)
  const pipe = wb.getWorksheet("WR Active Pipeline");
  if (pipe) {
    for (let r = 2; r <= pipe.rowCount; r++) {
      const row = pipe.getRow(r);
      const c = (i: number) => row.getCell(i).value;
      const account = txt(c(2));
      if (!account || num(c(1)) == null) continue;
      const [sector, tier, status, desc, solution, dms] = [3, 4, 5, 6, 7, 8].map((i) => txt(c(i)));
      const pipeVal = num(c(9));
      const closeVal = num(c(10));
      const nextAction = txt(c(11));

      let companyId = known.get(account.toLowerCase());
      if (!companyId) {
        const created = await db.insert("companies", {
          name: account,
          sectorId: await sectorId(sector),
          leadSource: "WR Pipeline",
          priority: tier && tier.includes("A") ? "P1" : "P2",
          notes: status ? `WR status: ${status}` : null,
          status: "active",
        });
        companyId = created.id;
        known.set(account.toLowerCase(), companyId);
        stats.companies++;
      }
      const title = (desc || `${account} — Water Regime opportunity`).slice(0, 230);
      if (await db.first("deals", { where: { companyId, title } })) continue;
      const probability = closeVal && pipeVal ? Math.max(10, Math.min(90, Math.round((closeVal / pipeVal) * 100))) : 25;
      await db.insert("deals", {
        title,
        companyId,
        stage: "qualified",
        solutionType: solutionFrom(solution),
        valuePkr: pipeVal,
        probability,
        expectedClose: closeVal ? "2026-12-31" : null,
        notes: [
          solution && `WR solution: ${solution}`,
          dms && `Decision-makers: ${dms}`,
          closeVal && `Expected to close by Dec-26: PKR ${Math.round(closeVal).toLocaleString("en-US")}`,
          nextAction && `Next action: ${nextAction}`,
          status && `WR status: ${status}`,
        ]
          .filter(Boolean)
          .join("\n"),
      });
      stats.deals++;
    }
  }
  return stats;
}

// ---------------------------------------------------------------- demo data
function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

async function seedDemo() {
  if (await db.count("visits")) {
    console.log("Demo activity already present — skipped.");
    return;
  }
  const rand = rng(20261022);
  const pick = <T,>(a: readonly T[]) => a[Math.floor(rand() * a.length)];
  const now = Date.now();
  const H = 3600_000;
  const D = 24 * H;
  const dateStr = (ms: number) => new Date(ms + 5 * H).toISOString().slice(0, 10); // PKT calendar date

  const people = await db.list("users", { where: { email: { in: DEMO_USERS.map((u) => u.email) } } });
  const sales = people.filter((p) => p.role === "sales");
  const manager = people.find((p) => p.role === "manager")!;
  const ali = people.find((p) => p.email === "ali.raza@waterregime.com")!;

  // Owners: spread the first 64 unowned companies (P1 first) across the demo salespeople.
  const pool = (await db.list("companies", { where: { ownerId: null }, orderBy: [["priority", "asc"], ["id", "asc"]] })).slice(0, 64);
  const owned: { id: number; owner: number }[] = [];
  for (let i = 0; i < pool.length; i++) {
    const owner = i % 7 === 6 ? manager : sales[i % sales.length];
    await db.update("companies", pool[i].id, { ownerId: owner.id, ownerSince: new Date(now - (90 + Math.floor(rand() * 60)) * D) });
    owned.push({ id: pool[i].id, owner: owner.id });
  }
  // Make two of Ali's accounts dormant (last touch long ago) for the flags.
  for (const o of owned.filter((x) => x.owner === ali.id).slice(-2)) {
    await db.update("companies", o.id, { ownerSince: new Date(now - 200 * D) });
  }

  const FIRST = ["Imran", "Sadia", "Waqas", "Ayesha", "Faraz", "Usman", "Nadeem", "Kashif", "Rashid", "Mehwish", "Tariq", "Asad", "Saima", "Junaid", "Fatima", "Zeeshan"];
  const LAST = ["Qureshi", "Noor", "Anjum", "Khan", "Hussain", "Tariq", "Akhtar", "Raza", "Mehmood", "Ali", "Jamil", "Butt", "Baig", "Siddiqui", "Chaudhry", "Awan"];
  const TITLES = ["GM Utilities", "Procurement Manager", "Plant Engineer, ETP", "Plant Manager", "Head of QA", "Director Projects", "Chief Engineer", "Operations Head", "EHS Manager", "Director Technical"];
  for (const c of owned) {
    const n = 1 + Math.floor(rand() * 3);
    for (let k = 0; k < n; k++) {
      const first = pick(FIRST);
      const last = pick(LAST);
      await db.insert("contacts", {
        companyId: c.id,
        name: `${first} ${last}`,
        title: pick(TITLES),
        email: `${first}.${last}@example.com`.toLowerCase(),
        phone: `+92 3${Math.floor(rand() * 5)}${Math.floor(rand() * 10)} ${1000 + Math.floor(rand() * 8999)} ${100 + Math.floor(rand() * 899)}`,
        linkedin: rand() > 0.5 ? `https://www.linkedin.com/in/${first}-${last}`.toLowerCase() : null,
        isPrimary: k === 0,
        verified: rand() > 0.35,
      });
    }
  }

  // Deals: owners and a spread of stages for the pipeline, plus some for owned accounts.
  const PROB = { lead: 10, qualified: 25, proposal: 50, negotiation: 70, won: 100, lost: 0 } as Record<string, number>;
  const spread = ["lead", "qualified", "qualified", "proposal", "proposal", "negotiation", "won", "lost"];
  for (const d of await db.list("deals")) {
    const ownerRow = owned.find((o) => o.id === d.companyId);
    const owner = ownerRow ? ownerRow.owner : pick([...sales, manager]).id;
    const stage = pick(spread);
    const daysIn = Math.floor(rand() * 55) + 1;
    await db.update("deals", d.id, {
      ownerId: owner,
      stage,
      stageEnteredAt: new Date(now - daysIn * D),
      probability: stage === "qualified" ? d.probability : PROB[stage],
      lostReason: stage === "lost" ? pick(["Price too high", "Lost to competitor", "Project cancelled or postponed", "No budget"]) : null,
      closedAt: stage === "won" || stage === "lost" ? new Date(now - daysIn * D) : null,
      expectedClose: d.expectedClose ?? dateStr(now + (Math.floor(rand() * 150) - 20) * D),
    });
  }
  const DEAL_TITLES = ["ETP upgrade + water reuse", "RO for process water", "Zero liquid discharge", "Cooling water recycling", "Sewage treatment plant", "UF pre-treatment", "Boiler feed RO / DM", "MBR reuse plant"];
  const SOL: Record<string, string> = { "ETP upgrade + water reuse": "ETP", "RO for process water": "RO", "Zero liquid discharge": "ZLD", "Cooling water recycling": "Mixed", "Sewage treatment plant": "STP", "UF pre-treatment": "UF", "Boiler feed RO / DM": "RO", "MBR reuse plant": "MBR" };
  for (const c of owned.slice(0, 20)) {
    const stage = pick(spread.slice(0, 6));
    const title = pick(DEAL_TITLES);
    await db.insert("deals", {
      title,
      companyId: c.id,
      ownerId: c.owner,
      stage,
      stageEnteredAt: new Date(now - (Math.floor(rand() * 50) + 1) * D),
      solutionType: SOL[title],
      valuePkr: Math.round((5 + rand() * 300) * 10) * 100_000,
      probability: PROB[stage],
      expectedClose: dateStr(now + (Math.floor(rand() * 160) - 25) * D),
    });
  }

  // Proposals for deals at proposal stage or later.
  let ref = 90;
  for (const d of await db.list("deals", { where: { stage: { in: ["proposal", "negotiation", "won"] } } })) {
    const value = d.valuePkr ?? 50_000_000;
    if (d.stage === "negotiation" && rand() > 0.5) {
      await db.insert("proposals", { dealId: d.id, reference: `WR-P-2026-${ref++}`, submittedOn: dateStr(now - 55 * D), amountPkr: Math.round(value * 1.06), status: "Revised", notes: "First offer; client asked for phased CAPEX." });
    }
    await db.insert("proposals", {
      dealId: d.id,
      reference: `WR-P-2026-${ref++}`,
      submittedOn: dateStr(now - Math.floor(rand() * 40 + 5) * D),
      amountPkr: value,
      status: d.stage === "won" ? "Accepted" : "Submitted",
    });
  }

  // Visits: history for every salesperson, plus some still waiting for an outcome.
  const NOTES = ["Walked the ETP with the utilities team.", "Reviewed RO sizing; they want UF ahead of RO.", "Asked for references from operating plants.", "Procurement asked for a revised proposal.", "Shared budget window for next year.", "Discussed reuse targets and discharge limits.", "Plant tour; sampled raw water.", "Agreed to a site survey next month."];
  const NEXT = ["Send revised proposal", "Share reference sites", "Plan site survey", "Share lab results", "Confirm meeting date", "Follow up on budget"];
  const allDeals = await db.list("deals");
  const dormantIds = new Set(owned.filter((x) => x.owner === ali.id).slice(-2).map((x) => x.id));
  for (const person of [...sales, manager]) {
    const mine = owned.filter((o) => o.owner === person.id && !dormantIds.has(o.id));
    if (!mine.length) continue;
    for (let i = 0; i < 18; i++) {
      const c = mine[i % mine.length];
      const at = now - (3 + Math.floor(rand() * 55)) * D - Math.floor(rand() * 8) * H;
      const deal = allDeals.find((d) => d.companyId === c.id);
      const hasNext = rand() > 0.45;
      const nextOffset = Math.floor(rand() * 12) - 6;
      await db.insert("visits", {
        companyId: c.id,
        dealId: deal?.id ?? null,
        salespersonId: person.id,
        visitType: pick(["Visit", "Call", "Meeting", "Site Survey", "Proposal Meeting", "Email"]),
        visitAt: new Date(at),
        contactMet: `${pick(FIRST)} ${pick(LAST)}`,
        discussion: pick(NOTES),
        outcome: pick(["positive", "positive", "neutral", "negative", "noshow"]),
        outcomeSetAt: new Date(at + Math.floor(rand() * 40) * H),
        nextAction: hasNext ? pick(NEXT) : null,
        nextActionDate: hasNext ? dateStr(now + nextOffset * D) : null,
        nextActionDoneAt: hasNext && nextOffset < -3 && rand() > 0.5 ? new Date(now - D) : null,
      });
    }
    const hoursAgo = person.id === ali.id ? [66.7, 41.2, 22.7, 1.2] : [30, 52];
    for (let k = 0; k < hoursAgo.length; k++) {
      const c = mine[(k + 3) % mine.length];
      const deal = allDeals.find((d) => d.companyId === c.id);
      await db.insert("visits", {
        companyId: c.id,
        dealId: deal?.id ?? null,
        salespersonId: person.id,
        visitType: pick(["Site Survey", "Meeting", "Call", "Proposal Meeting"]),
        visitAt: new Date(now - hoursAgo[k] * H),
        contactMet: `${pick(FIRST)} ${pick(LAST)}`,
        discussion: pick(NOTES),
        outcome: "pending",
      });
    }
  }
  // One skipped visit on a dormant account, for history.
  const dormantOne = [...dormantIds][0];
  if (dormantOne) {
    await db.insert("visits", { companyId: dormantOne, salespersonId: ali.id, visitType: "Visit", visitAt: new Date(now - 74 * D), outcome: "skipped", skipReason: "Client unavailable", outcomeSetAt: new Date(now - 74 * D) });
  }

  await db.insert("auditLog", { userId: ali.id, entity: "visit", action: "created", detail: "Demo data loaded" });
}

// ---------------------------------------------------------------- main
async function main() {
  console.log(`Store: ${db.kind}`);
  if (await runMigrations()) console.log("MySQL migrations applied.");
  const users = await seedUsers(STARTING_USERS, true);
  if (users.length) console.log(`Starting accounts created (must change password at first login): ${users.join(", ")}`);
  const stats = await seedWorkbook();
  console.log(`Excel import: ${stats.companies} companies added, ${stats.skipped} already present, ${stats.deals} pipeline deals.`);
  if (DEMO) {
    if (db.kind === "mysql" && !process.argv.includes("--force-demo")) {
      throw new Error("Refusing to load demo data into MySQL. Pass --force-demo if you really mean it.");
    }
    await seedUsers(DEMO_USERS, false);
    await seedDemo();
    console.log("Demo activity added (sample salespeople, contacts, deals, visits, proposals).");
  }
}

main()
  .then(() => closeStore())
  .catch(async (e) => {
    console.error(e);
    await closeStore();
    process.exit(1);
  });
