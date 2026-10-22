"use server";

import { refresh } from "next/cache";
import { fail, guard, ok, type ActionResult } from "@/lib/action-result";
import { logAction } from "@/lib/audit";
import { requireActionUser } from "@/lib/auth/dal";
import { LEAD_SOURCES, PRIORITIES } from "@/lib/constants";
import { store } from "@/lib/data/store";
import { findSimilarCompanies } from "@/lib/queries/accounts";

/** Live duplicate check for the Add company form. */
export async function checkDuplicateCompanies(name: string) {
  const res = await guard(async () => {
    await requireActionUser({ edit: true });
    return ok(await findSimilarCompanies(String(name ?? "").slice(0, 120)));
  });
  return res.ok ? (res.data ?? []) : [];
}

export type CreateCompanyState = { ok?: boolean; id?: number; name?: string; error?: string; fieldErrors?: Record<string, string> };

export async function createCompany(_prev: CreateCompanyState, form: FormData): Promise<CreateCompanyState> {
  const res = await guard(async () => {
    const user = await requireActionUser({ edit: true });
    const db = store();
    const f = (k: string) => String(form.get(k) ?? "").trim();
    const fieldErrors: Record<string, string> = {};

    const name = f("name").replace(/\s+/g, " ").slice(0, 240);
    if (!name) fieldErrors.name = "Enter the company name.";

    const sectorId = Number(f("sectorId")) || null;
    if (sectorId && !(await db.get("sectors", sectorId))) fieldErrors.sectorId = "Choose a sector from the list.";
    let subSectorId = Number(f("subSectorId")) || null;
    if (subSectorId) {
      const sub = await db.get("subSectors", subSectorId);
      if (!sub || sub.sectorId !== sectorId) subSectorId = null;
    }
    const cityId = Number(f("cityId")) || null;
    if (cityId && !(await db.get("cities", cityId))) fieldErrors.cityId = "Choose a city from the list.";

    const priority = f("priority");
    if (priority && !(PRIORITIES as readonly string[]).includes(priority)) fieldErrors.priority = "Choose P1, P2 or P3.";
    const leadSource = f("leadSource");
    if (leadSource && !(LEAD_SOURCES as readonly string[]).includes(leadSource)) fieldErrors.leadSource = "Choose a lead source.";

    const mldRaw = f("capacityMld").replace(/,/g, "");
    const capacityMld = mldRaw ? Number(mldRaw) : null;
    if (mldRaw && (!Number.isFinite(capacityMld) || capacityMld! < 0 || capacityMld! > 9999)) fieldErrors.capacityMld = "Enter the capacity in million litres per day, e.g. 1.2";

    const website = f("website")
      .replace(/^https?:\/\//i, "")
      .replace(/\/+$/, "")
      .slice(0, 240);
    if (website && !/^[^\s/]+\.[^\s]+$/.test(website)) fieldErrors.website = "Enter a web address like company.pk";

    if (Object.keys(fieldErrors).length) return fail("Check the highlighted fields.", fieldErrors);

    let parentGroupId: number | null = null;
    const group = f("group").slice(0, 200);
    if (group) {
      const existing = await db.first("parentGroups", { where: { name: group } });
      parentGroupId = (existing ?? (await db.insert("parentGroups", { name: group }))).id;
    }

    const now = new Date();
    const c = await db.insert("companies", {
      name,
      brand: f("brand").slice(0, 240) || null,
      plantUnit: f("plantUnit").slice(0, 240) || null,
      parentGroupId,
      sectorId,
      subSectorId,
      cityId,
      priority: priority || null,
      leadSource: leadSource || null,
      waterNeed: f("waterNeed").slice(0, 2000) || null,
      capacityMld: capacityMld,
      website: website || null,
      notes: f("notes").slice(0, 8000) || null,
      status: "active",
      ownerId: user.id,
      ownerSince: now,
      createdById: user.id,
    });
    await logAction(user, "company", c.id, "created", [name, c.plantUnit].filter(Boolean).join(" — "));
    refresh();
    return ok({ id: c.id, name });
  });
  if (!res.ok) return { error: res.error, fieldErrors: res.fieldErrors };
  return { ok: true, ...res.data };
}

/** Puts the account in the current user's list. No approval step, by design. */
export async function claimAccount(companyId: number): Promise<ActionResult<{ prevOwnerId: number | null; prevOwnerSince: string | null }>> {
  return guard(async () => {
    const user = await requireActionUser({ edit: true });
    const db = store();
    const c = await db.get("companies", companyId);
    if (!c) return fail("Company not found.");
    if (c.ownerId === user.id) return fail("This account is already yours.");
    const prev = c.ownerId ? await db.get("users", c.ownerId) : undefined;
    await db.update("companies", c.id, { ownerId: user.id, ownerSince: new Date() });
    await logAction(user, "company", c.id, "claimed", `${c.name} → ${user.name}${prev ? ` (was ${prev.name})` : ""}`);
    refresh();
    return ok({ prevOwnerId: c.ownerId, prevOwnerSince: c.ownerSince ? c.ownerSince.toISOString() : null });
  });
}

/** Undo for a claim made moments ago. */
export async function undoClaim(companyId: number, prevOwnerId: number | null, prevOwnerSince: string | null): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireActionUser({ edit: true });
    const db = store();
    const c = await db.get("companies", companyId);
    if (!c) return fail("Company not found.");
    if (c.ownerId !== user.id) return fail("The owner has changed since — nothing to undo.");
    await db.update("companies", c.id, { ownerId: prevOwnerId, ownerSince: prevOwnerSince ? new Date(prevOwnerSince) : null });
    await logAction(user, "company", c.id, "claim undone", c.name);
    refresh();
    return ok();
  });
}

