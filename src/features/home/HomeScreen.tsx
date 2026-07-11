import { useMemo, useState } from "react";
import type { TFunction } from "i18next";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { ApiError } from "../../lib/apiClient";
import {
  buildManualTakenAt,
  canMarkDoseTaken,
  canSkipDose,
  clampProgressPercent,
  formatDashboardDate,
  formatMedicationTime,
  getDefaultTakenMode,
  getMedicationDetails,
  getStatusLabelKey,
  getTakenModeLabelKey,
  getTreatmentTypeLabelKey,
  isAfterServerNow,
} from "../../dailyMedications/dailyMedicationUtils";
import { useDailyMedications, useMarkDoseTaken, useSkipDose } from "../../dailyMedications/hooks";
import type { DailyMedicationItem, TakenMode } from "../../dailyMedications/types";
import { useRoutines } from "../../routines/hooks";
import { formatAsNeededLimits, formatDose, isRoutineAsNeeded } from "../../routines/routineUtils";
import type { Routine } from "../../routines/types";
import { useMedications } from "../../medications/hooks";
import {
  useCreateAsNeededUsageLog,
  usePreviewAsNeededUsageLog,
} from "../../asNeededUsageLogs/hooks";
import type { AsNeededLimitWarning } from "../../asNeededUsageLogs/types";
import type { Medication } from "../../medications/types";
import { colors, radii } from "../../design/theme";
import {
  Body,
  Button,
  Card,
  Choice,
  Field,
  Screen,
  Section,
  Sheet,
  StateMessage,
  nativeStyles,
} from "../shared/native";
import { buildPrnUsagePayload, type PrnUsageMode } from "./prnUsageUtils";

type DoseSheetState = {
  acknowledgeEarly: boolean;
  item: DailyMedicationItem;
  kind: "taken" | "skip";
};

type PrnSheetState = { medication: Medication; routine: Routine } | null;

function messageOf(error: unknown, fallback: string) {
  return error instanceof ApiError ? error.message : fallback;
}

