"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { logAction } from "@/lib/audit";
import { getCurrentUser } from "@/lib/auth/dal";
import { burnPasswordCheck, hashPassword, verifyPassword } from "@/lib/auth/password";
import { SESSION_COOKIE, sessionCookieOptions, signSession } from "@/lib/auth/session";
import { LOGIN_LOCK_MINUTES, LOGIN_MAX_ATTEMPTS } from "@/lib/constants";
import { store } from "@/lib/data/store";
import { passwordProblem } from "@/lib/password-rules";

export type SigninState = {
  email?: string;
  emailErr?: string;
  alert?: "wrong" | "locked" | "deactivated";
  attemptsLeft?: number;
  until?: string;
};

const homeFor = (role: string) => (role === "ceo" ? "/cockpit" : "/my-week");

function safeNext(next: FormDataEntryValue | null): string | null {
  const n = typeof next === "string" ? next : "";
  return n.startsWith("/") && !n.startsWith("//") && !n.startsWith("/signin") ? n : null;
}

async function startSession(u: { id: number; sessionVersion: number; role: string }) {
  const token = await signSession({ uid: u.id, ver: u.sessionVersion, role: u.role });
  (await cookies()).set(SESSION_COOKIE, token, sessionCookieOptions);
}

export async function signIn(_prev: SigninState, formData: FormData): Promise<SigninState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email) return { emailErr: "Enter your email address." };

  const db = store();
  const user = await db.first("users", { where: { email } });
  const now = new Date();

  if (user?.lockedUntil && user.lockedUntil > now) {
    return { email, alert: "locked", until: user.lockedUntil.toISOString() };
  }
  if (!user) {
    await burnPasswordCheck(password);
    return { email, alert: "wrong" };
  }
  if (!(await verifyPassword(password, user.passwordHash))) {
    const attempts = user.failedAttempts + 1;
    if (attempts >= LOGIN_MAX_ATTEMPTS) {
      const until = new Date(now.getTime() + LOGIN_LOCK_MINUTES * 60_000);
      await db.update("users", user.id, { failedAttempts: 0, lockedUntil: until });
      await logAction(user, "user", user.id, "sign-in locked", `${user.email}: ${LOGIN_MAX_ATTEMPTS} failed attempts`);
      return { email, alert: "locked", until: until.toISOString() };
    }
    await db.update("users", user.id, { failedAttempts: attempts });
    return { email, alert: "wrong", attemptsLeft: LOGIN_MAX_ATTEMPTS - attempts };
  }
  if (!user.isActive) return { email, alert: "deactivated" };

  await db.update("users", user.id, { failedAttempts: 0, lockedUntil: null, lastLoginAt: now });
  await startSession(user);
  redirect(user.mustChangePassword ? "/set-password" : (safeNext(formData.get("next")) ?? homeFor(user.role)));
}

export async function signOut() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/signin");
}

export type PasswordState = { ok?: boolean; redirectTo?: string; curErr?: string; npErr?: string; error?: string };

async function savePassword(mode: "set" | "change", formData: FormData): Promise<PasswordState> {
  const me = await getCurrentUser();
  if (!me) return { error: "Your session has ended. Sign in again." };
  const db = store();
  const user = await db.get("users", me.id);
  if (!user) return { error: "Account not found." };

  const np = String(formData.get("new") ?? "");
  const cp = String(formData.get("confirm") ?? "");
  if (mode === "change") {
    const cur = String(formData.get("current") ?? "");
    if (!cur) return { curErr: "Enter your current password." };
    if (!(await verifyPassword(cur, user.passwordHash))) return { curErr: "That isn’t your current password." };
  }
  const problem = passwordProblem(np);
  if (problem) return { npErr: problem };
  if (np !== cp) return { npErr: "Passwords don’t match." };
  if (await verifyPassword(np, user.passwordHash)) return { npErr: "Choose a password different from the current one." };

  const updated = await db.update("users", user.id, {
    passwordHash: await hashPassword(np),
    mustChangePassword: false,
    sessionVersion: user.sessionVersion + 1,
  });
  await startSession(updated!); // keeps this device signed in; other devices are signed out
  await logAction(me, "user", me.id, mode === "set" ? "password set" : "password changed", user.email);
  return { ok: true, redirectTo: homeFor(user.role) };
}

export async function setOwnPassword(_prev: PasswordState, formData: FormData) {
  return savePassword("set", formData);
}

export async function changePassword(_prev: PasswordState, formData: FormData) {
  return savePassword("change", formData);
}
