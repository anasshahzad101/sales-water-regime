/**
 * Shared reference data — the single source for every dropdown, pill and rule.
 * Keys are what the database stores; labels are what people see.
 */

export type Hue = "slate" | "aqua" | "blue" | "violet" | "green" | "red" | "amber";

export const STAGES = [
  { key: "lead", label: "Lead", icon: "circle-dashed", hue: "slate", p: 10 },
  { key: "qualified", label: "Qualified", icon: "circle-dot", hue: "aqua", p: 25 },
  { key: "proposal", label: "Proposal Submitted", icon: "file-text", hue: "blue", p: 50 },
  { key: "negotiation", label: "Negotiation", icon: "handshake", hue: "violet", p: 70 },
  { key: "won", label: "Won (PO)", icon: "trophy", hue: "green", p: 100 },
  { key: "lost", label: "Lost", icon: "circle-x", hue: "red", p: 0 },
] as const;
export type StageKey = (typeof STAGES)[number]["key"];
export const STAGE_KEYS = STAGES.map((s) => s.key) as StageKey[];
export const OPEN_STAGES: StageKey[] = ["lead", "qualified", "proposal", "negotiation"];
export const stageOf = (k: string) => STAGES.find((s) => s.key === k) ?? STAGES[0];

export const OUTCOMES = [
  { key: "pending", label: "Pending", short: "Pending", icon: "clock", hue: "slate" },
  { key: "positive", label: "Positive — move forward", short: "Positive", icon: "thumbs-up", hue: "green" },
  { key: "neutral", label: "Neutral — info only", short: "Neutral", icon: "info", hue: "aqua" },
  { key: "negative", label: "Negative — pushback", short: "Negative", icon: "thumbs-down", hue: "red" },
  { key: "noshow", label: "No show / rescheduled", short: "No show", icon: "calendar-clock", hue: "amber" },
  { key: "skipped", label: "Skipped — reason required", short: "Skipped", icon: "skip-forward", hue: "slate" },
] as const;
export type OutcomeKey = (typeof OUTCOMES)[number]["key"];
export const OUTCOME_KEYS = OUTCOMES.map((o) => o.key) as OutcomeKey[];
export const outcomeOf = (k: string) => OUTCOMES.find((o) => o.key === k) ?? OUTCOMES[0];

export const VISIT_TYPES = [
  { key: "Visit", icon: "map-pin" },
  { key: "Call", icon: "phone" },
  { key: "Email", icon: "mail" },
  { key: "Meeting", icon: "users" },
  { key: "Site Survey", icon: "clipboard-list" },
  { key: "Proposal Meeting", icon: "presentation" },
] as const;
export const VISIT_TYPE_KEYS = VISIT_TYPES.map((v) => v.key) as string[];
export const visitTypeIcon = (t: string) => (VISIT_TYPES.find((v) => v.key === t) ?? VISIT_TYPES[0]).icon;

export const SKIP_REASONS = [
  "Client unavailable",
  "Rescheduled by client",
  "Travel / logistics",
  "Internal priority shift",
  "No access to decision maker",
  "Other (specify in notes)",
] as const;

export const LOST_REASONS = [
  "Price too high",
  "Lost to competitor",
  "Project cancelled or postponed",
  "No budget",
  "Technical mismatch",
  "No response from client",
  "Other (specify)",
] as const;

export const SOLUTION_TYPES = ["RO", "ETP", "STP", "MBR", "ZLD", "UF", "Mixed"] as const;
export const LEAD_SOURCES = ["Target", "Live Signal", "WR Pipeline", "Partner"] as const;
export const PRIORITIES = ["P1", "P2", "P3"] as const;
export const COMPANY_STATUSES = ["active", "dormant", "archived"] as const;

export const ROLES = [
  { key: "sales", label: "Sales" },
  { key: "manager", label: "Manager" },
  { key: "ceo", label: "CEO (read-only)" },
  { key: "admin", label: "Admin" },
] as const;
export type Role = (typeof ROLES)[number]["key"];
export const ROLE_KEYS = ROLES.map((r) => r.key) as Role[];
export const roleLabel = (r: string) => (ROLES.find((x) => x.key === r)?.label ?? r).replace(" (read-only)", "");

export const PROPOSAL_STATUSES = [
  { key: "Submitted", hue: "blue", icon: "send" },
  { key: "Revised", hue: "violet", icon: "file-pen" },
  { key: "Accepted", hue: "green", icon: "circle-check" },
  { key: "Rejected", hue: "red", icon: "circle-x" },
] as const;
export const proposalStatusOf = (k: string) => PROPOSAL_STATUSES.find((p) => p.key === k) ?? PROPOSAL_STATUSES[0];

export const AUDIT_ENTITIES = ["company", "contact", "visit", "deal", "proposal", "user"] as const;

/** Business rules */
export const OUTCOME_GRACE_HOURS = 48;
export const STUCK_STAGE_DAYS = 30;
export const DORMANT_DAYS = 60;
export const LOGIN_MAX_ATTEMPTS = 5;
export const LOGIN_LOCK_MINUTES = 15;
export const MIN_PASSWORD_LENGTH = 8;
/** A late outcome needs a written reason of at least this many characters. */
export const LATE_REASON_MIN = 10;
