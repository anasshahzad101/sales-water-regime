/**
 * Signed session cookie (HS256 JWT). Safe to import from the proxy — no Node-only APIs.
 * The cookie only carries the user id, session version and role; every request still
 * re-checks the user in the database (see dal.ts).
 */
import { jwtVerify, SignJWT } from "jose";

export const SESSION_COOKIE = "wr_session";
export const SESSION_DAYS = 30;

export type SessionPayload = { uid: number; ver: number; role: string };

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SESSION_SECRET must be set (at least 32 characters) in production.");
    }
    return new TextEncoder().encode("wr-sales-hub-local-development-secret-not-for-production");
  }
  return new TextEncoder().encode(secret);
}

export async function signSession(p: SessionPayload): Promise<string> {
  return new SignJWT({ ver: p.ver, role: p.role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(p.uid))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_DAYS}d`)
    .sign(secretKey());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    const uid = Number(payload.sub);
    if (!Number.isInteger(uid)) return null;
    return { uid, ver: Number(payload.ver), role: String(payload.role) };
  } catch {
    return null;
  }
}

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
  maxAge: SESSION_DAYS * 24 * 3600,
};
