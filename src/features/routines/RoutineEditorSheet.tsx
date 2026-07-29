import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  createEmptyEditableSchedule,
  createRoutineEditSchema,
  routineToEditFormValues,
  toRoutineRevisionPayload,
  type RoutineEditFormValues,
} from "../../routines/routineSchema";
import { useCreateRoutineRevision } from "../../routines/hooks";
import type { CustomScheduleRule, DayOfWeek, Routine, RoutineRevisionPayload, ScheduleType, TreatmentType } from "../../routines/types";
import { dayOptions } from "../../routines/routineFormOptions";
import { colors, spacing } from "../../design/theme";
import { Body, Button, Card, Choice, Field, Label, Sheet } from "../shared/native";

type EditableSchedule = RoutineEditFormValues["schedules"][number];

export function RoutineEditorSheet({
  defaultDoseUnit,
  onClose,
  onSave,
  routine,
}: {
  defaultDoseUnit?: string | null;
  onClose: () => void;
  onSave?: (routine: Routine, payload: RoutineRevisionPayload) => Promise<unknown>;
  routine: Routine | null;
}) {
  const { t } = useTranslation();
  const mutation = useCreateRoutineRevision();
  const [values, setValues] = useState<RoutineEditFormValues | null>(null);
  const [externalSavePending, setExternalSavePending] = useState(false);
  const saveInFlight = useRef(false);
  const isSaving = mutation.isPending || externalSavePending;

  useEffect(() => {
    if (routine) setValues(routineToEditFormValues(routine, defaultDoseUnit));
  }, [defaultDoseUnit, routine]);

  if (!routine || !values) {
    return <Sheet onClose={onClose} title={t("routines.editRoutine")} visible={false} />;
  }

  const set = <K extends keyof RoutineEditFormValues>(key: K, value: RoutineEditFormValues[K]) =>
    setValues((current) => (current ? { ...current, [key]: value } : current));

  const save = async () => {
    if (saveInFlight.current) return;
    const parsed = createRoutineEditSchema(t).safeParse(values);
    if (!parsed.success) {
      Alert.alert(t("routines.validationError"), parsed.error.issues[0]?.message);
      return;
    }
    saveInFlight.current = true;
    try {
      const payload = toRoutineRevisionPayload(parsed.data, routine);
      if (onSave) {
        setExternalSavePending(true);
        await onSave(routine, payload);
      }
      else await mutation.mutateAsync({ payload, routineId: routine.id });
      onClose();
    } catch (error) {
      Alert.alert(t("routines.unableToUpdateRoutine"), error instanceof Error ? error.message : t("common.somethingWentWrong"));
    } finally {
      saveInFlight.current = false;
      setExternalSavePending(false);
    }
  };

  return (
    <Sheet onClose={onClose} title={t("routines.editRoutineNamed", { name: routine.title })} visible>
      <Field label={t("routines.routine")} onChangeText={(title) => set("title", title)} value={values.title ?? ""} />
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
      <View style={styles.row}>
        <View style={styles.flex}>
          <Field keyboardType="decimal-pad" label={t("routines.doseQuantity")} onChangeText={(dose_quantity) => set("dose_quantity", dose_quantity)} value={values.dose_quantity} />
        </View>
        <View style={styles.flex}>
          <Field label={t("routines.doseUnit")} onChangeText={(dose_unit) => set("dose_unit", dose_unit)} value={values.dose_unit ?? ""} />
        </View>
      </View>
      <Field label={t("routines.instructions")} multiline onChangeText={(instructions) => set("instructions", instructions)} value={values.instructions ?? ""} />
      {values.treatment_type === "temporary" ? (
        <View style={styles.row}>
          <View style={styles.flex}><Field label={t("routines.startDate")} onChangeText={(start_date) => set("start_date", start_date)} value={values.start_date ?? ""} /></View>
          <View style={styles.flex}><Field label={t("routines.endDate")} onChangeText={(end_date) => set("end_date", end_date)} value={values.end_date ?? ""} /></View>
        </View>
      ) : null}
      {values.treatment_type === "as_needed" ? (
        <Card>
          <NumberField label={t("routines.minIntervalHours")} onChange={(value) => set("as_needed_min_interval_hours", value)} value={values.as_needed_min_interval_hours} />
          <NumberField label={t("addMedication.maxUses")} onChange={(value) => set("as_needed_max_uses", value)} value={values.as_needed_max_uses} />
          <NumberField label={t("addMedication.maxDoseQuantity")} onChange={(value) => set("as_needed_max_dose_quantity", value)} value={values.as_needed_max_dose_quantity} />
          <NumberField label={t("addMedication.periodHours")} onChange={(value) => set("as_needed_period_hours", value)} value={values.as_needed_period_hours} />
        </Card>
      ) : (
        <>
          <Text style={styles.heading}>{t("routines.schedules")}</Text>
          {values.schedules.map((schedule, index) => (
            <ScheduleEditor
              key={`schedule-${index}`}
              onChange={(next) => set("schedules", values.schedules.map((item, itemIndex) => itemIndex === index ? next : item))}
              onRemove={() => set("schedules", values.schedules.filter((_, itemIndex) => itemIndex !== index))}
              schedule={schedule}
            />
          ))}
          {!values.schedules.some(
            (schedule) => schedule.custom_rule?.kind === "titration_phases",
          ) ? (
            <Button onPress={() => set("schedules", [...values.schedules, createEmptyEditableSchedule()])} secondary>
              {t("addMedication.addAnotherSchedule")}
            </Button>
          ) : null}
        </>
      )}
      <Button disabled={isSaving} loading={isSaving} onPress={() => void save()}>{t("routines.saveRoutine")}</Button>
    </Sheet>
  );
}

