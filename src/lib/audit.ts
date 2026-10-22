import "server-only";
import { store } from "@/lib/data/store";

export type AuditEntity = "company" | "contact" | "visit" | "deal" | "proposal" | "user";

/** Records who changed what, so nothing can be changed silently. */
export async function logAction(
  user: { id: number } | null,
  entity: AuditEntity,
  entityId: number | null,
  action: string,
  detail: string,
) {
  await store().insert("auditLog", { userId: user?.id ?? null, entity, entityId, action, detail: detail.slice(0, 2000) });
}
