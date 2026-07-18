import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  createMedicationFormSchema,
  medicationToFormValues,
  toMedicationPayload,
} from "../../medications/medicationSchema";
import {
  useCreateMedication,
  useUpdateMedication,
} from "../../medications/hooks";
import type { Medication } from "../../medications/types";
import {
  createAddMedicationFlowSchema,
  emptyAddMedicationFlowValues,
  toCreateRoutinePayloads,
  type AddMedicationFlowValues,
} from "../../routines/routineSchema";
import { useCancelRoutine, useCreateRoutine, useCreateRoutineRevision } from "../../routines/hooks";
import type {
  CreateRoutinePayload,
  DayOfWeek,
  Routine,
  RoutineRevisionPayload,
  ScheduleType,
  TreatmentType,
} from "../../routines/types";
import { dayOptions, scheduleOptions } from "../../routines/routineFormOptions";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
} from "../../me/hooks";
import type { MedicationImportItem } from "../../medicationImports/types";
import { useNotifications } from "../../notifications/useNotifications";
import { medicationUnitOptions } from "../../lib/medicationUnits";
import { colors, spacing } from "../../design/theme";
import {
  Body,
  Button,
  Card,
  Choice,
  Field,
  Label,
  Sheet,
  ToggleRow,
  nativeStyles,
} from "../shared/native";

type Props = {
  aiDraft?: MedicationImportItem | null;
  medication?: Medication | null;
  onClose: () => void;
  routineMedication?: Medication | null;
  visible: boolean;
};

function freshValues(): AddMedicationFlowValues {
  return {
    ...emptyAddMedicationFlowValues,
    days_of_week: [],
    scheduled_doses: emptyAddMedicationFlowValues.scheduled_doses.map((dose) => ({ ...dose })),
    titration_phases: emptyAddMedicationFlowValues.titration_phases.map((phase) => ({
      ...phase,
      days_of_week: [...phase.days_of_week],
      doses: phase.doses.map((dose) => ({ ...dose })),
    })),
  };
}

function objectValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function finiteNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function positiveNumber(value: unknown) {
  const parsed = finiteNumber(value);
  return parsed !== undefined && parsed > 0 ? parsed : undefined;
}

function integerInRange(value: unknown, minimum: number, maximum: number) {
  const parsed = finiteNumber(value);
  return parsed !== undefined && Number.isInteger(parsed) && parsed >= minimum && parsed <= maximum
    ? parsed
    : undefined;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function normalizeImportedTime(value: unknown) {
  if (typeof value !== "string") return "";
  const match = value.trim().match(/^(\d{1,2}):([0-5]\d)(?::[0-5]\d(?:\.\d+)?)?$/);
  if (!match) return "";
  const hour = Number(match[1]);
  if (hour < 0 || hour > 23) return "";
  return `${String(hour).padStart(2, "0")}:${match[2]}`;
}

function importedDays(value: unknown): DayOfWeek[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .map((day) => integerInRange(day, 0, 6))
    .filter((day): day is DayOfWeek => day !== undefined))]
    .sort((left, right) => left - right);
}

function customRuleFor(item: MedicationImportItem) {
  return item.usage.schedules
    .map((schedule) => objectValue(schedule.custom_rule))
    .find((rule): rule is Record<string, unknown> => Boolean(rule))
    ?? objectValue(item.usage.custom_rule);
}

function mapAsNeededLimits(
  values: AddMedicationFlowValues,
  rawLimits: Record<string, unknown> | null,
) {
  if (!rawLimits) return values;
  const minIntervalMinutes = positiveNumber(rawLimits.min_interval_minutes);
  const periodMinutes = positiveNumber(rawLimits.period_minutes);
  return {
    ...values,
    as_needed_max_dose_quantity: positiveNumber(rawLimits.max_dose_quantity_per_period),
    as_needed_max_uses: integerInRange(rawLimits.max_uses_per_period, 1, 1000),
    as_needed_min_interval_hours:
      minIntervalMinutes === undefined ? undefined : minIntervalMinutes / 60,
    as_needed_period_hours: periodMinutes === undefined ? undefined : periodMinutes / 60,
  };
}

