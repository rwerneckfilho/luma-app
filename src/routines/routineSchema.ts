/**
 * AI_CONTEXT
 * repo: luma-front-webapp
 * layer: schema
 * domain: routines
 * purpose: Zod schemas and payload mappers for routine create/edit/revision flows.
 * entrypoints:
 *   - createAddMedicationFlowSchema
 *   - createRoutineEditSchema
 *   - toCreateRoutinePayload
 *   - toRoutineRevisionPayload
 * reads:
 *   - medication form values
 *   - routine edit form values
 * mutates:
 *   - none
 * used_by:
 *   - src/medications/MedicationForm.tsx
 *   - src/routines/RoutineEditModal.tsx
 * read_first_when:
 *   - Changing routine form validation or payload shape.
 * avoid_reading_when:
 *   - Only changing React Query invalidation.
 * invariants:
 *   - Payload conversion must preserve backend routine revision semantics.
 */
import type { TFunction } from "i18next";
import { z } from "zod";
import { emptyToNull } from "../lib/formValues";
import {
  emptyMedicationFormValues,
  createMedicationFormSchema,
} from "../medications/medicationSchema";
import { parseDoseQuantity as parseDoseQuantityForPayload } from "./routineFormUtils";
import { normalizeDoseUnit } from "./routineUtils";
import type {
  CreateRoutinePayload,
  CustomScheduleRule,
  DayOfWeek,
  Routine,
  RoutineRevisionPayload,
  SchedulePayload,
} from "./types";

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const dayOfWeekSchema = z.union([
  z.literal(0),
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
  z.literal(6),
]);

export const treatmentTypeSchema = z.enum(["continuous", "temporary", "as_needed"]);
export const scheduleTypeSchema = z.enum(["daily", "weekly", "interval", "custom"]);

const phaseScheduleSchema = z
  .object({
    days_of_week: z.array(dayOfWeekSchema).nullish(),
    interval_hours: z.number().int().min(1).max(24).nullish(),
    schedule_type: z.enum(["daily", "weekly", "interval"]),
    time_of_day: z.string(),
  })
  .strict();

const titrationPhaseSchema = z
  .object({
    dose_quantity: z.number().positive().nullish(),
    dose_unit: z.string().nullish(),
    duration_days: z.number().int().positive().nullish(),
    order: z.number().int().positive(),
    schedule: phaseScheduleSchema.nullish(),
    title: z.string().min(1),
  })
  .strict();

const customRuleSchema = z.discriminatedUnion("kind", [
  z
    .object({
      anchor_date: z.string().regex(datePattern),
      interval_weeks: z.number().int().min(1).max(52),
      kind: z.literal("every_n_weeks"),
      version: z.literal(1),
      weekday: dayOfWeekSchema,
    })
    .strict(),
  z
    .object({
      anchor_date: z.string().regex(datePattern),
      day_of_month: z.number().int().min(1).max(31),
      kind: z.literal("monthly_day"),
      missing_day_policy: z.literal("last_day"),
      version: z.literal(1),
    })
    .strict(),
  z
    .object({
      active_windows: z
        .array(
          z
            .object({
              end_day: z.number().int().min(1),
              start_day: z.number().int().min(1),
            })
            .strict(),
        )
        .length(1),
      anchor_date: z.string().regex(datePattern),
      cycle_length_days: z.number().int().min(2).max(365),
      kind: z.literal("cycle_days"),
      version: z.literal(1),
    })
    .strict(),
  z
    .object({
      anchor_date: z.string().regex(datePattern),
      kind: z.literal("titration_phases"),
      phases: z.array(titrationPhaseSchema).min(2).max(24),
      version: z.literal(1),
    })
    .strict(),
]);

const createIntervalHoursSchema = (t: TFunction) => z.preprocess(
  (value) => {
    if (value === "" || value === null || value === undefined) {
      return undefined;
    }

    if (typeof value === "number" && Number.isNaN(value)) {
      return undefined;
    }

    return Number(value);
  },
  z
    .number()
    .int(t("validation.hoursWhole"))
    .min(1, t("validation.hoursRange"))
    .max(24, t("validation.hoursRange"))
    .optional(),
);

