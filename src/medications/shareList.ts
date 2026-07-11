import type { TFunction } from "i18next";
import { getMedicationUnitLabel } from "../lib/medicationUnits";
import type { Routine, Schedule } from "../routines/types";
import {
  formatDateRange,
  formatAsNeededLimits,
  formatDose,
  formatPhaseDose,
  formatPhaseSchedule,
  formatRoutineStatus,
  formatTimeOfDay,
  isRoutineAsNeeded,
  isRoutineVisibleInPrimaryList,
  mapPostgresDayToLabel,
} from "../routines/routineUtils";
import type { Medication } from "./types";

type MedicationWithRoutines = {
  medication: Medication;
  routines: Routine[];
};

type BuildMedicationShareTextInput = {
  generatedAt: Date;
  items: MedicationWithRoutines[];
  locale: string;
  patientName?: string | null;
  t: TFunction;
};

export function buildMedicationShareText({
  generatedAt,
  items,
  locale,
  patientName,
  t,
}: BuildMedicationShareTextInput) {
  const formattedDateTime = formatShareDateTime(generatedAt, locale);
  const titleName = patientName?.trim();
  const lines = [
    titleName
      ? t("medications.share.text.titleWithName", { name: titleName })
      : t("medications.share.text.title"),
    t("medications.share.text.updatedAt", { dateTime: formattedDateTime }),
    "",
    t("medications.share.text.disclaimer"),
    "",
  ];
  const medicationsWithoutSchedules: Medication[] = [];

  items.forEach(({ medication, routines }, index) => {
    const visibleRoutines = routines.filter((routine) => isRoutineVisibleInPrimaryList(routine));

    lines.push(`${index + 1}. ${medication.name}`);
    pushIndentedLine(lines, t("addMedication.fields.dosage"), medication.dosage_text);
    pushIndentedLine(
      lines,
      t("medications.share.text.defaultUnit"),
      getMedicationUnitLabel(t, medication.form),
    );
    pushIndentedLine(lines, t("medications.reason"), medication.medication_reason);
    pushIndentedLine(lines, t("medications.prescribingDoctor"), medication.prescribing_doctor_name);
    pushIndentedLine(lines, t("addMedication.fields.notes"), medication.notes);

    if (visibleRoutines.length > 0) {
      lines.push("");
      lines.push(t("medications.share.text.schedulesAndDoses"));
      lines.push("");
      visibleRoutines.forEach((routine) => {
        lines.push(`* ${formatSharedRoutine(t, locale, routine, medication.form)}`);
      });
    } else {
      medicationsWithoutSchedules.push(medication);
    }

    lines.push("");
  });

  if (medicationsWithoutSchedules.length > 0) {
    lines.push(t("medications.share.text.medicationsWithoutSchedules"));
    lines.push("");
    medicationsWithoutSchedules.forEach((medication) => {
      lines.push(`* ${medication.name}`);
    });
    lines.push("");
  }

  return trimTrailingBlankLines(lines).join("\n");
}

function formatSharedRoutine(
  t: TFunction,
  locale: string,
  routine: Routine,
  defaultDoseUnit?: string | null,
) {
  if (isRoutineAsNeeded(routine)) {
    const parts = [
      t("medications.share.text.asNeeded", {
        dose: formatDose(t, routine, defaultDoseUnit) ?? t("medications.share.text.noDose"),
      }),
      routine.instructions
        ? t("medications.share.text.whenToUse", { instructions: routine.instructions })
        : null,
      ...formatAsNeededLimits(t, routine),
    ].filter(Boolean);

    if (!(routine.active && routine.status === "active")) {
      parts.push(t("medications.share.text.status", { status: formatRoutineStatus(t, routine) }));
    }

    return parts.join(". ");
  }

  const phasedSchedules = (routine.schedules ?? []).filter(
    (schedule) => schedule.custom_rule?.kind === "titration_phases",
  );
  if (phasedSchedules.length > 0) {
    const firstRule = phasedSchedules[0].custom_rule;
    if (firstRule?.kind === "titration_phases") {
      const phases = firstRule.phases.map((phase, phaseIndex) => {
        const slotPhases = phasedSchedules
          .map((schedule) =>
            schedule.custom_rule?.kind === "titration_phases"
              ? schedule.custom_rule.phases[phaseIndex]
              : null,
          )
          .filter((item) => item?.schedule);
        const details = slotPhases.map(
          (item) =>
            `${formatPhaseDose(t, item!, defaultDoseUnit)} — ${formatPhaseSchedule(t, item!)}`,
        );
        return `${phase.title}: ${details.join("; ")}`;
      });
      return `${t("routines.phasedUse")}: ${phases.join(" | ")}`;
    }
  }

  const parts = [
    formatDose(t, routine, defaultDoseUnit),
    ...(routine.schedules && routine.schedules.length > 0
      ? routine.schedules.map((schedule) => formatSharedSchedule(t, schedule))
      : [t("medications.share.text.noSchedule")]),
    formatDateRange(t, locale, routine.start_date, routine.end_date),
  ].filter(Boolean);

  if (!(routine.active && routine.status === "active")) {
    parts.push(t("medications.share.text.status", { status: formatRoutineStatus(t, routine) }));
  }

  return parts.join(", ");
}

function formatSharedSchedule(t: TFunction, schedule: Schedule) {
  const time = formatTimeOfDay(t, schedule.time_of_day);

  if (schedule.schedule_type === "weekly") {
    const days = schedule.days_of_week?.map((day) => mapPostgresDayToLabel(t, day)).join(", ");
    return days
      ? t("medications.share.text.weeklyOnAt", { days, time })
      : t("medications.share.text.weeklyAt", { time });
  }

  if (schedule.schedule_type === "interval") {
    return schedule.interval_hours
      ? t("medications.share.text.everyHoursStarting", {
          hours: schedule.interval_hours,
          time,
        })
      : t("medications.share.text.intervalUnknown", { time });
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
      return t("medications.share.text.monthlyDayAtLastDay", {
        day: schedule.custom_rule.day_of_month,
        time,
      });
    }
    if (schedule.custom_rule?.kind === "cycle_days") {
      const window = schedule.custom_rule.active_windows[0];
      return t(
        window.end_day < schedule.custom_rule.cycle_length_days
          ? "medications.share.text.cycleDaysAtWithPause"
          : "medications.share.text.cycleDaysAt",
        {
          cycle: schedule.custom_rule.cycle_length_days,
          end: window.end_day,
          pauseEnd: schedule.custom_rule.cycle_length_days,
          pauseStart: window.end_day + 1,
          start: window.start_day,
          time,
        },
      );
    }
  }

  return t("medications.share.text.dailyAt", { time });
}

function pushIndentedLine(lines: string[], label: string, value?: string | null) {
  const trimmed = value?.trim();
  if (trimmed) {
    lines.push(`   ${label}: ${trimmed}`);
  }
}

function formatShareDateTime(value: Date, locale: string) {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}

function trimTrailingBlankLines(lines: string[]) {
  const trimmed = [...lines];
  while (trimmed[trimmed.length - 1] === "") {
    trimmed.pop();
  }
  return trimmed;
}