export function HomeScreen() {
  const { i18n, t } = useTranslation();
  const dashboard = useDailyMedications();
  const routines = useRoutines();
  const medications = useMedications();
  const [doseSheet, setDoseSheet] = useState<DoseSheetState | null>(null);
  const [prnSelection, setPrnSelection] = useState<PrnSheetState>(null);
  const locale = i18n.resolvedLanguage ?? "pt-BR";
  const prnItems = useMemo(
    () => (routines.data ?? [])
      .filter((routine) =>
        isRoutineAsNeeded(routine) &&
        isAsNeededRoutineAvailable(routine, dashboard.data?.date),
      )
      .map((routine) => ({
        medication: (medications.data ?? []).find(
          (medication) => medication.id === routine.medication_id && !medication.is_archived,
        ),
        routine,
      }))
      .filter((item) => Boolean(item.medication)),
    [dashboard.data?.date, medications.data, routines.data],
  );

  const refresh = () => {
    void dashboard.refetch();
    void routines.refetch();
    void medications.refetch();
  };

  const openDoseAction = (item: DailyMedicationItem, kind: "taken" | "skip") => {
    const acknowledgeEarly = isScheduledAfterServerNow(item, dashboard.data?.server_now);
    if (!acknowledgeEarly) {
      setDoseSheet({ acknowledgeEarly: false, item, kind });
      return;
    }

    Alert.alert(
      t("home.earlyActionTitle"),
      t("home.earlyActionDescription", {
        medication: item.medication_name,
        time: formatMedicationTime(locale, item.scheduled_for, dashboard.data?.timezone),
      }),
      [
        { style: "cancel", text: t("common.cancel") },
        {
          onPress: () => setDoseSheet({ acknowledgeEarly: true, item, kind }),
          text: t(kind === "taken" ? "home.markAsTaken" : "home.skipDose"),
        },
      ],
    );
  };

  return (
    <Screen
      onRefresh={refresh}
      refreshing={dashboard.isRefetching || routines.isRefetching || medications.isRefetching}
      title={t("home.title")}
    >
      {dashboard.isLoading ? <StateMessage loading title={t("home.loading")} /> : null}
      {dashboard.isError ? (
        <StateMessage
          action={<Button onPress={refresh}>{t("common.tryAgain")}</Button>}
          body={messageOf(dashboard.error, t("home.loadError"))}
          title={t("home.couldNotLoad")}
        />
      ) : null}
      {dashboard.data ? (
        <>
          <Card>
            <View style={nativeStyles.rowBetween}>
              <View>
                <Text style={styles.progressValue}>
                  {dashboard.data.total_taken}/{dashboard.data.total_scheduled}
                </Text>
                <Body muted>{t("home.dailyProgress")}</Body>
              </View>
              <Text style={styles.progressPercent}>
                {clampProgressPercent(dashboard.data.progress_percent)}%
              </Text>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${clampProgressPercent(dashboard.data.progress_percent)}%` },
                ]}
              />
            </View>
            <Body muted>
              {formatDashboardDate(locale, dashboard.data.date, dashboard.data.timezone)}
            </Body>
          </Card>

          <Section title={t("home.todaysMedications")}>
            {dashboard.data.items.length === 0 ? (
              <StateMessage
                body={t("home.noMedicationsScheduledBody")}
                title={t("home.noMedicationsScheduledToday")}
              />
            ) : (
              dashboard.data.items.map((item) => (
                <DoseCard
                  item={item}
                  key={item.event_id}
                  locale={locale}
                  onSkip={() => openDoseAction(item, "skip")}
                  onTaken={() => openDoseAction(item, "taken")}
                  serverNow={dashboard.data.server_now}
                  timezone={dashboard.data.timezone}
                />
              ))
            )}
          </Section>
        </>
      ) : null}

      <Section title={t("home.asNeededTitle")}>
        {routines.isLoading || medications.isLoading ? <StateMessage loading title={t("routines.loading")} /> : null}
        {routines.isError || medications.isError ? <StateMessage action={<Button onPress={refresh}>{t("common.tryAgain")}</Button>} title={t("routines.couldNotLoad")} /> : null}
        {!routines.isLoading && !medications.isLoading && prnItems.length === 0 ? (
          <StateMessage body={t("home.noRoutinesBody")} title={t("home.noRoutinesTitle")} />
        ) : null}
        {prnItems.map(({ medication, routine }) => (
          <Card key={routine.id}>
            <Text style={styles.medicationName}>{medication!.name}</Text>
            {routine.title ? <Body muted>{routine.title}</Body> : null}
            <Body>{formatDose(t, routine, medication!.form)}</Body>
            <Body muted>{formatAsNeededLimits(t, routine).join(" • ")}</Body>
            <Button onPress={() => setPrnSelection({ medication: medication!, routine })}>{t("home.logUse")}</Button>
          </Card>
        ))}
      </Section>

      {doseSheet ? (
        <DoseActionSheet
          dashboardNow={dashboard.data?.server_now}
          dashboardDate={dashboard.data?.date}
          key={`${doseSheet.item.event_id}:${doseSheet.kind}:${doseSheet.acknowledgeEarly}`}
          onClose={() => setDoseSheet(null)}
          state={doseSheet}
          timezone={dashboard.data?.timezone}
        />
      ) : null}
      <PrnUsageSheet
        key={prnSelection ? `prn-${prnSelection.routine.id}` : "prn-closed"}
        onClose={() => setPrnSelection(null)}
        selection={prnSelection}
        serverNow={dashboard.data?.server_now}
        timezone={dashboard.data?.timezone}
      />
    </Screen>
  );
}

function DoseCard({
  item,
  locale,
  onSkip,
  onTaken,
  serverNow,
  timezone,
}: {
  item: DailyMedicationItem;
  locale: string;
  onSkip: () => void;
  onTaken: () => void;
  serverNow: string;
  timezone: string;
}) {
  const { t } = useTranslation();
  const terminal = item.status === "taken" || item.status === "skipped";
  const allowEarlyActions = !terminal && isScheduledAfterServerNow(item, serverNow);
  return (
    <Card>
      <View style={nativeStyles.rowBetween}>
        <View style={styles.flex}>
          <Text style={styles.medicationName}>{item.medication_name}</Text>
          <Body muted>{getMedicationDetails(t, item, t(getTreatmentTypeLabelKey(item.treatment_type)))}</Body>
        </View>
        <Text style={nativeStyles.badge}>{t(getStatusLabelKey(item.status))}</Text>
      </View>
      <Body>
        {t("home.scheduledForTime", {
          time: formatMedicationTime(locale, item.scheduled_for, timezone),
        })}
      </Body>
      {item.recorded_by_display_name ? (
        <Body muted>
          {t(item.status === "skipped" ? "home.skippedBy" : "home.recordedBy", {
            name: item.recorded_by_display_name,
          })}
        </Body>
      ) : null}
      {!terminal ? (
        <View style={nativeStyles.actionRow}>
          {allowEarlyActions || canMarkDoseTaken(item) ? <Button onPress={onTaken}>{t("home.markAsTaken")}</Button> : null}
          {allowEarlyActions || canSkipDose(item) ? (
            <Button onPress={onSkip} secondary>
              {t("home.skip")}
            </Button>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

function DoseActionSheet({
  dashboardNow,
  dashboardDate,
  onClose,
  state,
  timezone,
}: {
  dashboardNow?: string;
  dashboardDate?: string;
  onClose: () => void;
  state: DoseSheetState;
  timezone?: string;
}) {
  const { t } = useTranslation();
  const markTaken = useMarkDoseTaken();
  const skip = useSkipDose();
  const options: TakenMode[] = state.acknowledgeEarly
    ? ["now"]
    : state.item.allowed_taken_options;
  const [mode, setMode] = useState<TakenMode>(() => getDefaultTakenMode(options));
  const [manualDate, setManualDate] = useState(
    () => dashboardDate ?? new Date().toISOString().slice(0, 10),
  );
  const [manualTime, setManualTime] = useState(() => timeInTimezone(dashboardNow, timezone));

  const close = () => {
    markTaken.reset();
    skip.reset();
    onClose();
  };

  const submitTaken = async () => {
    const selectedMode = options.includes(mode) ? mode : getDefaultTakenMode(options);
    const takenAt = selectedMode === "manual"
      ? buildManualTakenAt(manualDate, manualTime, timezone)
      : null;
    if (selectedMode === "manual" && (!takenAt || (dashboardNow && isAfterServerNow(takenAt, dashboardNow)))) {
      Alert.alert(t("home.manualTimeInFuture"));
      return;
    }
    try {
      await markTaken.mutateAsync({
        eventId: state.item.event_id,
        payload: {
          acknowledge_early: state.acknowledgeEarly || undefined,
          mode: selectedMode,
          taken_at: takenAt,
        },
      });
      close();
    } catch (error) {
      Alert.alert(t("home.unableToMarkDoseTaken"), messageOf(error, t("common.somethingWentWrong")));
    }
  };

  const submitSkip = async () => {
    try {
      await skip.mutateAsync({
        acknowledgeEarly: state.acknowledgeEarly,
        eventId: state.item.event_id,
      });
      close();
    } catch (error) {
      Alert.alert(t("home.unableToSkipDose"), messageOf(error, t("common.somethingWentWrong")));
    }
  };

  return (
    <Sheet
      onClose={close}
      title={state.kind === "skip" ? t("home.skipDose") : t("home.markAsTaken")}
      visible
    >
      <Card>
        <Text style={styles.medicationName}>{state.item.medication_name}</Text>
        <Body muted>
          {getMedicationDetails(
            t,
            state.item,
            t(getTreatmentTypeLabelKey(state.item.treatment_type)),
          )}
        </Body>
      </Card>
      {state.kind === "taken" ? (
        <>
          <Choice
            label={t("home.takenTime")}
            onChange={setMode}
            options={options.map((value) => ({ label: t(getTakenModeLabelKey(value)), value }))}
            value={options.includes(mode) ? mode : getDefaultTakenMode(options)}
          />
          {(options.includes(mode) ? mode : getDefaultTakenMode(options)) === "manual" ? (
            <View style={nativeStyles.row}>
              <View style={styles.flex}>
                <Field label={t("home.usedDate")} onChangeText={setManualDate} value={manualDate} />
              </View>
              <View style={styles.flex}>
                <Field label={t("home.usedTime")} onChangeText={setManualTime} value={manualTime} />
              </View>
            </View>
          ) : null}
          {state.acknowledgeEarly ? <Body muted>{t("home.earlyActionSafetyNote")}</Body> : null}
          <Button loading={markTaken.isPending} onPress={() => void submitTaken()}>
            {t("home.confirmTaken")}
          </Button>
        </>
      ) : (
        <>
          <Body>{t("home.skipDoseDescription")}</Body>
          {state.acknowledgeEarly ? <Body muted>{t("home.earlyActionSafetyNote")}</Body> : null}
          <Button danger loading={skip.isPending} onPress={() => void submitSkip()}>
            {t("home.skipDose")}
          </Button>
        </>
      )}
    </Sheet>
  );
}

function PrnUsageSheet({
  onClose,
  selection,
  serverNow,
  timezone,
}: {
  onClose: () => void;
  selection: PrnSheetState;
  serverNow?: string;
  timezone?: string;
}) {
  const { t } = useTranslation();
  const preview = usePreviewAsNeededUsageLog();
  const create = useCreateAsNeededUsageLog();
  const routine = selection?.routine ?? null;
  const [mode, setMode] = useState<PrnUsageMode>("now");
  const [manualDate, setManualDate] = useState("");
  const [manualTime, setManualTime] = useState("");
  const [dose, setDose] = useState(() => routine?.dose_quantity?.toString() ?? "");
  const [note, setNote] = useState("");

  const submit = async () => {
    if (!routine || !selection) return;
    const result = buildPrnUsagePayload({
      doseInput: dose,
      manualDate,
      manualTime,
      medicationForm: selection.medication.form,
      mode,
      note,
      routine,
      serverNow,
      timezone,
    });
    if (!result.ok) {
      Alert.alert(
        t("home.unableToLogUse"),
        t(
          result.error === "invalid_dose"
            ? "validation.doseQuantityPositive"
            : result.error === "future_datetime"
              ? "home.asNeededUsedAtInFuture"
              : "home.enterDateAndTime",
        ),
      );
      return;
    }
    const { payload } = result;
    try {
      const result = await preview.mutateAsync(payload);
      if (result.requires_confirmation) {
        Alert.alert(
          t("home.limitWarningTitle"),
          result.warnings.map((warning) => formatLimitWarning(t, warning)).join("\n"),
          [
            { style: "cancel", text: t("common.cancel") },
            {
              onPress: () => void create
                .mutateAsync({ ...payload, acknowledge_warnings: true })
                .then(onClose)
                .catch((error) => Alert.alert(
                  t("home.unableToLogUse"),
                  messageOf(error, t("common.somethingWentWrong")),
                )),
              text: t("home.confirmLogUse"),
            },
          ],
        );
        return;
      }
      await create.mutateAsync(payload);
      onClose();
    } catch (error) {
      if (error instanceof ApiError && error.status === 422) {
        Alert.alert(t("home.unableToLogUse"), t("home.asNeededUsedAtInFuture"));
        return;
      }
      Alert.alert(t("home.unableToLogUse"), messageOf(error, t("common.somethingWentWrong")));
    }
  };

  return (
    <Sheet onClose={onClose} title={t("home.logUse")} visible={Boolean(routine)}>
      {routine ? (
        <>
          <Card>
            <Text style={styles.medicationName}>{selection?.medication.name}</Text>
            {routine.title ? <Body muted>{routine.title}</Body> : null}
            <Body>{formatDose(t, routine, selection?.medication.form)}</Body>
            <Body muted>{formatAsNeededLimits(t, routine).join(" • ")}</Body>
          </Card>
          <Choice
            label={t("home.usedTime")}
            onChange={setMode}
            options={[
              { label: t("home.logNow"), value: "now" },
              { label: t("home.enterDateAndTime"), value: "manual" },
            ]}
            value={mode}
          />
          {mode === "manual" ? (
            <View style={nativeStyles.row}>
              <View style={styles.flex}>
                <Field label={t("home.usedDate")} onChangeText={setManualDate} value={manualDate} />
              </View>
              <View style={styles.flex}>
                <Field label={t("home.usedTime")} onChangeText={setManualTime} value={manualTime} />
              </View>
            </View>
          ) : null}
          <Field
            keyboardType="decimal-pad"
            label={t("routines.doseQuantity")}
            onChangeText={setDose}
            placeholder={routine.dose_quantity?.toString()}
            value={dose}
          />
          <Field
            label={t("home.usageNote")}
            multiline
            onChangeText={setNote}
            placeholder={t("home.usageNotePlaceholder")}
            value={note}
          />
          <Button loading={preview.isPending || create.isPending} onPress={() => void submit()}>
            {t("home.logUse")}
          </Button>
        </>
      ) : null}
    </Sheet>
  );
}

function isScheduledAfterServerNow(item: DailyMedicationItem, serverNow?: string) {
  if (!serverNow) return item.status === "upcoming";
  const scheduled = new Date(item.scheduled_for).getTime();
  const now = new Date(serverNow).getTime();
  return Number.isFinite(scheduled) && Number.isFinite(now) && scheduled > now;
}

function isAsNeededRoutineAvailable(routine: Routine, dashboardDate?: string) {
  const date = dashboardDate ?? localDateKey();
  return Boolean(
    routine.is_current &&
    routine.active &&
    routine.status === "active" &&
    (!routine.start_date || routine.start_date <= date) &&
    (!routine.end_date || routine.end_date >= date),
  );
}

function localDateKey(value = new Date()) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatLimitWarning(t: TFunction, warning: AsNeededLimitWarning) {
  if (warning.code === "min_interval") {
    return t("home.minIntervalWarning", {
      elapsed: Math.round(warning.current_value * 10) / 10,
      required: warning.limit,
    });
  }
  if (warning.code === "max_uses") {
    return t("home.maxUsesWarning", {
      current: warning.current_value,
      limit: warning.limit,
      period: warning.period_minutes,
    });
  }
  return t("home.maxDoseWarning", {
    current: warning.current_value,
    limit: warning.limit,
    period: warning.period_minutes,
    projected: warning.projected_value,
  });
}

function timeInTimezone(serverNow?: string, timezone?: string) {
  const value = serverNow ? new Date(serverNow) : new Date();
  if (Number.isNaN(value.getTime())) return new Date().toTimeString().slice(0, 5);
  try {
    return new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      hourCycle: "h23",
      minute: "2-digit",
      timeZone: timezone,
    }).format(value);
  } catch {
    return new Date().toTimeString().slice(0, 5);
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  medicationName: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  progressFill: { backgroundColor: colors.primary, borderRadius: radii.pill, height: 10 },
  progressPercent: { color: colors.primary, fontSize: 28, fontWeight: "800" },
  progressTrack: { backgroundColor: colors.primarySoft, borderRadius: radii.pill, height: 10 },
  progressValue: { color: colors.ink, fontSize: 24, fontWeight: "800" },
});
