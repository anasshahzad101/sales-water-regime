export type ActionResult<T = undefined> =
  | { ok: true; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export const ok = <T,>(data?: T): ActionResult<T> => ({ ok: true, data });
export const fail = (error: string, fieldErrors?: Record<string, string>): ActionResult<never> => ({ ok: false, error, fieldErrors });

/** Turns thrown auth/validation errors into a result the client can show. */
export async function guard<T>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (e) {
    // Let Next.js redirects / not-found propagate.
    if (e && typeof e === "object" && "digest" in e && typeof (e as { digest: unknown }).digest === "string") {
      const d = (e as { digest: string }).digest;
      if (d.startsWith("NEXT_REDIRECT") || d.startsWith("NEXT_HTTP_ERROR_FALLBACK") || d === "NEXT_NOT_FOUND") throw e;
    }
    console.error(e);
    return fail(e instanceof Error ? e.message : "Something went wrong. Try again.");
  }
}
