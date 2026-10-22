/**
 * Sets up a database.
 *
 *   npm run db:seed            → the 5 starting user accounts (company data lives in the database itself)
 *   npm run db:seed -- --demo  → also adds sample salespeople, companies, contacts, deals, visits and proposals
 *                                (local testing only — never run --demo against the live database)
 *
 * Writes to MySQL when DATABASE_URL / DB_HOST is set (running migrations first),
 * otherwise to the local JSON store (.data/db.json).
 * Idempotent: users are matched by email; demo activity is only added once.
 * Starting accounts use SEED_DEFAULT_PASSWORD (default "ChangeMe123!") and must change it at first login.
 */
import { loadEnv } from "./env";
loadEnv();

import bcrypt from "bcryptjs";
import { closeStore, store } from "../src/lib/data/store";
import { runMigrations } from "./migrate";

const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD || "ChangeMe123!";
const DEMO = process.argv.includes("--demo");
const hashPassword = (pw: string) => bcrypt.hash(pw, 10);

const db = store();

// ---------------------------------------------------------------- lookups
const sectorCache = new Map<string, number>();
async function sectorId(name: string | null) {
  if (!name) return null;
  if (!sectorCache.has(name)) {
    const row = (await db.first("sectors", { where: { name } })) ?? (await db.insert("sectors", { name }));
    sectorCache.set(name, row.id);
  }
  return sectorCache.get(name)!;
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

// ---------------------------------------------------------------- demo data
// Fictional companies from the design's sample data — used only when the demo database has none.
const DEMO_COMPANIES: [string, string, string, string | null, string, string, string, string, string, string, number][] = [
  ["Lyallpur Denim Mills", "LDM Denim", "Plant 2", "Lyallpur Group", "Textiles", "Denim", "Faisalabad", "P1", "Target", "ETP upgrade + water reuse", 2.4],
  ["Ravi Valley Beverages", "RVB Bottling", "Sheikhupura Plant", "Ravi Valley Holdings", "Beverages", "Soft drinks", "Sheikhupura", "P1", "Live Signal", "RO for process water", 0.8],
  ["Margalla Biopharma", "Margalla", "Sterile Unit", null, "Pharma", "Sterile", "Islamabad", "P2", "WR Pipeline", "Purified water / WFI", 0.15],
  ["Kohsar Chemicals", "Kohsar", "Port Qasim Plant", "Kohsar Industries", "Chemicals", "Specialty", "Karachi", "P1", "Target", "Zero liquid discharge", 1.2],
  ["Sutlej Steel Works", "Sutlej Steel", "Rolling Mill 1", "Sutlej Group", "Steel", "Rolling mills", "Lahore", "P2", "Partner", "Cooling water recycling", 3.5],
  ["Chenab Agro Foods", "Chenab Dairy", "Multan Plant", null, "Food processing", "Dairy", "Multan", "P2", "Target", "Sewage treatment", 0.5],
  ["Pak Tanners Group", "PTG Leather", "Unit A", "Pak Tanners Group", "Leather", "Tanneries", "Sialkot", "P1", "Live Signal", "ETP + chrome recovery", 0.9],
  ["Punjab Ceramics", "PC Tiles", "Kiln Unit", null, "Building materials", "Ceramics", "Gujranwala", "P3", "Target", "Process water RO", 0.3],
  ["Indus Crest Power", "Indus Crest", "Unit 2", "Crest Energy", "Power", "IPP", "Hyderabad", "P1", "WR Pipeline", "DM water + blowdown recovery", 6.0],
  ["Karakoram Spinning", "KSM", "Mill 3", "Karakoram Group", "Textiles", "Spinning", "Faisalabad", "P2", "Target", "Humidification RO", 0.4],
  ["Bolan Edible Oils", "Bolan", "Karachi Refinery", null, "Food processing", "Edible oil", "Karachi", "P2", "Partner", "Refinery effluent", 1.1],
  ["Shalimar Poultry", "Shalimar Feeds", "Processing Plant", "Shalimar Group", "Food processing", "Poultry", "Lahore", "P3", "Target", "STP + reuse", 0.6],
  ["Thal Fertilizers", "Thal Agro", "Daharki Complex", "Thal Industries", "Chemicals", "Fertilizer", "Multan", "P1", "Target", "MBR for reuse", 4.2],
  ["Potohar Pharma", "Potohar", "Formulations Unit", null, "Pharma", "Formulations", "Islamabad", "P2", "WR Pipeline", "RO + EDI", 0.2],
  ["Mangla Juices", "Mangla Fresh", "Gujranwala Plant", null, "Beverages", "Juices", "Gujranwala", "P3", "Live Signal", "Wastewater ETP", 0.35],
  ["Hub Petrochem", "Hub", "Terminal Plant", "Hub Energy", "Chemicals", "Petrochemicals", "Karachi", "P1", "Target", "Zero liquid discharge", 2.0],
];

async function seedDemoCompanies() {
  if (await db.count("companies")) return 0;
  for (const [name, brand, plantUnit, group, sector, sub, city, priority, leadSource, waterNeed, capacityMld] of DEMO_COMPANIES) {
    const sec = await sectorId(sector);
    await db.insert("companies", {
      name,
      brand,
      plantUnit,
      parentGroupId: await groupId(group),
      sectorId: sec,
      subSectorId: await subSectorId(sec, sub),
      cityId: await cityId(city, null),
      priority,
      leadSource,
      waterNeed,
      capacityMld,
      notes: "Sample company for local testing (fictional).",
      status: "active",
    });
  }
  return DEMO_COMPANIES.length;
}

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
  if (await db.count("visits")) return false;
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

  // Deals: owners and a spread of stages for any existing deals, plus some for owned accounts.
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
    const stage = pick(spread);
    const title = pick(DEAL_TITLES);
    const daysIn = Math.floor(rand() * 50) + 1;
    await db.insert("deals", {
      title,
      companyId: c.id,
      ownerId: c.owner,
      stage,
      stageEnteredAt: new Date(now - daysIn * D),
      solutionType: SOL[title],
      valuePkr: Math.round((5 + rand() * 300) * 10) * 100_000,
      probability: PROB[stage],
      lostReason: stage === "lost" ? pick(["Price too high", "Lost to competitor", "No budget"]) : null,
      closedAt: stage === "won" || stage === "lost" ? new Date(now - daysIn * D) : null,
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
  return true;
}

// ---------------------------------------------------------------- main
async function main() {
  console.log(`Store: ${db.kind}`);
  if (await runMigrations()) console.log("MySQL migrations applied.");
  const users = await seedUsers(STARTING_USERS, true);
  console.log(users.length ? `Starting accounts created (must change password at first login): ${users.join(", ")}` : "Starting accounts already exist.");
  if (DEMO) {
    if (db.kind === "mysql" && !process.argv.includes("--force-demo")) {
      throw new Error("Refusing to load demo data into MySQL. Pass --force-demo if you really mean it.");
    }
    await seedUsers(DEMO_USERS, false);
    const companies = await seedDemoCompanies();
    if (companies) console.log(`${companies} sample companies added (fictional).`);
    console.log(
      (await seedDemo()) ? "Demo activity added (sample salespeople, contacts, deals, visits, proposals)." : "Demo activity already present — skipped.",
    );
  }
}

main()
  .then(() => closeStore())
  .catch(async (e) => {
    console.error(e);
    await closeStore();
    process.exit(1);
  });
