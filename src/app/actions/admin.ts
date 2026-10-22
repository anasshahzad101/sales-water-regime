"use server";

import { refresh } from "next/cache";
import { fail, guard, ok, type ActionResult } from "@/lib/action-result";
import { logAction } from "@/lib/audit";
import { requireActionUser } from "@/lib/auth/dal";
import { hashPassword } from "@/lib/auth/password";
import { ROLE_KEYS, roleLabel, type Role } from "@/lib/constants";
import { store } from "@/lib/data/store";
import { passwordProblem } from "@/lib/password-rules";

const admin = () => requireActionUser({ edit: true, roles: ["admin"] });

async function targetUser(id: number) {
  const u = await store().get("users", id);
  if (!u) throw new Error("User not found.");
  return u;
}

/** True when `excludeId` is the only active admin left. */
async function isLastActiveAdmin(excludeId: number) {
  const others = await store().count("users", { role: "admin", isActive: true, id: { ne: excludeId } });
  return others === 0;
}

export async function createUser(input: {
  name: string;
  email: string;
  role: string;
  region: string;
  tempPassword: string;
}): Promise<ActionResult<{ name: string }>> {
  return guard(async () => {
    const me = await admin();
    const name = input.name.trim().replace(/\s+/g, " ").slice(0, 120);
    const email = input.email.trim().toLowerCase();
    const fieldErrors: Record<string, string> = {};
    if (!name) fieldErrors.name = "Enter their name.";
    if (!/^[^\s@]+@waterregime\.com$/.test(email)) fieldErrors.email = "Use a @waterregime.com address.";
    else if (await store().first("users", { where: { email } })) fieldErrors.email = "Someone already uses this email.";
    if (!ROLE_KEYS.includes(input.role as Role)) fieldErrors.role = "Choose a role.";
    const pwProblem = passwordProblem(input.tempPassword);
    if (pwProblem) fieldErrors.temp = pwProblem;
    if (Object.keys(fieldErrors).length) return fail("Check the highlighted fields.", fieldErrors);

    const u = await store().insert("users", {
      name,
      email,
      role: input.role,
      region: input.region.trim().slice(0, 80) || null,
      passwordHash: await hashPassword(input.tempPassword),
      mustChangePassword: true,
      isActive: true,
    });
    await logAction(me, "user", u.id, "created", `${u.name} (${u.email}) · ${roleLabel(u.role)} — must change password at first sign-in`);
    refresh();
    return ok({ name: u.name });
  });
}

export async function changeUserRole(userId: number, role: string): Promise<ActionResult<{ name: string; from: string; to: string }>> {
  return guard(async () => {
    const me = await admin();
    if (!ROLE_KEYS.includes(role as Role)) return fail("Choose a role.");
    if (userId === me.id) return fail("You can’t change your own role. Ask another admin.");
    const u = await targetUser(userId);
    if (u.role === role) return ok({ name: u.name, from: roleLabel(u.role), to: roleLabel(role) });
    if (u.role === "admin" && u.isActive && (await isLastActiveAdmin(u.id))) return fail("This is the last active admin. Make someone else an admin first.");
    await store().update("users", u.id, { role, sessionVersion: u.sessionVersion + 1 });
    const from = roleLabel(u.role);
    const to = roleLabel(role);
    await logAction(me, "user", u.id, "role changed", `${u.name}: ${from} → ${to}`);
    refresh();
    return ok({ name: u.name, from, to });
  });
}

export async function resetUserPassword(userId: number, tempPassword: string): Promise<ActionResult<{ name: string }>> {
  return guard(async () => {
    const me = await admin();
    if (userId === me.id) return fail("Use Change password for your own account.");
    const problem = passwordProblem(tempPassword);
    if (problem) return fail(problem);
    const u = await targetUser(userId);
    await store().update("users", u.id, {
      passwordHash: await hashPassword(tempPassword),
      mustChangePassword: true,
      sessionVersion: u.sessionVersion + 1,
      failedAttempts: 0,
      lockedUntil: null,
    });
    await logAction(me, "user", u.id, "password reset", `${u.name} — must change at next login`);
    refresh();
    return ok({ name: u.name });
  });
}

export async function setUserActive(userId: number, active: boolean): Promise<ActionResult<{ name: string }>> {
  return guard(async () => {
    const me = await admin();
    if (userId === me.id && !active) return fail("You can’t deactivate yourself.");
    const u = await targetUser(userId);
    if (u.isActive === active) return ok({ name: u.name });
    if (!active && u.role === "admin" && (await isLastActiveAdmin(u.id))) return fail("This is the last active admin and can’t be deactivated.");
    // Deactivating signs them out everywhere.
    await store().update("users", u.id, active ? { isActive: true } : { isActive: false, sessionVersion: u.sessionVersion + 1 });
    await logAction(me, "user", u.id, active ? "activated" : "deactivated", u.name);
    refresh();
    return ok({ name: u.name });
  });
}