function mapSimpleCustomRule(
  values: AddMedicationFlowValues,
  rule: Record<string, unknown>,
): AddMedicationFlowValues {
  const kind = stringValue(rule.kind);
  const anchorDate = stringValue(rule.anchor_date) ?? "";
  if (kind === "every_n_weeks") {
    const weekday = integerInRange(rule.weekday, 0, 6) as DayOfWeek | undefined;
    return {
      ...values,
      custom_anchor_date: anchorDate,
      custom_interval_weeks: integerInRange(rule.interval_weeks, 1, 52),
      custom_kind: kind,
      custom_weekday: weekday ?? values.custom_weekday,
      schedule_type: "custom",
    };
  }
  if (kind === "monthly_day") {
    return {
      ...values,
      custom_anchor_date: anchorDate,
      custom_day_of_month: integerInRange(rule.day_of_month, 1, 31),
      custom_kind: kind,
      schedule_type: "custom",
    };
  }
  if (kind === "cycle_days") {
    const window = Array.isArray(rule.active_windows)
      ? objectValue(rule.active_windows[0])
      : null;
    return {
      ...values,
      custom_anchor_date: anchorDate,
      custom_cycle_end_day: integerInRange(window?.end_day, 1, 365),
      custom_cycle_length_days: integerInRange(rule.cycle_length_days, 2, 365),
      custom_cycle_start_day: integerInRange(window?.start_day, 1, 365),
      custom_kind: kind,
      schedule_type: "custom",
    };
  }
  return values;
}

function titrationRuleCandidates(item: MedicationImportItem) {
  const scheduleRules = item.usage.schedules
    .map((schedule) => objectValue(schedule.custom_rule))
    .filter((rule): rule is Record<string, unknown> => rule?.kind === "titration_phases");
  if (scheduleRules.length) return scheduleRules;
  const usageRule = objectValue(item.usage.custom_rule);
  return usageRule?.kind === "titration_phases" ? [usageRule] : [];
}

function mapTitrationRule(
  values: AddMedicationFlowValues,
  item: MedicationImportItem,
  rules: Record<string, unknown>[],
): AddMedicationFlowValues {
  const primary = rules[0];
  const primaryPhases = Array.isArray(primary.phases)
    ? primary.phases.map(objectValue).filter((phase): phase is Record<string, unknown> => Boolean(phase))
    : [];
  if (primaryPhases.length < 2) {
    return {
      ...values,
      custom_anchor_date: stringValue(primary.anchor_date) ?? "",
      custom_kind: "titration_phases",
      schedule_type: "custom",
    };
  }

  const phases = primaryPhases.map((primaryPhase, phaseIndex) => {
    const order = integerInRange(primaryPhase.order, 1, 24) ?? phaseIndex + 1;
    const matchingPhases = rules.map((rule) => {
      const rulePhases = Array.isArray(rule.phases)
        ? rule.phases.map(objectValue).filter((phase): phase is Record<string, unknown> => Boolean(phase))
        : [];
      return rulePhases.find((phase) => finiteNumber(phase.order) === order) ?? rulePhases[phaseIndex];
    }).filter((phase): phase is Record<string, unknown> => Boolean(phase));
    const activePhases = matchingPhases.filter((phase) => objectValue(phase.schedule));
    const firstActive = activePhases[0] ?? primaryPhase;
    const firstSchedule = objectValue(firstActive.schedule);
    const scheduleType = ["daily", "weekly", "interval"].includes(String(firstSchedule?.schedule_type))
      ? firstSchedule?.schedule_type as "daily" | "weekly" | "interval"
      : "daily";
    const doses = activePhases.map((phase) => {
      const schedule = objectValue(phase.schedule);
      return {
        dose_quantity: positiveNumber(phase.dose_quantity)?.toString() ?? "",
        dose_unit: stringValue(phase.dose_unit) ?? item.usage.dose_unit ?? item.medication.form ?? "",
        time_of_day: normalizeImportedTime(schedule?.time_of_day),
      };
    });

    return {
      days_of_week: importedDays(firstSchedule?.days_of_week),
      doses: doses.length
        ? doses
        : [{
            dose_quantity: "",
            dose_unit: item.usage.dose_unit ?? item.medication.form ?? "",
            time_of_day: "",
          }],
      duration_days: positiveNumber(primaryPhase.duration_days),
      interval_hours: integerInRange(firstSchedule?.interval_hours, 1, 24),
      schedule_type: scheduleType,
      title: stringValue(primaryPhase.title) ?? "",
    };
  });

  return {
    ...values,
    custom_anchor_date: stringValue(primary.anchor_date) ?? "",
    custom_kind: "titration_phases",
    schedule_type: "custom",
    titration_phases: phases,
  };
}

