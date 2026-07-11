import type { TFunction } from "i18next";
import { getMedicationUnitLabel } from "../lib/medicationUnits";
import type { Medication } from "../medications/types";
import type {
  DayOfWeek,
  Routine,
  Schedule,
  TitrationPhase,
  TreatmentType,
} from "./types";

export function formatTreatmentType(t: TFunction, treatmentType?: TreatmentType | null) {
  if (treatmentType === "temporary") {
    return t("routines.temporary");
  }

  if (treatmentType === "as_needed") {
    return t("routines.asNeeded");
  }

  return t("routines.continuous");
}

export function formatRoutineStatus(t: TFunction, routine: Routine) {
  if (routine.active && routine.status === "active") {
    return t("routines.active");
  }

  if (["cancelled", "paused", "completed", "draft"].includes(routine.status)) {
    return t(`routines.${routine.status}`, { defaultValue: routine.status });
  }

  return t("routines.inactive");
}

export function formatTimeOfDay(t: TFunction, timeOfDay?: string | null) {
  if (!timeOfDay) {
    return t("routines.timeNotSet");
  }

  const match = timeOfDay.match(/^(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : timeOfDay;
}

export function mapPostgresDayToLabel(t: TFunction, day: number) {
  return t(`days.short.${day}`, { defaultValue: String(day) });
}

export function formatDateRange(
  t: TFunction,
  locale: string,
  startDate?: string | null,
  endDate?: string | null,
) {
  const start = formatDate(startDate, locale);
  const end = formatDate(endDate, locale);

  if (start && end) {
    return `${start} \u2013 ${end}`;
  }

  if (start) {
    return t("dates.starts", { date: start });
  }

  if (end) {
    return t("dates.ends", { date: end });
  }

  return null;
}

export function formatScheduleSummary(
  t: TFunction,
  schedule?: Schedule | null,
  defaultDoseUnit?: string | null,
) {
  if (!schedule) {
    return t("routines.noSchedule");
  }

  const time = formatTimeOfDay(t, schedule.time_of_day);

  if (schedule.schedule_type === "weekly") {
    const days = schedule.days_of_week?.map((day) => mapPostgresDayToLabel(t, day)).join(", ");
    return days
      ? t("routines.weeklyOnAt", { days, time })
      : t("routines.weeklyAt", { time });
  }

  if (schedule.schedule_type === "interval") {
    return schedule.interval_hours
      ? t("routines.everyHoursStarting", { hours: schedule.interval_hours, time })
      : t("routines.intervalUnknown", { time });
  }

  if (schedule.schedule_type === "custom") {
    if (schedule.custom_rule?.kind === "every_n_weeks") {
      return t("routines.everyNWeeksOnAt", {
        count: schedule.custom_rule.interval_weeks,
        day: t(`days.long.${schedule.custom_rule.weekday}`),
        time,
      });
    }
    if (schedule.custom_rule?.kind === "monthly_day") {
      return t("routines.monthlyDayAt", {
        day: schedule.custom_rule.day_of_month,
        time,
      });
    }
    if (schedule.custom_rule?.kind === "cycle_days") {
      const window = schedule.custom_rule.active_windows[0];
      const active = t("routines.cycleDaysAt", {
        cycle: schedule.custom_rule.cycle_length_days,
        end: window.end_day,
        start: window.start_day,
        time,
      });
      return window.end_day < schedule.custom_rule.cycle_length_days
        ? `${active}. ${t("routines.cyclePause", {
            end: schedule.custom_rule.cycle_length_days,
            start: window.end_day + 1,
          })}`
        : active;
    }
    if (schedule.custom_rule?.kind === "titration_phases") {
      const phase = getCurrentTitrationPhase(
        schedule.custom_rule.phases,
        schedule.custom_rule.anchor_date,
      );
      return phase
        ? t("routines.currentPhaseSummary", {
            dose: formatPhaseDose(t, phase, defaultDoseUnit),
            phase: phase.title,
            schedule: formatPhaseSchedule(t, phase),
          })
        : t("routines.phasedUse");
    }
  }

  return t("routines.dailyAt", { time });
}

export function getCurrentTitrationPhase(
  phases: TitrationPhase[],
  anchorDate: string,
  today = new Date(),
) {
  const anchor = new Date(`${anchorDate}T12:00:00`);
  if (Number.isNaN(anchor.getTime())) {
    return null;
  }
  const localToday = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  const elapsedDays = Math.floor((localToday.getTime() - anchor.getTime()) / 86400000);
  if (elapsedDays < 0) {
    return phases[0] ?? null;
  }
  let cursor = 0;
  for (const phase of phases) {
    if (phase.duration_days == null || elapsedDays < cursor + phase.duration_days) {
      return phase;
    }
    cursor += phase.duration_days;
  }
  return null;
}

export function formatPhaseDose(
  t: TFunction,
  phase: TitrationPhase,
  defaultDoseUnit?: string | null,
) {
  if (phase.dose_quantity == null) {
    return "";
  }
  return `${phase.dose_quantity} ${getMedicationUnitLabel(
    t,
    normalizeDoseUnit(phase.dose_unit, defaultDoseUnit),
  )}`.trim();
}

export function formatPhaseSchedule(t: TFunction, phase: TitrationPhase) {
  const schedule = phase.schedule;
  if (!schedule) {
    return t("routines.phaseInactive");
  }
  const time = formatTimeOfDay(t, schedule.time_of_day);
  if (schedule.schedule_type === "weekly") {
    const days = (schedule.days_of_week ?? [])
      .map((day) => mapPostgresDayToLabel(t, day))
      .join(", ");
    return t("routines.weeklyOnAt", { days, time });
  }
  if (schedule.schedule_type === "interval") {
    return t("routines.everyHoursStarting", {
      hours: schedule.interval_hours,
      time,
    });
  }
  return t("routines.dailyAt", { time });
}

export function formatDose(
  t: TFunction,
  routine: Routine,
  defaultDoseUnit?: string | null,
) {
  if (routine.dose_quantity === null || routine.dose_quantity === undefined) {
    return null;
  }

  const quantity = Number.isInteger(routine.dose_quantity)
    ? String(routine.dose_quantity)
    : String(routine.dose_quantity);

  const unit = getMedicationUnitLabel(t, normalizeDoseUnit(routine.dose_unit, defaultDoseUnit));
  return unit ? `${quantity} ${unit}` : quantity;
}

export function normalizeDoseUnit(unit?: string | null, defaultDoseUnit?: string | null) {
  const trimmedUnit = unit?.trim() ?? "";
  const trimmedDefaultDoseUnit = defaultDoseUnit?.trim() ?? "";

  if (!trimmedUnit) {
    return trimmedDefaultDoseUnit;
  }

  if (
    trimmedDefaultDoseUnit &&
    trimmedUnit.length === 1 &&
    trimmedDefaultDoseUnit.toLowerCase().startsWith(trimmedUnit.toLowerCase())
  ) {
    return trimmedDefaultDoseUnit;
  }

  return trimmedUnit;
}

export function formatAsNeededLimits(t: TFunction, routine: Routine) {
  const limits = routine.as_needed_limits;
  if (!limits) {
    return [];
  }
  const periodHours =
    limits.period_minutes == null ? null : limits.period_minutes / 60;
  const values: string[] = [];
  if (limits.max_uses_per_period != null && periodHours != null) {
    values.push(
      t("routines.maxUsesInHours", {
        hours: periodHours,
        uses: limits.max_uses_per_period,
      }),
    );
  }
  if (limits.max_dose_quantity_per_period != null && periodHours != null) {
    values.push(
      t("routines.maxDoseInHours", {
        dose: limits.max_dose_quantity_per_period,
        hours: periodHours,
      }),
    );
  }
  if (limits.min_interval_minutes != null) {
    values.push(
      t("routines.minIntervalHours", {
        hours: limits.min_interval_minutes / 60,
      }),
    );
  }
  return values;
}

export function getMedicationForRoutine(routine: Routine, medications: Medication[]) {
  return medications.find((medication) => medication.id === routine.medication_id);
}

export function isRoutineActive(routine: Routine) {
  return routine.active && routine.status === "active";
}

export function isRoutineAsNeeded(routine: Routine) {
  return routine.treatment_type === "as_needed";
}

export function isRoutineVisibleInPrimaryList(routine: Routine, today = new Date()) {
  if (routine.status === "cancelled" || routine.status === "completed") {
    return false;
  }

  if (isRoutineEnded(routine, today)) {
    return false;
  }

  if (routine.status === "paused") {
    return true;
  }

  return isRoutineActive(routine);
}

export function getActiveRoutines(routines: Routine[]) {
  return routines.filter(isRoutineActive);
}

export type TodayRoutineSchedule = {
  routine: Routine;
  schedule: Schedule;
};

export function getTodayRoutineSchedules(routines: Routine[], today = new Date()) {
  const todayDay = today.getDay() as DayOfWeek;
  const todayDateKey = toDateKey(today);

  return routines
    .filter((routine) => isRoutineActive(routine) && isRoutineInDateRange(routine, todayDateKey))
    .flatMap((routine) =>
      (routine.schedules ?? [])
        .filter((schedule) => isScheduleActiveToday(schedule, todayDay))
        .map((schedule) => ({ routine, schedule })),
    )
    .sort((a, b) => scheduleMinutes(a.schedule) - scheduleMinutes(b.schedule));
}

function isScheduleActiveToday(schedule: Schedule, todayDay: DayOfWeek) {
  if (!schedule.is_active) {
    return false;
  }

  if (schedule.schedule_type === "weekly") {
    return Boolean(schedule.days_of_week?.includes(todayDay));
  }

  return schedule.schedule_type === "daily" || schedule.schedule_type === "interval";
}

function isRoutineInDateRange(routine: Routine, todayDateKey: string) {
  if (routine.treatment_type !== "temporary") {
    return true;
  }

  if (routine.start_date && routine.start_date > todayDateKey) {
    return false;
  }

  if (routine.end_date && routine.end_date < todayDateKey) {
    return false;
  }

  return true;
}

function isRoutineEnded(routine: Routine, today: Date) {
  if (!routine.end_date) {
    return false;
  }

  return routine.end_date < toDateKey(today);
}

function scheduleMinutes(schedule: Schedule) {
  const match = schedule.time_of_day.match(/^(\d{2}):(\d{2})/);

  if (!match) {
    return Number.MAX_SAFE_INTEGER;
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

function formatDate(dateValue: string | null | undefined, locale: string) {
  if (!dateValue) {
    return null;
  }

  const [year, month, day] = dateValue.split("-").map(Number);

  if (!year || !month || !day) {
    return dateValue;
  }

  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(year, month - 1, day));
}

function toDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}