const createIntegerRangeSchema = (
  t: TFunction,
  minimum: number,
  maximum: number,
  rangeMessage = t("validation.requiredField"),
  integerMessage = t("validation.hoursWhole"),
) => z.preprocess(
  (value) => {
    if (value === "" || value === null || value === undefined) {
      return undefined;
    }
    return Number(value);
  },
  z
    .number()
    .int(integerMessage)
    .min(minimum, rangeMessage)
    .max(maximum, rangeMessage)
    .optional(),
);

const createDoseQuantitySchema = (t: TFunction) => z
  .string()
  .trim()
  .refine((value) => value === "" || isPositiveFiniteNumber(value), {
    message: t("validation.doseQuantityPositive"),
  });

function addRequiredDoseQuantityIssue(
  t: TFunction,
  context: z.RefinementCtx,
  path: (string | number)[],
) {
  context.addIssue({
    code: z.ZodIssueCode.custom,
    message: t("validation.doseQuantityRequired"),
    path,
  });
}

const createOptionalPositiveNumberSchema = (t: TFunction) => z.preprocess(
  (value) => {
    if (value === "" || value === null || value === undefined) {
      return undefined;
    }
    return Number(value);
  },
  z
    .number()
    .positive(t("validation.doseQuantityPositive"))
    .optional(),
);

const createEditableScheduleSchema = (t: TFunction) => z
  .object({
    custom_rule: customRuleSchema.nullish(),
    days_of_week: z.array(dayOfWeekSchema),
    interval_hours: createIntervalHoursSchema(t),
    is_active: z.boolean(),
    schedule_type: scheduleTypeSchema,
    time_of_day: z
      .string()
      .min(1, t("validation.selectTime"))
      .regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, t("validation.validTime")),
  })
  .superRefine((values, context) => {
    if (values.schedule_type === "weekly" && values.days_of_week.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: t("validation.chooseDay"),
        path: ["days_of_week"],
      });
    }

    if (values.schedule_type === "interval" && values.interval_hours === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: t("validation.intervalHoursRange"),
        path: ["interval_hours"],
      });
    }

    if (values.schedule_type === "custom" && !values.custom_rule) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: t("validation.requiredField"),
        path: ["custom_rule"],
      });
    }

    if (
      values.custom_rule?.kind === "every_n_weeks" &&
      !anchorMatchesWeekday(values.custom_rule.anchor_date, values.custom_rule.weekday)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: t("validation.anchorWeekdayMismatch"),
        path: ["custom_rule", "anchor_date"],
      });
    }

    if (values.custom_rule?.kind === "cycle_days") {
      const window = values.custom_rule.active_windows[0];
      if (window.start_day > window.end_day) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("validation.cycleStartAfterEnd"),
          path: ["custom_rule"],
        });
      }
      if (window.end_day > values.custom_rule.cycle_length_days) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("validation.cycleWindowOutsideLength"),
          path: ["custom_rule"],
        });
      }
    }
  });

const createInitialScheduledDoseSchema = (t: TFunction) => z.object({
  dose_quantity: createDoseQuantitySchema(t),
  dose_unit: z.string().trim().optional(),
  time_of_day: z
    .string()
    .min(1, t("validation.selectTime"))
    .regex(/^([01][0-9]|2[0-3]):[0-5][0-9]$/, t("validation.validTime")),
});

const createTitrationPhaseFormSchema = (t: TFunction) => z.object({
  days_of_week: z.array(dayOfWeekSchema),
  doses: z.array(createInitialScheduledDoseSchema(t)).min(1),
  duration_days: createIntegerRangeSchema(t, 1, 3650),
  interval_hours: createIntervalHoursSchema(t),
  schedule_type: z.enum(["daily", "weekly", "interval"]),
  title: z.string().trim().min(1, t("validation.requiredField")),
});

