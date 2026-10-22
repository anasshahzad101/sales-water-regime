/**
 * Data access layer for the signed-in user. Every page and server action goes through
 * these helpers, so authorisation is checked next to the data, not just in the UI.
 */
import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { roleLabel, type Role } from "@/lib/constants";
import { store } from "@/lib/data/store";
import { initials } from "@/lib/format";
import { SESSION_COOKIE, verifySession } from "./session";

export type CurrentUser = {
  id: number;
  name: string;
  email: string;
  role: Role;
  roleLabel: string;
  region: string | null;
  initials: string;
  mustChangePassword: boolean;
  sessionVersion: number;
  canEdit: boolean;
  isManager: boolean;
  isAdmin: boolean;
  isCeo: boolean;
};

/** The signed-in user for this request, or null. Deduplicated per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);
  if (!session) return null;
  const u = await store().get("users", session.uid);
  if (!u || !u.isActive || u.sessionVersion !== session.ver) return null;
  const role = u.role as Role;
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    role,
    roleLabel: roleLabel(role),
    region: u.region,
    initials: initials(u.name),
    mustChangePassword: u.mustChangePassword,
    sessionVersion: u.sessionVersion,
    canEdit: role !== "ceo",
    isManager: role === "manager" || role === "admin",
    isAdmin: role === "admin",
    isCeo: role === "ceo",
  };
});

/** For pages: redirects to sign-in, or to the forced password change, when needed. */
export async function requireUser(opts: { allowMustChange?: boolean } = {}): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) {
    const path = (await headers()).get("x-wr-path");
    redirect(path && path.startsWith("/") && !path.startsWith("//") ? `/signin?next=${encodeURIComponent(path)}` : "/signin");
  }
  if (user.mustChangePassword && !opts.allowMustChange) redirect("/set-password");
  return user;
}

export class AuthError extends Error {}

/** For server actions: throws instead of redirecting so the action can report the error. */
export async function requireActionUser(opts: { edit?: boolean; roles?: Role[] } = {}): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError("Your session has ended. Sign in again.");
  if (user.mustChangePassword) throw new AuthError("Set your own password first.");
  if (opts.edit && !user.canEdit) throw new AuthError("Read-only access — this action is disabled.");
  if (opts.roles && !opts.roles.includes(user.role)) throw new AuthError("You don't have access to do that.");
  return user;
}

/** Pages the CEO (read-only) may open; everything else shows the 403 page for that role. */
export const CEO_ALLOWED = ["cockpit", "account", "deal", "change-password"] as const;

/** Whether the user may change a record owned by `ownerId`. */
export function canChange(user: CurrentUser, ownerId: number | null | undefined): boolean {
  if (!user.canEdit) return false;
  return user.isManager || ownerId == null || ownerId === user.id;
}