export function medicationImportItemToFormValues(
  item: MedicationImportItem,
): AddMedicationFlowValues {
  const values = freshValues();
  const firstSchedule = item.usage.schedules[0];
  const isPrn = item.usage.type === "as_needed";
  const rule = customRuleFor(item);
  const scheduleType = (firstSchedule?.schedule_type ?? (rule ? "custom" : "daily")) as ScheduleType;
  const importedSchedules = item.usage.schedules.length
    ? item.usage.schedules.map((schedule) => ({
        dose_quantity: schedule.dose_quantity?.toString() ?? item.usage.dose_quantity?.toString() ?? "",
        dose_unit: schedule.dose_unit ?? item.usage.dose_unit ?? item.medication.form ?? "",
        time_of_day: normalizeImportedTime(schedule.time_of_day),
      })).slice(0, firstSchedule?.schedule_type === "interval" ? 1 : undefined)
    : [{
        dose_quantity: item.usage.dose_quantity?.toString() ?? "",
        dose_unit: item.usage.dose_unit ?? item.medication.form ?? "",
        time_of_day: isPrn ? values.scheduled_doses[0].time_of_day : "",
      }];
  let mapped: AddMedicationFlowValues = {
    ...values,
    dosage_text: item.medication.strength_text ?? "",
    end_date: item.usage.end_date ?? "",
    form: item.medication.form ?? "",
    instructions: item.usage.instructions ?? "",
    name: item.medication.display_name,
    notes: item.medication.notes ?? item.raw_text ?? "",
    schedule_type: scheduleType,
    days_of_week: importedDays(firstSchedule?.days_of_week),
    interval_hours:
      scheduleType === "interval"
        ? firstSchedule?.interval_hours ?? undefined
        : values.interval_hours,
    scheduled_doses: importedSchedules,
    start_date: item.usage.start_date ?? "",
    treatment_type: isPrn ? "as_needed" : item.usage.end_date ? "temporary" : "continuous",
    dose_quantity: item.usage.dose_quantity?.toString() ?? "",
    dose_unit: item.usage.dose_unit ?? item.medication.form ?? "",
  };

  const titrationRules = titrationRuleCandidates(item);
  if (titrationRules.length) mapped = mapTitrationRule(mapped, item, titrationRules);
  else if (rule) mapped = mapSimpleCustomRule(mapped, rule);
  else if (scheduleType === "custom") {
    mapped = {
      ...mapped,
      custom_anchor_date: "",
      custom_interval_weeks: undefined,
    };
  }
  if (isPrn) mapped = mapAsNeededLimits(mapped, objectValue(item.usage.as_needed_limits));
  return mapped;
}

type SavedRoutineProgress = {
  fingerprint: string;
  routine: Routine;
};

export type RoutineSaveCheckpoint = {
  routines: Map<number, SavedRoutineProgress>;
};

type RoutineSaveOperations = {
  cancel: (routineId: string) => Promise<unknown>;
  create: (payload: CreateRoutinePayload) => Promise<Routine>;
  revise: (routineId: string, payload: RoutineRevisionPayload) => Promise<Routine>;
};

function routineFingerprint(payload: CreateRoutinePayload) {
  return JSON.stringify(payload);
}

function revisionPayload(payload: CreateRoutinePayload): RoutineRevisionPayload {
  const revision: Omit<CreateRoutinePayload, "medication_id"> & { medication_id?: string } = {
    ...payload,
  };
  delete revision.medication_id;
  return revision;
}

/** Resume a multi-routine save after a partial failure without recreating completed slots. */
export async function persistRoutinePayloads(
  payloads: CreateRoutinePayload[],
  checkpoint: RoutineSaveCheckpoint,
  operations: RoutineSaveOperations,
) {
  for (let index = 0; index < payloads.length; index += 1) {
    const payload = payloads[index];
    const fingerprint = routineFingerprint(payload);
    const saved = checkpoint.routines.get(index);
    if (!saved) {
      const routine = await operations.create(payload);
      checkpoint.routines.set(index, { fingerprint, routine });
    } else if (saved.fingerprint !== fingerprint) {
      const routine = await operations.revise(saved.routine.id, revisionPayload(payload));
      checkpoint.routines.set(index, { fingerprint, routine });
    }
  }

  const removedIndexes = [...checkpoint.routines.keys()]
    .filter((index) => index >= payloads.length)
    .sort((left, right) => right - left);
  for (const index of removedIndexes) {
    const saved = checkpoint.routines.get(index);
    if (!saved) continue;
    await operations.cancel(saved.routine.id);
    checkpoint.routines.delete(index);
  }
}

