/**
 * AI_CONTEXT
 * repo: luma-front-webapp
 * layer: form-config
 * domain: routines
 * purpose: Shared option lists for routine create/edit forms.
 * entrypoints:
 *   - periodOptions
 *   - scheduleOptions
 *   - dayOptions
 * reads:
 *   - routine type definitions
 * mutates:
 *   - none
 * used_by:
 *   - RoutineCreateModal
 *   - RoutineEditModal
 * read_first_when:
 *   - Changing routine form option availability or labels.
 * avoid_reading_when:
 *   - Only changing payload conversion.
 * invariants:
 *   - Option values must stay aligned with luma-core schedule and treatment enums.
 */
import type { CustomScheduleRule, DayOfWeek, ScheduleType, TreatmentType } from "./types";

export const periodOptions: { labelKey: string; value: Exclude<TreatmentType, "as_needed"> }[] = [
  { labelKey: "routines.continuous", value: "continuous" },
  { labelKey: "routines.temporary", value: "temporary" },
];

export const scheduleOptions: {
  customKind?: Exclude<CustomScheduleRule["kind"], "titration_phases">;
  labelKey: string;
  value: ScheduleType;
}[] = [
  { labelKey: "routines.daily", value: "daily" },
  { labelKey: "routines.weekly", value: "weekly" },
  { labelKey: "routines.everyXHours", value: "interval" },
  {
    customKind: "every_n_weeks",
    labelKey: "addMedication.scheduleOptions.everyNWeeks.label",
    value: "custom",
  },
  {
    customKind: "monthly_day",
    labelKey: "addMedication.scheduleOptions.monthly.label",
    value: "custom",
  },
  {
    customKind: "cycle_days",
    labelKey: "addMedication.scheduleOptions.cycle.label",
    value: "custom",
  },
];

export const dayOptions: DayOfWeek[] = [0, 1, 2, 3, 4, 5, 6];