export const createAddMedicationFlowSchema = (t: TFunction) => createMedicationFormSchema(t)
  .extend({
    app_notifications_enabled: z.boolean(),
    as_needed_max_dose_quantity: createOptionalPositiveNumberSchema(t),
    as_needed_max_uses: createIntegerRangeSchema(t, 1, 1000),
    as_needed_min_interval_hours: createOptionalPositiveNumberSchema(t),
    as_needed_period_hours: createOptionalPositiveNumberSchema(t),
    custom_anchor_date: z.string().trim().optional(),
    custom_cycle_end_day: createIntegerRangeSchema(
      t,
      1,
      365,
      t("validation.cycleActiveDayRange"),
      t("validation.cycleWholeDays"),
    ),
    custom_cycle_length_days: createIntegerRangeSchema(
      t,
      2,
      365,
      t("validation.cycleLengthRange"),
      t("validation.cycleWholeDays"),
    ),
    custom_cycle_start_day: createIntegerRangeSchema(
      t,
      1,
      365,
      t("validation.cycleActiveDayRange"),
      t("validation.cycleWholeDays"),
    ),
    custom_day_of_month: createIntegerRangeSchema(t, 1, 31),
    custom_interval_weeks: createIntegerRangeSchema(t, 1, 52),
    custom_kind: z.enum([
      "every_n_weeks",
      "monthly_day",
      "cycle_days",
      "titration_phases",
    ]),
    custom_weekday: dayOfWeekSchema,
    days_of_week: z.array(dayOfWeekSchema),
    dose_quantity: createDoseQuantitySchema(t),
    dose_unit: z.string().trim().optional(),
    end_date: z.string().trim().optional(),
    interval_hours: createIntervalHoursSchema(t),
    instructions: z.string().trim().optional(),
    schedule_type: scheduleTypeSchema,
    scheduled_doses: z.array(createInitialScheduledDoseSchema(t)).min(1, t("validation.requiredField")),
    start_date: z.string().trim().optional(),
    titration_phases: z.array(createTitrationPhaseFormSchema(t)).min(2).max(24),
    time_of_day: z.string().trim().optional(),
    treatment_type: treatmentTypeSchema,
    whatsapp_notifications_enabled: z.boolean(),
  })
  .superRefine((values, context) => {
    if (
      values.treatment_type === "as_needed" &&
      (values.as_needed_max_uses !== undefined ||
        values.as_needed_max_dose_quantity !== undefined) &&
      values.as_needed_period_hours === undefined
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: t("validation.requiredField"),
        path: ["as_needed_period_hours"],
      });
    }
    if (values.treatment_type === "temporary") {
      if (!values.start_date?.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("validation.selectStartDate"),
          path: ["start_date"],
        });
      } else if (!datePattern.test(values.start_date)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("validation.validStartDate"),
          path: ["start_date"],
        });
      }

      if (!values.end_date?.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("validation.selectEndDate"),
          path: ["end_date"],
        });
      } else if (!datePattern.test(values.end_date)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("validation.validEndDate"),
          path: ["end_date"],
        });
      }

      if (
        values.start_date &&
        values.end_date &&
        datePattern.test(values.start_date) &&
        datePattern.test(values.end_date) &&
        values.end_date < values.start_date
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("validation.endDateAfterStart"),
          path: ["end_date"],
        });
      }
    }

    if (values.treatment_type === "as_needed") {
      return;
    }

    if (values.schedule_type === "weekly" && values.days_of_week.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: t("validation.chooseDay"),
        path: ["days_of_week"],
      });
    }

    if (values.schedule_type === "interval" && values.interval_hours === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: t("validation.hoursRequired"),
        path: ["interval_hours"],
      });
    }

    if (values.schedule_type === "custom") {
      if (!values.custom_anchor_date || !datePattern.test(values.custom_anchor_date)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("validation.validStartDate"),
          path: ["custom_anchor_date"],
        });
      }
      if (values.custom_kind === "every_n_weeks") {
        if (values.custom_interval_weeks === undefined) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: t("validation.requiredField"),
            path: ["custom_interval_weeks"],
          });
        }
        if (
          values.custom_anchor_date &&
          datePattern.test(values.custom_anchor_date) &&
          !anchorMatchesWeekday(values.custom_anchor_date, values.custom_weekday)
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: t("validation.anchorWeekdayMismatch"),
            path: ["custom_anchor_date"],
          });
        }
      }
      if (values.custom_kind === "monthly_day" && values.custom_day_of_month === undefined) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("validation.requiredField"),
          path: ["custom_day_of_month"],
        });
      }
      if (values.custom_kind === "cycle_days") {
        if (values.custom_cycle_length_days === undefined) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: t("validation.requiredField"),
            path: ["custom_cycle_length_days"],
          });
        }
        if (values.custom_cycle_start_day === undefined) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: t("validation.requiredField"),
            path: ["custom_cycle_start_day"],
          });
        }
        if (values.custom_cycle_end_day === undefined) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: t("validation.requiredField"),
            path: ["custom_cycle_end_day"],
          });
        }
        if (
          values.custom_cycle_start_day !== undefined &&
          values.custom_cycle_end_day !== undefined &&
          values.custom_cycle_start_day > values.custom_cycle_end_day
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: t("validation.cycleStartAfterEnd"),
            path: ["custom_cycle_end_day"],
          });
        }
        if (
          values.custom_cycle_length_days !== undefined &&
          values.custom_cycle_end_day !== undefined &&
          values.custom_cycle_end_day > values.custom_cycle_length_days
        ) {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            message: t("validation.cycleWindowOutsideLength"),
            path: ["custom_cycle_end_day"],
          });
        }
      }
      if (values.custom_kind === "titration_phases") {
        values.titration_phases.forEach((phase, index) => {
          const isFinal = index === values.titration_phases.length - 1;
          if (!isFinal && phase.duration_days === undefined) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              message: t("validation.requiredField"),
              path: ["titration_phases", index, "duration_days"],
            });
          }
          if (phase.schedule_type === "weekly" && phase.days_of_week.length === 0) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              message: t("validation.chooseDay"),
              path: ["titration_phases", index, "days_of_week"],
            });
          }
        });
      }
    }

    if (values.schedule_type === "custom" && values.custom_kind === "titration_phases") {
      values.titration_phases.forEach((phase, phaseIndex) => {
        phase.doses.forEach((dose, doseIndex) => {
          if (!dose.dose_quantity.trim()) {
            addRequiredDoseQuantityIssue(t, context, [
              "titration_phases",
              phaseIndex,
              "doses",
              doseIndex,
              "dose_quantity",
            ]);
          }
        });
      });
      return;
    }

    values.scheduled_doses.forEach((dose, index) => {
      if (!dose.dose_quantity.trim()) {
        addRequiredDoseQuantityIssue(t, context, [
          "scheduled_doses",
          index,
          "dose_quantity",
        ]);
      }
    });
  });