function ScheduleEditor({
  onChange,
  onRemove,
  schedule,
}: {
  onChange: (schedule: EditableSchedule) => void;
  onRemove: () => void;
  schedule: EditableSchedule;
}) {
  const { t } = useTranslation();
  const set = <K extends keyof EditableSchedule>(key: K, value: EditableSchedule[K]) =>
    onChange({ ...schedule, [key]: value });
  const customKind = schedule.custom_rule?.kind ?? "every_n_weeks";
  const isPhased = schedule.custom_rule?.kind === "titration_phases";
  const selectorValue = schedule.schedule_type === "custom" ? `custom:${customKind}` : schedule.schedule_type;
  const chooseType = (value: string) => {
    if (!value.startsWith("custom:")) {
      onChange({
        ...schedule,
        custom_rule: null,
        schedule_type: value as ScheduleType,
      });
      return;
    }
    const kind = value.slice(7) as CustomScheduleRule["kind"];
    if (kind === "titration_phases") return;
    onChange({
      ...schedule,
      custom_rule: createCustomRule(kind),
      schedule_type: "custom",
    });
  };
  return (
    <Card>
      <Choice
        label={t("routines.schedule")}
        onChange={chooseType}
        options={[
          ...(isPhased
            ? [{ label: t("routines.phasedUse"), value: "custom:titration_phases" }]
            : []),
          { label: t("routines.daily"), value: "daily" },
          { label: t("routines.weekly"), value: "weekly" },
          { label: t("routines.everyXHours"), value: "interval" },
          { label: t("addMedication.scheduleOptions.everyNWeeks.label"), value: "custom:every_n_weeks" },
          { label: t("addMedication.scheduleOptions.monthly.label"), value: "custom:monthly_day" },
          { label: t("addMedication.scheduleOptions.cycle.label"), value: "custom:cycle_days" },
        ]}
        value={selectorValue}
      />
      <Field label={t("routines.time")} onChangeText={(time_of_day) => set("time_of_day", time_of_day)} value={schedule.time_of_day} />
      {schedule.schedule_type === "weekly" ? (
        <Days onChange={(days_of_week) => set("days_of_week", days_of_week)} value={schedule.days_of_week} />
      ) : null}
      {schedule.schedule_type === "interval" ? (
        <NumberField label={t("routines.repeatEvery")} onChange={(interval_hours) => set("interval_hours", interval_hours)} value={schedule.interval_hours} />
      ) : null}
      {schedule.schedule_type === "custom" && schedule.custom_rule ? (
        <CustomRuleEditor onChange={(custom_rule) => set("custom_rule", custom_rule)} rule={schedule.custom_rule} />
      ) : null}
      {!isPhased ? <Button danger onPress={onRemove}>{t("addMedication.removeSchedule")}</Button> : null}
    </Card>
  );
}

function createCustomRule(
  kind: Exclude<CustomScheduleRule["kind"], "titration_phases">,
): Exclude<CustomScheduleRule, { kind: "titration_phases" }> {
  const anchor = new Date().toISOString().slice(0, 10);
  if (kind === "monthly_day") return { anchor_date: anchor, day_of_month: 1, kind, missing_day_policy: "last_day", version: 1 };
  if (kind === "cycle_days") return { active_windows: [{ start_day: 1, end_day: 21 }], anchor_date: anchor, cycle_length_days: 28, kind, version: 1 };
  const weekday = new Date(`${anchor}T12:00:00`).getDay() as DayOfWeek;
  return { anchor_date: anchor, interval_weeks: 2, kind: "every_n_weeks", version: 1, weekday };
}

