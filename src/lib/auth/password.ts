import "server-only";
import bcrypt from "bcryptjs";

export function hashPassword(pw: string) {
  return bcrypt.hash(pw, 10);
}

export function verifyPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

// Compared against when the email is unknown, so wrong emails take as long as wrong passwords.
let dummyHash: string | null = null;
export function burnPasswordCheck(pw: string) {
  dummyHash ??= bcrypt.hashSync("wr-not-a-real-password", 10);
  return bcrypt.compare(pw, dummyHash);
}