export type AddMedicationFlowValues = z.infer<ReturnType<typeof createAddMedicationFlowSchema>>;

export const createRoutineEditSchema = (t: TFunction) => z
  .object({
    as_needed_max_dose_quantity: createOptionalPositiveNumberSchema(t),
    as_needed_max_uses: createIntegerRangeSchema(t, 1, 1000),
    as_needed_min_interval_hours: createOptionalPositiveNumberSchema(t),
    as_needed_period_hours: createOptionalPositiveNumberSchema(t),
    dose_quantity: createDoseQuantitySchema(t),
    dose_unit: z.string().trim().optional(),
    end_date: z.string().trim().optional(),
    instructions: z.string().trim().optional(),
    schedules: z
      .array(createEditableScheduleSchema(t))
      .default([]),
    start_date: z.string().trim().optional(),
    title: z.string().trim().optional(),
    treatment_type: treatmentTypeSchema,
  })
  .superRefine((values, context) => {
    if (
      values.treatment_type === "as_needed" &&
      (values.as_needed_max_uses !== undefined ||
        values.as_needed_max_dose_quantity !== undefined) &&
      values.as_needed_period_hours === undefined
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: t("validation.requiredField"),
        path: ["as_needed_period_hours"],
      });
    }
    if (values.treatment_type === "temporary") {
      if (!values.start_date?.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("validation.selectStartDate"),
          path: ["start_date"],
        });
      } else if (!datePattern.test(values.start_date)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("validation.validStartDate"),
          path: ["start_date"],
        });
      }

      if (!values.end_date?.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("validation.selectEndDate"),
          path: ["end_date"],
        });
      } else if (!datePattern.test(values.end_date)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("validation.validEndDate"),
          path: ["end_date"],
        });
      }

      if (
        values.start_date &&
        values.end_date &&
        datePattern.test(values.start_date) &&
        datePattern.test(values.end_date) &&
        values.end_date < values.start_date
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("validation.endDateAfterStart"),
          path: ["end_date"],
        });
      }
    }

    if (values.treatment_type !== "as_needed" && values.schedules.length === 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: t("validation.requiredField"),
        path: ["schedules"],
      });
    }
  });