export function MedicationEditorSheet({ aiDraft, medication, onClose, routineMedication, visible }: Props) {
  const { t } = useTranslation();
  const isEdit = Boolean(medication);
  const isRoutineOnly = Boolean(routineMedication);
  const preferences = useNotificationPreferences(visible && !isEdit && !isRoutineOnly);
  const updatePreferences = useUpdateNotificationPreferences();
  const createMedication = useCreateMedication();
  const updateMedication = useUpdateMedication();
  const createRoutine = useCreateRoutine();
  const createRoutineRevision = useCreateRoutineRevision();
  const cancelRoutine = useCancelRoutine();
  const notifications = useNotifications();
  const [values, setValues] = useState<AddMedicationFlowValues>(freshValues);
  const saveCheckpointRef = useRef<{
    medication: Medication | null;
    routines: RoutineSaveCheckpoint;
  }>({ medication: null, routines: { routines: new Map() } });

  useEffect(() => {
    if (!visible) return;
    saveCheckpointRef.current = { medication: null, routines: { routines: new Map() } };
    if (routineMedication) {
      setValues({ ...freshValues(), ...medicationToFormValues(routineMedication) });
    } else if (medication) {
      setValues({ ...freshValues(), ...medicationToFormValues(medication) });
    } else if (aiDraft) {
      setValues(medicationImportItemToFormValues(aiDraft));
    } else {
      setValues(freshValues());
    }
  }, [aiDraft, medication, routineMedication, visible]);

  useEffect(() => {
    if (!visible || isEdit || isRoutineOnly || !preferences.data) return;
    setValues((current) => ({
      ...current,
      app_notifications_enabled: preferences.data.app_notifications_enabled,
      whatsapp_notifications_enabled: preferences.data.whatsapp_notifications_enabled,
    }));
  }, [isEdit, isRoutineOnly, preferences.data, visible]);

  const busy =
    createMedication.isPending ||
    updateMedication.isPending ||
    createRoutine.isPending ||
    createRoutineRevision.isPending ||
    cancelRoutine.isPending ||
    updatePreferences.isPending ||
    notifications.isBusy;

  const set = <K extends keyof AddMedicationFlowValues>(key: K, value: AddMedicationFlowValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }));

  const close = () => {
    saveCheckpointRef.current = { medication: null, routines: { routines: new Map() } };
    onClose();
  };

  const persistRoutines = (
    payloads: CreateRoutinePayload[],
    checkpoint: RoutineSaveCheckpoint,
  ) => persistRoutinePayloads(payloads, checkpoint, {
    cancel: (routineId) => cancelRoutine.mutateAsync(routineId),
    create: (payload) => createRoutine.mutateAsync(payload),
    revise: (routineId, payload) => createRoutineRevision.mutateAsync({ payload, routineId }),
  });

  const save = async () => {
    if (routineMedication) {
      const parsed = createAddMedicationFlowSchema(t).safeParse(values);
      if (!parsed.success) {
        Alert.alert(t("routines.validationError"), parsed.error.issues[0]?.message);
        return;
      }
      try {
        await persistRoutines(
          toCreateRoutinePayloads(parsed.data, routineMedication.id),
          saveCheckpointRef.current.routines,
        );
        close();
      } catch (error) {
        Alert.alert(t("medications.couldNotAddIntake"), error instanceof Error ? error.message : t("common.somethingWentWrong"));
      }
      return;
    }
    if (medication) {
      const parsed = createMedicationFormSchema(t).safeParse(values);
      if (!parsed.success) {
        Alert.alert(t("routines.validationError"), parsed.error.issues[0]?.message);
        return;
      }
      try {
        await updateMedication.mutateAsync({
          medicationId: medication.id,
          payload: toMedicationPayload(parsed.data),
        });
        close();
      } catch (error) {
        Alert.alert(t("medications.couldNotUpdate"), error instanceof Error ? error.message : t("common.somethingWentWrong"));
      }
      return;
    }

    const parsed = createAddMedicationFlowSchema(t).safeParse(values);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      Alert.alert(t("routines.validationError"), `${first?.message ?? t("common.somethingWentWrong")}\n${first?.path.join(" → ") ?? ""}`);
      return;
    }

    try {
      if (parsed.data.app_notifications_enabled && !notifications.registration) {
        await notifications.enableCurrentDevice();
      }
      await updatePreferences.mutateAsync({
        app_notifications_enabled: parsed.data.app_notifications_enabled,
        whatsapp_notifications_enabled: parsed.data.whatsapp_notifications_enabled,
      });
      const medicationPayload = toMedicationPayload(parsed.data);
      let savedMedication = saveCheckpointRef.current.medication;
      if (savedMedication) {
        savedMedication = await updateMedication.mutateAsync({
          medicationId: savedMedication.id,
          payload: medicationPayload,
        });
      } else {
        savedMedication = await createMedication.mutateAsync(medicationPayload);
      }
      saveCheckpointRef.current.medication = savedMedication;
      await persistRoutines(
        toCreateRoutinePayloads(parsed.data, savedMedication.id),
        saveCheckpointRef.current.routines,
      );
      close();
    } catch (error) {
      const message = error instanceof Error ? error.message : t("common.somethingWentWrong");
      Alert.alert(
        t("medications.couldNotAddIntake"),
        saveCheckpointRef.current.medication
          ? t("addMedication.medicationCreatedRoutineFailed", { message })
          : message,
      );
    }
  };

  return (
    <Sheet
      onClose={close}
      title={isRoutineOnly ? t("medications.addIntakeNamed", { name: routineMedication?.name }) : isEdit ? t("medications.editMedication") : t("medications.addCta")}
      visible={visible}
    >
      {!isRoutineOnly ? (
        <>
          <SectionTitle>{t("addMedication.basicsTitle")}</SectionTitle>
          <Field label={t("addMedication.fields.medicationName")} onChangeText={(value) => set("name", value)} value={values.name} />
          <Field label={t("addMedication.fields.dosage")} onChangeText={(value) => set("dosage_text", value)} value={values.dosage_text ?? ""} />
          <UnitSelector onChange={(value) => set("form", value)} value={values.form ?? ""} />
          <Field label={t("medications.reason")} onChangeText={(value) => set("medication_reason", value)} value={values.medication_reason ?? ""} />
          <Field label={t("medications.prescribingDoctor")} onChangeText={(value) => set("prescribing_doctor_name", value)} value={values.prescribing_doctor_name ?? ""} />
          <Field label={t("addMedication.fields.notes")} multiline onChangeText={(value) => set("notes", value)} value={values.notes ?? ""} />
        </>
      ) : (
        <Card><SectionTitle>{routineMedication?.name ?? ""}</SectionTitle></Card>
      )}

      {!isEdit ? (
        <>
          <SectionTitle>{t("addMedication.treatmentTitle")}</SectionTitle>
          <Choice<TreatmentType>
            label={t("routines.treatmentType")}
            onChange={(value) => set("treatment_type", value)}
            options={[
              { label: t("routines.continuous"), value: "continuous" },
              { label: t("routines.temporary"), value: "temporary" },
              { label: t("routines.asNeeded"), value: "as_needed" },
            ]}
            value={values.treatment_type}
          />
          {values.treatment_type === "temporary" ? (
            <View style={nativeStyles.row}>
              <View style={styles.flex}>
                <Field label={t("routines.startDate")} onChangeText={(value) => set("start_date", value)} placeholder="AAAA-MM-DD" value={values.start_date ?? ""} />
              </View>
              <View style={styles.flex}>
                <Field label={t("routines.endDate")} onChangeText={(value) => set("end_date", value)} placeholder="AAAA-MM-DD" value={values.end_date ?? ""} />
              </View>
            </View>
          ) : null}

          {values.treatment_type === "as_needed" ? (
            <AsNeededFields set={set} values={values} />
          ) : (
            <ScheduleFields set={set} values={values} />
          )}

          <Field label={t("routines.instructions")} multiline onChangeText={(value) => set("instructions", value)} value={values.instructions ?? ""} />

          {!isRoutineOnly ? (
            <>
              <SectionTitle>{t("addMedication.reminderTitle")}</SectionTitle>
              <ToggleRow
                description={t("settings.appNotificationsDescription")}
                label={t("settings.appNotifications")}
                onValueChange={(value) => set("app_notifications_enabled", value)}
                value={values.app_notifications_enabled}
              />
              <ToggleRow
                description={t("settings.whatsappRemindersDescription")}
                label={t("settings.whatsappReminders")}
                onValueChange={(value) => set("whatsapp_notifications_enabled", value)}
                value={values.whatsapp_notifications_enabled}
              />
            </>
          ) : null}
          <Card>
            <SectionTitle>{t("addMedication.reviewTitle")}</SectionTitle>
            <Body>{values.name}</Body>
            <Body muted>{values.dosage_text || values.form}</Body>
            <Body muted>{t(`routines.${values.treatment_type === "as_needed" ? "asNeeded" : values.treatment_type}`)}</Body>
          </Card>
        </>
      ) : null}
      <Button loading={busy} onPress={() => void save()}>
        {isEdit ? t("medications.saveCta") : isRoutineOnly ? t("routines.saveRoutine") : t("common.save")}
      </Button>
    </Sheet>
  );
}