export type ContactInput = {
  companyId: number;
  contactId?: number | null;
  name: string;
  title?: string;
  phone?: string;
  email?: string;
  linkedin?: string;
  isPrimary?: boolean;
  verified?: boolean;
};

function cleanContact(input: ContactInput) {
  const s = (v: string | undefined, n: number) => (v ?? "").trim().slice(0, n);
  const fieldErrors: Record<string, string> = {};
  const name = s(input.name, 160).replace(/\s+/g, " ");
  if (!name) fieldErrors.name = "Enter a name.";
  const phone = s(input.phone, 60);
  const phoneDigits = phone.replace(/\D/g, "");
  const phoneValue = phoneDigits.length <= 2 ? "" : phone; // "+92 " alone counts as empty
  if (phoneValue && !/^[+\d][\d\s()-]{6,}$/.test(phoneValue)) fieldErrors.phone = "Use digits, spaces and an optional + — e.g. +92 300 1234 567";
  const email = s(input.email, 160).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fieldErrors.email = "Enter a valid email address.";
  let linkedin = s(input.linkedin, 240);
  if (linkedin && !/^https?:\/\//i.test(linkedin)) linkedin = `https://${linkedin.replace(/^\/+/, "")}`;
  if (linkedin && !/linkedin\.com\//i.test(linkedin)) fieldErrors.linkedin = "Paste a linkedin.com profile link.";
  return {
    fieldErrors,
    values: {
      name,
      title: s(input.title, 160) || null,
      phone: phoneValue || null,
      email: email || null,
      linkedin: linkedin || null,
      isPrimary: !!input.isPrimary,
      verified: !!input.verified,
    },
  };
}

/** Add or edit a contact. Making one primary clears the flag on the others. */
export async function saveContact(input: ContactInput): Promise<ActionResult<{ id: number; name: string }>> {
  return guard(async () => {
    const user = await requireActionUser({ edit: true });
    const db = store();
    const company = await db.get("companies", input.companyId);
    if (!company) return fail("Company not found.");
    const { fieldErrors, values } = cleanContact(input);
    if (Object.keys(fieldErrors).length) return fail("Check the highlighted fields.", fieldErrors);

    let id: number;
    if (input.contactId) {
      const existing = await db.get("contacts", input.contactId);
      if (!existing || existing.companyId !== company.id) return fail("Contact not found.");
      await db.update("contacts", existing.id, values);
      id = existing.id;
      const changed = (["name", "title", "phone", "email", "linkedin"] as const).filter((k) => (existing[k] ?? null) !== values[k]);
      await logAction(user, "contact", id, "updated", `${values.name} (${company.name})${changed.length ? `: ${changed.join(", ")} changed` : ""}`);
    } else {
      id = (await db.insert("contacts", { ...values, companyId: company.id })).id;
      await logAction(user, "contact", id, "created", `${values.name} (${company.name})`);
    }
    if (values.isPrimary) {
      await db.updateWhere("contacts", { companyId: company.id, isPrimary: true, id: { ne: id } }, { isPrimary: false });
    }
    refresh();
    return ok({ id, name: values.name });
  });
}

export type ContactSnapshot = {
  companyId: number;
  name: string;
  title: string | null;
  phone: string | null;
  email: string | null;
  linkedin: string | null;
  isPrimary: boolean;
  verified: boolean;
};

export async function deleteContact(contactId: number): Promise<ActionResult<ContactSnapshot>> {
  return guard(async () => {
    const user = await requireActionUser({ edit: true });
    const db = store();
    const c = await db.get("contacts", contactId);
    if (!c) return fail("Contact not found.");
    const company = await db.get("companies", c.companyId);
    await db.remove("contacts", c.id);
    await logAction(user, "contact", c.id, "deleted", `${c.name} (${company?.name ?? "—"})`);
    refresh();
    return ok({ companyId: c.companyId, name: c.name, title: c.title, phone: c.phone, email: c.email, linkedin: c.linkedin, isPrimary: c.isPrimary, verified: c.verified });
  });
}

/** Undo for a delete: puts the contact back. */
export async function restoreContact(snap: ContactSnapshot): Promise<ActionResult> {
  return guard(async () => {
    const user = await requireActionUser({ edit: true });
    const db = store();
    const company = await db.get("companies", snap.companyId);
    if (!company) return fail("Company not found.");
    const { fieldErrors, values } = cleanContact({ ...snap, title: snap.title ?? "", phone: snap.phone ?? "", email: snap.email ?? "", linkedin: snap.linkedin ?? "" });
    if (Object.keys(fieldErrors).length) return fail("Couldn’t restore the contact.");
    const c = await db.insert("contacts", { ...values, companyId: company.id });
    await logAction(user, "contact", c.id, "restored", `${values.name} (${company.name})`);
    refresh();
    return ok();
  });
}