function CustomRuleEditor({ onChange, rule }: { onChange: (rule: CustomScheduleRule) => void; rule: CustomScheduleRule }) {
  const { t } = useTranslation();
  if (rule.kind === "titration_phases") {
    return (
      <View style={styles.group}>
        <Field label={t("addMedication.anchorDate")} onChangeText={(anchor_date) => onChange({ ...rule, anchor_date })} value={rule.anchor_date} />
        {rule.phases.map((phase, index) => (
          <Card key={`phase-${phase.order}`}>
            <Field label={t("addMedication.phaseTitle")} onChangeText={(title) => onChange({ ...rule, phases: rule.phases.map((item, itemIndex) => itemIndex === index ? { ...item, title } : item) })} value={phase.title} />
            {index < rule.phases.length - 1 ? (
              <NumberField label={t("addMedication.phaseDurationDays")} onChange={(duration_days) => onChange({ ...rule, phases: rule.phases.map((item, itemIndex) => itemIndex === index ? { ...item, duration_days: duration_days ?? null } : item) })} value={phase.duration_days ?? undefined} />
            ) : null}
            {phase.schedule ? (
              <>
                <NumberField
                  label={t("routines.doseQuantity")}
                  onChange={(dose_quantity) => onChange({
                    ...rule,
                    phases: rule.phases.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, dose_quantity: dose_quantity ?? null } : item,
                    ),
                  })}
                  value={phase.dose_quantity ?? undefined}
                />
                <Field
                  label={t("routines.doseUnit")}
                  onChangeText={(dose_unit) => onChange({
                    ...rule,
                    phases: rule.phases.map((item, itemIndex) =>
                      itemIndex === index ? { ...item, dose_unit } : item,
                    ),
                  })}
                  value={phase.dose_unit ?? ""}
                />
                <Field
                  label={t("routines.time")}
                  onChangeText={(time_of_day) => onChange({
                    ...rule,
                    phases: rule.phases.map((item, itemIndex) =>
                      itemIndex === index
                        ? { ...item, schedule: { ...item.schedule!, time_of_day } }
                        : item,
                    ),
                  })}
                  value={phase.schedule.time_of_day}
                />
              </>
            ) : (
              <Body muted>{t("routines.phaseInactive")}</Body>
            )}
          </Card>
        ))}
      </View>
    );
  }
  if (rule.kind === "every_n_weeks") {
    return (
      <View style={styles.group}>
        <Field label={t("addMedication.anchorDate")} onChangeText={(anchor_date) => onChange({ ...rule, anchor_date })} value={rule.anchor_date} />
        <NumberField label={t("addMedication.intervalWeeks")} onChange={(interval_weeks) => onChange({ ...rule, interval_weeks: interval_weeks ?? 1 })} value={rule.interval_weeks} />
        <Choice label={t("addMedication.weekday")} onChange={(value) => onChange({ ...rule, weekday: Number(value) as DayOfWeek })} options={dayOptions.map((day) => ({ label: t(`days.short.${day}`), value: String(day) }))} value={String(rule.weekday)} />
      </View>
    );
  }
  if (rule.kind === "monthly_day") {
    return (
      <View style={styles.group}>
        <Field label={t("addMedication.anchorDate")} onChangeText={(anchor_date) => onChange({ ...rule, anchor_date })} value={rule.anchor_date} />
        <NumberField label={t("addMedication.dayOfMonth")} onChange={(day_of_month) => onChange({ ...rule, day_of_month: day_of_month ?? 1 })} value={rule.day_of_month} />
      </View>
    );
  }
  const window = rule.active_windows[0] ?? { start_day: 1, end_day: 21 };
  return (
    <View style={styles.group}>
      <Field label={t("addMedication.anchorDate")} onChangeText={(anchor_date) => onChange({ ...rule, anchor_date })} value={rule.anchor_date} />
      <NumberField label={t("addMedication.cycleLength")} onChange={(cycle_length_days) => onChange({ ...rule, cycle_length_days: cycle_length_days ?? 28 })} value={rule.cycle_length_days} />
      <NumberField label={t("addMedication.cycleActiveStart")} onChange={(start_day) => onChange({ ...rule, active_windows: [{ ...window, start_day: start_day ?? 1 }] })} value={window.start_day} />
      <NumberField label={t("addMedication.cycleActiveEnd")} onChange={(end_day) => onChange({ ...rule, active_windows: [{ ...window, end_day: end_day ?? 1 }] })} value={window.end_day} />
    </View>
  );
}

function Days({ onChange, value }: { onChange: (days: DayOfWeek[]) => void; value: DayOfWeek[] }) {
  const { t } = useTranslation();
  return (
    <View style={styles.group}>
      <Label>{t("addMedication.daysOfWeek")}</Label>
      <View style={styles.chips}>
        {dayOptions.map((day) => (
          <Pressable key={day} onPress={() => onChange(value.includes(day) ? value.filter((item) => item !== day) : [...value, day])} style={[styles.chip, value.includes(day) && styles.chipSelected]}>
            <Text style={[styles.chipText, value.includes(day) && styles.chipTextSelected]}>{t(`days.short.${day}`)}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function NumberField({ label, onChange, value }: { label: string; onChange: (value: number | undefined) => void; value?: number }) {
  return <Field keyboardType="decimal-pad" label={label} onChangeText={(text) => { const number = Number(text.replace(",", ".")); onChange(text.trim() && Number.isFinite(number) ? number : undefined); }} value={value?.toString() ?? ""} />;
}

const styles = StyleSheet.create({
  chip: { borderColor: colors.border, borderRadius: 999, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  chipSelected: { backgroundColor: colors.primary },
  chipText: { color: colors.ink },
  chipTextSelected: { color: colors.surface },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  flex: { flex: 1 },
  group: { gap: spacing.md },
  heading: { color: colors.ink, fontSize: 20, fontWeight: "800" },
  row: { flexDirection: "row", gap: spacing.md },
});