function SectionTitle({ children }: { children: string }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

function UnitSelector({ onChange, value }: { onChange: (value: string) => void; value: string }) {
  const { t } = useTranslation();
  const standard = medicationUnitOptions.some((item) => item.value === value);
  const [custom, setCustom] = useState(standard ? "" : value);
  return (
    <View style={styles.group}>
      <Label>{t("addMedication.fields.form")}</Label>
      <View style={styles.chips}>
        {medicationUnitOptions.map((option) => (
          <Chip
            key={option.value}
            label={t(option.labelKey)}
            onPress={() => onChange(option.value)}
            selected={value === option.value}
          />
        ))}
        <Chip label={t("addMedication.unitOptions.other")} onPress={() => onChange(custom)} selected={!standard} />
      </View>
      {!standard ? <Field label={t("addMedication.customUnit")} onChangeText={(next) => { setCustom(next); onChange(next); }} value={custom} /> : null}
    </View>
  );
}

function AsNeededFields({ set, values }: FormSectionProps) {
  const { t } = useTranslation();
  return (
    <Card>
      <Field keyboardType="decimal-pad" label={t("routines.doseQuantity")} onChangeText={(value) => set("dose_quantity", value)} value={values.dose_quantity ?? ""} />
      <Field label={t("routines.doseUnit")} onChangeText={(value) => set("dose_unit", value)} value={values.dose_unit ?? ""} />
      <NumericField label={t("routines.minIntervalHours")} onChange={(value) => set("as_needed_min_interval_hours", value)} value={values.as_needed_min_interval_hours} />
      <NumericField label={t("routines.maxUsesInHours", { uses: "", hours: "" })} onChange={(value) => set("as_needed_max_uses", value)} value={values.as_needed_max_uses} />
      <NumericField label={t("routines.maxDoseInHours", { dose: "", hours: "" })} onChange={(value) => set("as_needed_max_dose_quantity", value)} value={values.as_needed_max_dose_quantity} />
      <NumericField label={t("addMedication.periodHours")} onChange={(value) => set("as_needed_period_hours", value)} value={values.as_needed_period_hours} />
    </Card>
  );
}

type FormSectionProps = {
  set: <K extends keyof AddMedicationFlowValues>(key: K, value: AddMedicationFlowValues[K]) => void;
  values: AddMedicationFlowValues;
};

function ScheduleFields({ set, values }: FormSectionProps) {
  const { t } = useTranslation();
  const scheduleValue = values.schedule_type === "custom"
    ? `custom:${values.custom_kind}`
    : values.schedule_type;
  const options = scheduleOptions.map((option) => ({
    label: t(option.labelKey),
    value: option.value === "custom" ? `custom:${option.customKind}` : option.value,
  }));
  options.push({ label: t("routines.phasedUse"), value: "custom:titration_phases" });

  const changeSchedule = (value: string) => {
    const onlyOneDose = value === "interval" ||
      value === "custom:every_n_weeks" ||
      value === "custom:monthly_day";
    if (value.startsWith("custom:")) {
      set("schedule_type", "custom");
      set("custom_kind", value.slice(7) as AddMedicationFlowValues["custom_kind"]);
    } else {
      set("schedule_type", value as ScheduleType);
    }
    if (onlyOneDose && values.scheduled_doses.length > 1) {
      set("scheduled_doses", [values.scheduled_doses[0]]);
    }
  };

  return (
    <View style={styles.group}>
      <SectionTitle>{t("addMedication.scheduleTitle")}</SectionTitle>
      <Choice label={t("routines.schedule")} onChange={changeSchedule} options={options} value={scheduleValue} />
      {values.schedule_type === "weekly" ? (
        <DaySelector onChange={(days) => set("days_of_week", days)} value={values.days_of_week} />
      ) : null}
      {values.schedule_type === "interval" ? (
        <NumericField label={t("routines.repeatEvery")} onChange={(value) => set("interval_hours", value)} value={values.interval_hours} />
      ) : null}
      {values.schedule_type === "custom" ? <CustomScheduleFields set={set} values={values} /> : null}
      {values.custom_kind !== "titration_phases" || values.schedule_type !== "custom" ? (
        <DoseSlots set={set} values={values} />
      ) : null}
    </View>
  );
}

function CustomScheduleFields({ set, values }: FormSectionProps) {
  const { t } = useTranslation();
  if (values.custom_kind === "titration_phases") {
    return <TitrationFields set={set} values={values} />;
  }
  return (
    <Card>
      <Field label={t("addMedication.anchorDate")} onChangeText={(value) => set("custom_anchor_date", value)} placeholder="AAAA-MM-DD" value={values.custom_anchor_date ?? ""} />
      {values.custom_kind === "every_n_weeks" ? (
        <>
          <NumericField label={t("addMedication.intervalWeeks")} onChange={(value) => set("custom_interval_weeks", value)} value={values.custom_interval_weeks} />
          <Choice
            label={t("routines.weekly")}
            onChange={(value) => set("custom_weekday", Number(value) as DayOfWeek)}
            options={dayOptions.map((day) => ({ label: t(`days.short.${day}`), value: String(day) }))}
            value={String(values.custom_weekday)}
          />
        </>
      ) : null}
      {values.custom_kind === "monthly_day" ? (
        <NumericField label={t("addMedication.dayOfMonth")} onChange={(value) => set("custom_day_of_month", value)} value={values.custom_day_of_month} />
      ) : null}
      {values.custom_kind === "cycle_days" ? (
        <>
          <NumericField label={t("addMedication.cycleLength")} onChange={(value) => set("custom_cycle_length_days", value)} value={values.custom_cycle_length_days} />
          <NumericField label={t("addMedication.cycleActiveStart")} onChange={(value) => set("custom_cycle_start_day", value)} value={values.custom_cycle_start_day} />
          <NumericField label={t("addMedication.cycleActiveEnd")} onChange={(value) => set("custom_cycle_end_day", value)} value={values.custom_cycle_end_day} />
        </>
      ) : null}
    </Card>
  );
}

function DoseSlots({ set, values }: FormSectionProps) {
  const { t } = useTranslation();
  const supportsMultipleDoses =
    values.schedule_type !== "interval" &&
    !(
      values.schedule_type === "custom" &&
      (values.custom_kind === "every_n_weeks" || values.custom_kind === "monthly_day")
    );
  const update = (index: number, key: "dose_quantity" | "dose_unit" | "time_of_day", value: string) => {
    const next = values.scheduled_doses.map((dose, doseIndex) =>
      doseIndex === index ? { ...dose, [key]: value } : dose,
    );
    set("scheduled_doses", next);
  };
  return (
    <View style={styles.group}>
      {values.scheduled_doses.map((dose, index) => (
        <Card key={`dose-${index}`}>
          <Label>{t("addMedication.scheduleNumber", { number: index + 1 })}</Label>
          <Field label={t("routines.time")} onChangeText={(value) => update(index, "time_of_day", value)} placeholder="08:00" value={dose.time_of_day} />
          <Field keyboardType="decimal-pad" label={t("routines.doseQuantity")} onChangeText={(value) => update(index, "dose_quantity", value)} value={dose.dose_quantity} />
          <Field label={t("routines.doseUnit")} onChangeText={(value) => update(index, "dose_unit", value)} value={dose.dose_unit} />
          {values.scheduled_doses.length > 1 ? (
            <Button danger onPress={() => set("scheduled_doses", values.scheduled_doses.filter((_, doseIndex) => doseIndex !== index))}>
              {t("addMedication.removeSchedule")}
            </Button>
          ) : null}
        </Card>
      ))}
      {supportsMultipleDoses ? (
        <Button
          onPress={() => set("scheduled_doses", [...values.scheduled_doses, { dose_quantity: "", dose_unit: values.form ?? "", time_of_day: "20:00" }])}
          secondary
        >
          {t("addMedication.addAnotherSchedule")}
        </Button>
      ) : null}
    </View>
  );
}

function TitrationFields({ set, values }: FormSectionProps) {
  const { t } = useTranslation();
  const updatePhase = (index: number, patch: Partial<AddMedicationFlowValues["titration_phases"][number]>) => {
    set("titration_phases", values.titration_phases.map((phase, phaseIndex) => phaseIndex === index ? { ...phase, ...patch } : phase));
  };
  return (
    <View style={styles.group}>
      <Field label={t("addMedication.anchorDate")} onChangeText={(value) => set("custom_anchor_date", value)} placeholder="AAAA-MM-DD" value={values.custom_anchor_date ?? ""} />
      {values.titration_phases.map((phase, index) => (
        <Card key={`phase-${index}`}>
          <Field label={t("addMedication.phaseTitle")} onChangeText={(title) => updatePhase(index, { title })} value={phase.title} />
          {index < values.titration_phases.length - 1 ? (
            <NumericField label={t("addMedication.phaseDurationDays")} onChange={(duration_days) => updatePhase(index, { duration_days })} value={phase.duration_days} />
          ) : null}
          <Choice
            label={t("routines.schedule")}
            onChange={(schedule_type) => updatePhase(index, { schedule_type })}
            options={[
              { label: t("routines.daily"), value: "daily" },
              { label: t("routines.weekly"), value: "weekly" },
              { label: t("routines.everyXHours"), value: "interval" },
            ]}
            value={phase.schedule_type}
          />
          {phase.schedule_type === "weekly" ? (
            <DaySelector onChange={(days_of_week) => updatePhase(index, { days_of_week })} value={phase.days_of_week} />
          ) : null}
          {phase.schedule_type === "interval" ? (
            <NumericField label={t("routines.repeatEvery")} onChange={(interval_hours) => updatePhase(index, { interval_hours })} value={phase.interval_hours} />
          ) : null}
          {phase.doses.map((dose, doseIndex) => (
            <View key={`phase-${index}-dose-${doseIndex}`} style={styles.group}>
              <Field label={t("routines.time")} onChangeText={(time_of_day) => updatePhase(index, { doses: phase.doses.map((item, itemIndex) => itemIndex === doseIndex ? { ...item, time_of_day } : item) })} value={dose.time_of_day} />
              <Field keyboardType="decimal-pad" label={t("routines.doseQuantity")} onChangeText={(dose_quantity) => updatePhase(index, { doses: phase.doses.map((item, itemIndex) => itemIndex === doseIndex ? { ...item, dose_quantity } : item) })} value={dose.dose_quantity} />
              <Field label={t("routines.doseUnit")} onChangeText={(dose_unit) => updatePhase(index, { doses: phase.doses.map((item, itemIndex) => itemIndex === doseIndex ? { ...item, dose_unit } : item) })} value={dose.dose_unit} />
            </View>
          ))}
          <Button onPress={() => updatePhase(index, { doses: [...phase.doses, { dose_quantity: "", dose_unit: values.form ?? "", time_of_day: "20:00" }] })} secondary>
            {t("addMedication.addAnotherSchedule")}
          </Button>
          {values.titration_phases.length > 2 ? (
            <Button danger onPress={() => set("titration_phases", values.titration_phases.filter((_, phaseIndex) => phaseIndex !== index))}>
              {t("addMedication.removePhase")}
            </Button>
          ) : null}
        </Card>
      ))}
      <Button onPress={() => set("titration_phases", [...values.titration_phases, { days_of_week: [], doses: [{ dose_quantity: "", dose_unit: values.form ?? "", time_of_day: "08:00" }], duration_days: undefined, interval_hours: 8, schedule_type: "daily", title: `${t("addMedication.phaseTitle")} ${values.titration_phases.length + 1}` }])} secondary>
        {t("addMedication.addPhase")}
      </Button>
    </View>
  );
}

function DaySelector({ onChange, value }: { onChange: (days: DayOfWeek[]) => void; value: DayOfWeek[] }) {
  const { t } = useTranslation();
  return (
    <View style={styles.group}>
      <Label>{t("routines.weekly")}</Label>
      <View style={styles.chips}>
        {dayOptions.map((day) => (
          <Chip
            key={day}
            label={t(`days.short.${day}`)}
            onPress={() => onChange(value.includes(day) ? value.filter((item) => item !== day) : [...value, day])}
            selected={value.includes(day)}
          />
        ))}
      </View>
    </View>
  );
}

function Chip({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
  return (
    <Pressable onPress={onPress} style={[styles.chip, selected && styles.chipSelected]}>
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </Pressable>
  );
}

function NumericField({ label, onChange, value }: { label: string; onChange: (value: number | undefined) => void; value?: number }) {
  return (
    <Field
      keyboardType="decimal-pad"
      label={label}
      onChangeText={(text) => {
        const number = Number(text.replace(",", "."));
        onChange(text.trim() && Number.isFinite(number) ? number : undefined);
      }}
      value={value?.toString() ?? ""}
    />
  );
}

const styles = StyleSheet.create({
  chip: { borderColor: colors.border, borderRadius: 999, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.ink },
  chipTextSelected: { color: colors.surface, fontWeight: "700" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  flex: { flex: 1 },
  group: { gap: spacing.md },
  sectionTitle: { color: colors.ink, fontSize: 20, fontWeight: "800", marginTop: spacing.md },
});