export type RoutineEditFormValues = z.infer<ReturnType<typeof createRoutineEditSchema>>;

export const emptyAddMedicationFlowValues: AddMedicationFlowValues = {
  ...emptyMedicationFormValues,
  app_notifications_enabled: false,
  as_needed_max_dose_quantity: undefined,
  as_needed_max_uses: undefined,
  as_needed_min_interval_hours: undefined,
  as_needed_period_hours: undefined,
  custom_anchor_date: toLocalDateInputValue(),
  custom_cycle_end_day: 21,
  custom_cycle_length_days: 28,
  custom_cycle_start_day: 1,
  custom_day_of_month: 1,
  custom_interval_weeks: 2,
  custom_kind: "every_n_weeks",
  custom_weekday: 1,
  days_of_week: [],
  dose_quantity: "",
  dose_unit: "",
  end_date: "",
  interval_hours: 8,
  instructions: "",
  schedule_type: "daily",
  scheduled_doses: [
    {
      dose_quantity: "",
      dose_unit: "",
      time_of_day: "08:00",
    },
  ],
  start_date: "",
  titration_phases: [
    {
      days_of_week: [],
      doses: [{ dose_quantity: "", dose_unit: "", time_of_day: "08:00" }],
      duration_days: 7,
      interval_hours: 8,
      schedule_type: "daily",
      title: "Fase 1",
    },
    {
      days_of_week: [],
      doses: [{ dose_quantity: "", dose_unit: "", time_of_day: "08:00" }],
      duration_days: undefined,
      interval_hours: 8,
      schedule_type: "daily",
      title: "Fase final",
    },
  ],
  time_of_day: "08:00",
  treatment_type: "continuous",
  whatsapp_notifications_enabled: false,
};

export function toSchedulePayload(values: AddMedicationFlowValues): SchedulePayload {
  if (!values.time_of_day) {
    throw new Error("Scheduled routines require time_of_day");
  }

  const payload: SchedulePayload = {
    is_active: true,
    schedule_type: values.schedule_type,
    time_of_day: values.time_of_day,
  };

  if (values.schedule_type === "weekly") {
    payload.days_of_week = [...values.days_of_week].sort((a, b) => a - b) as DayOfWeek[];
  }

  if (values.schedule_type === "interval") {
    payload.interval_hours = values.interval_hours ?? null;
  }

  if (values.schedule_type === "custom") {
    payload.custom_rule = toInitialCustomRule(values);
  }

  return payload;
}

export function toCreateRoutinePayload(
  values: AddMedicationFlowValues,
  medicationId: string,
): CreateRoutinePayload {
  const scheduledDose = values.scheduled_doses[0];
  const doseQuantity =
    values.treatment_type === "as_needed"
      ? values.dose_quantity
      : scheduledDose?.dose_quantity ?? values.dose_quantity;
  const doseUnit =
    values.treatment_type === "as_needed"
      ? values.dose_unit
      : scheduledDose?.dose_unit ?? values.dose_unit;
  const scheduleValues =
    values.treatment_type !== "as_needed" && scheduledDose
      ? { ...values, time_of_day: scheduledDose.time_of_day }
      : values;

  return {
    active: true,
    as_needed_limits:
      values.treatment_type === "as_needed" ? toAsNeededLimits(values) : null,
    dose_quantity: parseDoseQuantityForPayload(doseQuantity),
    dose_unit: emptyToNull(normalizeDoseUnit(doseUnit, values.form)),
    end_date: values.treatment_type === "temporary" ? emptyToNull(values.end_date) : null,
    instructions: emptyToNull(values.instructions),
    medication_id: medicationId,
    schedules: values.treatment_type === "as_needed" ? [] : [toSchedulePayload(scheduleValues)],
    start_date: values.treatment_type === "temporary" ? emptyToNull(values.start_date) : null,
    status: "active",
    title: values.name.trim(),
    treatment_type: values.treatment_type,
  };
}

