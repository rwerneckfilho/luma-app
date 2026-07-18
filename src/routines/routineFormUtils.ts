/**
 * AI_CONTEXT
 * repo: luma-front-webapp
 * layer: form-utils
 * domain: routines
 * purpose: Shared routine form helpers for dose parsing and default custom schedule rules.
 * entrypoints:
 *   - parseDoseQuantity
 *   - createCustomRule
 * reads:
 *   - routine form values
 * mutates:
 *   - none
 * used_by:
 *   - RoutineCreateModal
 *   - RoutineEditModal
 *   - routineSchema
 * read_first_when:
 *   - Changing default custom schedule shape or dose payload parsing.
 * avoid_reading_when:
 *   - Only changing routine card display formatting.
 * invariants:
 *   - Parsed empty dose quantities must remain null, not zero.
 */
import type { CustomScheduleRule, DayOfWeek } from "./types";

export function parseDoseQuantity(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function createCustomRule(
  kind: Exclude<CustomScheduleRule["kind"], "titration_phases">,
  anchorDate: string,
): CustomScheduleRule {
  if (kind === "monthly_day") {
    return {
      anchor_date: anchorDate,
      day_of_month: 1,
      kind,
      missing_day_policy: "last_day",
      version: 1,
    };
  }

  if (kind === "cycle_days") {
    return {
      active_windows: [{ end_day: 21, start_day: 1 }],
      anchor_date: anchorDate,
      cycle_length_days: 28,
      kind,
      version: 1,
    };
  }

  return {
    anchor_date: anchorDate,
    interval_weeks: 2,
    kind,
    version: 1,
    weekday: new Date(`${anchorDate}T12:00:00`).getDay() as DayOfWeek,
  };
}
