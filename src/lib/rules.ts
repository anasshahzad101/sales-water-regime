import { DORMANT_DAYS, OPEN_STAGES, OUTCOME_GRACE_HOURS, STUCK_STAGE_DAYS, type StageKey } from "./constants";
import { daysSince, hoursSince } from "./time";

export const isOpenStage = (stage: string) => OPEN_STAGES.includes(stage as StageKey);

/** Hours left in the 48-hour outcome window (negative once overdue). */
export function outcomeHoursLeft(visitAt: Date, now: Date): number {
  return OUTCOME_GRACE_HOURS - hoursSince(visitAt, now);
}

export const isOutcomeOverdue = (visitAt: Date, now: Date) => outcomeHoursLeft(visitAt, now) <= 0;

export function daysInStage(stageEnteredAt: Date, now: Date): number {
  return Math.max(0, daysSince(stageEnteredAt, now));
}

export function isStuck(deal: { stage: string; stageEnteredAt: Date }, now: Date): boolean {
  return isOpenStage(deal.stage) && daysInStage(deal.stageEnteredAt, now) > STUCK_STAGE_DAYS;
}

/** Open deal whose expected close date (YYYY-MM-DD) is before today (PKT). */
export function isClosePassed(deal: { stage: string; expectedClose: string | null }, today: string): boolean {
  return isOpenStage(deal.stage) && !!deal.expectedClose && deal.expectedClose < today;
}

/**
 * An owned, non-archived account with no visit in DORMANT_DAYS. Days are counted from the
 * last visit, or from when the current owner took it on if there has been no visit since.
 */
export function dormancy(
  company: { ownerId: number | null; status: string; ownerSince: Date | null },
  lastVisitAt: Date | null,
  now: Date,
): { dormant: boolean; days: number | null } {
  const ref = lastVisitAt ?? company.ownerSince;
  const days = ref ? daysSince(ref, now) : null;
  const dormant = !!company.ownerId && company.status !== "archived" && days != null && days > DORMANT_DAYS;
  return { dormant, days };
}

/** Status shown in the UI: archived (stored), dormant (derived) or active. */
export function displayStatus(storedStatus: string, dormant: boolean): "active" | "dormant" | "archived" {
  if (storedStatus === "archived") return "archived";
  return dormant ? "dormant" : "active";
}