export function toCreateRoutinePayloads(
  values: AddMedicationFlowValues,
  medicationId: string,
): CreateRoutinePayload[] {
  if (
    values.schedule_type === "custom" &&
    values.custom_kind === "titration_phases" &&
    values.treatment_type !== "as_needed"
  ) {
    const slotCount = Math.max(...values.titration_phases.map((phase) => phase.doses.length));
    const firstDose = values.titration_phases.flatMap((phase) => phase.doses)[0];
    return [
      {
        active: true,
        as_needed_limits: null,
        dose_quantity: parseDoseQuantityForPayload(firstDose?.dose_quantity ?? ""),
        dose_unit: emptyToNull(normalizeDoseUnit(firstDose?.dose_unit, values.form)),
        end_date: values.treatment_type === "temporary" ? emptyToNull(values.end_date) : null,
        instructions: emptyToNull(values.instructions),
        medication_id: medicationId,
        schedules: Array.from({ length: slotCount }, (_unused, slotIndex) => {
          const firstSlotDose = values.titration_phases
            .map((phase) => phase.doses[slotIndex])
            .find(Boolean);
          return {
            custom_rule: {
              anchor_date: values.custom_anchor_date ?? "",
              kind: "titration_phases" as const,
              phases: values.titration_phases.map((phase, phaseIndex) => {
                const dose = phase.doses[slotIndex];
                return {
                  dose_quantity: dose
                    ? parseDoseQuantityForPayload(dose.dose_quantity)
                    : null,
                  dose_unit: dose ? emptyToNull(normalizeDoseUnit(dose.dose_unit, values.form)) : null,
                  duration_days:
                    phaseIndex === values.titration_phases.length - 1
                      ? null
                      : phase.duration_days ?? null,
                  order: phaseIndex + 1,
                  schedule: dose
                    ? {
                        days_of_week:
                          phase.schedule_type === "weekly"
                            ? [...phase.days_of_week].sort((a, b) => a - b)
                            : null,
                        interval_hours:
                          phase.schedule_type === "interval"
                            ? phase.interval_hours ?? null
                            : null,
                        schedule_type: phase.schedule_type,
                        time_of_day: dose.time_of_day,
                      }
                    : null,
                  title: phase.title.trim(),
                };
              }),
              version: 1 as const,
            },
            is_active: true,
            schedule_type: "custom" as const,
            time_of_day: firstSlotDose?.time_of_day ?? "08:00",
          };
        }),
        start_date: values.treatment_type === "temporary" ? emptyToNull(values.start_date) : null,
        status: "active",
        title: values.name.trim(),
        treatment_type: values.treatment_type,
      },
    ];
  }

  if (values.treatment_type === "as_needed" || values.schedule_type === "interval") {
    return [toCreateRoutinePayload(values, medicationId)];
  }

  return values.scheduled_doses.map((dose) => ({
    active: true,
    dose_quantity: parseDoseQuantityForPayload(dose.dose_quantity),
    dose_unit: emptyToNull(normalizeDoseUnit(dose.dose_unit, values.form)),
    end_date: values.treatment_type === "temporary" ? emptyToNull(values.end_date) : null,
    instructions: emptyToNull(values.instructions),
    medication_id: medicationId,
    schedules: [
      {
        days_of_week:
          values.schedule_type === "weekly"
            ? [...values.days_of_week].sort((a, b) => a - b) as DayOfWeek[]
            : undefined,
        custom_rule:
          values.schedule_type === "custom" ? toInitialCustomRule(values) : undefined,
        is_active: true,
        schedule_type: values.schedule_type,
        time_of_day: dose.time_of_day,
      },
    ],
    start_date: values.treatment_type === "temporary" ? emptyToNull(values.start_date) : null,
    status: "active",
    title: values.name.trim(),
    treatment_type: values.treatment_type,
  }));
}

