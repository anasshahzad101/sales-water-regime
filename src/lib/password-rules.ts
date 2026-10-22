import { MIN_PASSWORD_LENGTH } from "./constants";

export type Strength = { n: 0 | 1 | 2 | 3 | 4; label: "" | "Too short" | "Weak" | "Good" | "Strong" };

/** Strength meter used on the password screens; 2 ("Weak") or better can be saved. */
export function passwordStrength(pw: string): Strength {
  if (!pw) return { n: 0, label: "" };
  if (pw.length < MIN_PASSWORD_LENGTH) return { n: 1, label: "Too short" };
  const k = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length + (pw.length >= 12 ? 1 : 0);
  return k >= 4 ? { n: 4, label: "Strong" } : k >= 3 ? { n: 3, label: "Good" } : { n: 2, label: "Weak" };
}

/** Returns an error message, or null when the password is acceptable. */
export function passwordProblem(pw: string): string | null {
  if (pw.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (pw.length > 128) return "Use 128 characters or fewer.";
  return null;
}