type EditableScheduleFormValue = RoutineEditFormValues["schedules"][number];

const defaultEditableSchedule: EditableScheduleFormValue = {
  custom_rule: null,
  days_of_week: [],
  interval_hours: undefined,
  is_active: true,
  schedule_type: "daily",
  time_of_day: "08:00",
};

export function routineToEditFormValues(
  routine: Routine,
  defaultDoseUnit?: string | null,
): RoutineEditFormValues {
  const schedules = routine.treatment_type === "as_needed"
    ? []
    : routine.schedules?.length
    ? routine.schedules.map((schedule) => ({
        days_of_week: normalizeDays(schedule.days_of_week),
        custom_rule: schedule.custom_rule ?? null,
        interval_hours: schedule.interval_hours ?? undefined,
        is_active: schedule.is_active,
        schedule_type: schedule.schedule_type,
        time_of_day: normalizeTimeOfDay(schedule.time_of_day),
      }))
    : [defaultEditableSchedule];

  return {
    as_needed_max_dose_quantity:
      routine.as_needed_limits?.max_dose_quantity_per_period ?? undefined,
    as_needed_max_uses: routine.as_needed_limits?.max_uses_per_period ?? undefined,
    as_needed_min_interval_hours:
      routine.as_needed_limits?.min_interval_minutes == null
        ? undefined
        : routine.as_needed_limits.min_interval_minutes / 60,
    as_needed_period_hours:
      routine.as_needed_limits?.period_minutes == null
        ? undefined
        : routine.as_needed_limits.period_minutes / 60,
    dose_quantity: formatDoseQuantityForInput(routine.dose_quantity),
    dose_unit: normalizeDoseUnit(routine.dose_unit, defaultDoseUnit),
    end_date: routine.end_date ?? "",
    instructions: routine.instructions ?? "",
    schedules,
    start_date: routine.start_date ?? "",
    title: routine.title ?? "",
    treatment_type: routine.treatment_type,
  };
}

export function toRoutineRevisionPayload(
  values: RoutineEditFormValues,
  routine: Routine,
): RoutineRevisionPayload {
  /**
   * Convert editable form values into the backend routine revision contract.
   *
   * Normalizes optional strings, dose values, temporary dates, as-needed limits,
   * and replacement schedules without deciding whether the backend creates a revision.
   */
  return {
    active: routine.active,
    as_needed_limits:
      values.treatment_type === "as_needed" ? toAsNeededLimitsFromEdit(values) : null,
    dose_quantity: parseDoseQuantityForPayload(values.dose_quantity),
    dose_unit: emptyToNull(values.dose_unit),
    end_date: values.treatment_type === "temporary" ? emptyToNull(values.end_date) : null,
    instructions: emptyToNull(values.instructions),
    schedules:
      values.treatment_type === "as_needed"
        ? []
        : (values.schedules ?? []).map(toEditableSchedulePayload),
    start_date: values.treatment_type === "temporary" ? emptyToNull(values.start_date) : null,
    status: routine.status,
    title: emptyToNull(values.title),
    treatment_type: values.treatment_type,
  };
}

export function createEmptyEditableSchedule(): EditableScheduleFormValue {
  return { ...defaultEditableSchedule };
}

function toEditableSchedulePayload(
  schedule: EditableScheduleFormValue,
): SchedulePayload {
  const payload: SchedulePayload = {
    custom_rule: schedule.schedule_type === "custom" ? schedule.custom_rule : undefined,
    is_active: schedule.is_active,
    schedule_type: schedule.schedule_type,
    time_of_day: schedule.time_of_day,
  };

  if (schedule.schedule_type === "weekly") {
    payload.days_of_week = [...schedule.days_of_week].sort((a, b) => a - b) as DayOfWeek[];
  }

  if (schedule.schedule_type === "interval") {
    payload.interval_hours = schedule.interval_hours ?? null;
  }

  return payload;
}

function toInitialCustomRule(values: AddMedicationFlowValues): CustomScheduleRule {
  if (values.custom_kind === "titration_phases") {
    return {
      anchor_date: values.custom_anchor_date ?? "",
      kind: "titration_phases",
      phases: values.titration_phases.map((item, index) => ({
        dose_quantity: item.doses[0]
          ? parseDoseQuantityForPayload(item.doses[0].dose_quantity)
          : null,
        dose_unit: item.doses[0]
          ? emptyToNull(normalizeDoseUnit(item.doses[0].dose_unit, values.form))
          : null,
        duration_days:
          index === values.titration_phases.length - 1 ? null : item.duration_days ?? null,
        order: index + 1,
        schedule: item.doses[0]
          ? {
              days_of_week: item.schedule_type === "weekly" ? item.days_of_week : null,
              interval_hours:
                item.schedule_type === "interval" ? item.interval_hours ?? null : null,
              schedule_type: item.schedule_type,
              time_of_day: item.doses[0].time_of_day,
            }
          : null,
        title: item.title,
      })),
      version: 1,
    };
  }

  if (values.custom_kind === "cycle_days") {
    return {
      active_windows: [
        {
          end_day: values.custom_cycle_end_day ?? 21,
          start_day: values.custom_cycle_start_day ?? 1,
        },
      ],
      anchor_date: values.custom_anchor_date ?? "",
      cycle_length_days: values.custom_cycle_length_days ?? 28,
      kind: "cycle_days",
      version: 1,
    };
  }

  if (values.custom_kind === "monthly_day") {
    return {
      anchor_date: values.custom_anchor_date ?? "",
      day_of_month: values.custom_day_of_month ?? 1,
      kind: "monthly_day",
      missing_day_policy: "last_day",
      version: 1,
    };
  }

  return {
    anchor_date: values.custom_anchor_date ?? "",
    interval_weeks: values.custom_interval_weeks ?? 1,
    kind: "every_n_weeks",
    version: 1,
    weekday: values.custom_weekday,
  };
}

function toAsNeededLimits(values: AddMedicationFlowValues) {
  const hasLimits =
    values.as_needed_max_uses !== undefined ||
    values.as_needed_max_dose_quantity !== undefined ||
    values.as_needed_min_interval_hours !== undefined;
  if (!hasLimits) {
    return null;
  }
  return {
    behavior: "warn" as const,
    max_dose_quantity_per_period: values.as_needed_max_dose_quantity ?? null,
    max_uses_per_period: values.as_needed_max_uses ?? null,
    min_interval_minutes:
      values.as_needed_min_interval_hours == null
        ? null
        : Math.round(values.as_needed_min_interval_hours * 60),
    period_minutes:
      values.as_needed_period_hours == null
        ? null
        : Math.round(values.as_needed_period_hours * 60),
  };
}

function toAsNeededLimitsFromEdit(values: RoutineEditFormValues) {
  const hasLimits =
    values.as_needed_max_uses !== undefined ||
    values.as_needed_max_dose_quantity !== undefined ||
    values.as_needed_min_interval_hours !== undefined;
  if (!hasLimits) {
    return null;
  }
  return {
    behavior: "warn" as const,
    max_dose_quantity_per_period: values.as_needed_max_dose_quantity ?? null,
    max_uses_per_period: values.as_needed_max_uses ?? null,
    min_interval_minutes:
      values.as_needed_min_interval_hours == null
        ? null
        : Math.round(values.as_needed_min_interval_hours * 60),
    period_minutes:
      values.as_needed_period_hours == null
        ? null
        : Math.round(values.as_needed_period_hours * 60),
  };
}

function anchorMatchesWeekday(anchorDate: string, weekday: DayOfWeek) {
  const value = new Date(`${anchorDate}T12:00:00`);
  return !Number.isNaN(value.getTime()) && value.getDay() === weekday;
}

function toLocalDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDays(days?: number[] | null): DayOfWeek[] {
  return (days ?? []).filter((day): day is DayOfWeek =>
    [0, 1, 2, 3, 4, 5, 6].includes(day),
  );
}

function normalizeTimeOfDay(timeOfDay?: string | null) {
  const match = timeOfDay?.match(/^(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : "08:00";
}

function formatDoseQuantityForInput(value?: number | null) {
  return value === null || value === undefined ? "" : String(value);
}

function isPositiveFiniteNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}
