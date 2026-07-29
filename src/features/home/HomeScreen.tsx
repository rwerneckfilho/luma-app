import { useEffect, useMemo, useRef, useState } from "react";
import type { TFunction } from "i18next";
import { Alert, AppState, StyleSheet, Text, View } from "react-native";
import { CalendarDays, CheckCircle2, Clock, Pill, Plus } from "lucide-react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import Svg, { Circle } from "react-native-svg";
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
  getNextDailyMedicationTransitionAt,
  getMedicationDetails,
  getStatusLabelKey,
  getTakenModeLabelKey,
  getTreatmentTypeLabelKey,
  isAfterServerNow,
  projectDailyMedicationDashboard,
  projectServerNow,
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
import { useUserProfile } from "../../me/hooks";
import { colors, radii } from "../../design/theme";
import {
  Body,
  Accordion,
  Badge,
  Button,
  Card,
  Choice,
  Field,
  PageHeading,
  Screen,
  Section,
  Sheet,
  StateMessage,
  nativeStyles,
} from "../shared/native";
import { buildPrnUsagePayload, type PrnUsageMode } from "./prnUsageUtils";
import { findHomeMedicationAccordion, getDateInTimeZone, getGreetingKey, getNotificationEventId, groupHomeMedicationItems } from "./homeUtils";

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
  const router = useRouter();
  const params = useLocalSearchParams<{ event?: string | string[] }>();
  const dashboard = useDailyMedications();
  const routines = useRoutines();
  const medications = useMedications();
  const profile = useUserProfile();
  const [doseSheet, setDoseSheet] = useState<DoseSheetState | null>(null);
  const [prnSelection, setPrnSelection] = useState<PrnSheetState>(null);
  const [clientNow, setClientNow] = useState(() => Date.now());
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [expanded, setExpanded] = useState({ attention: true, completed: false, prn: false, upcoming: false });
  const refreshedEvents = useRef(new Set<string>());
  const lastRolloverRefetch = useRef<string | null>(null);
  const initializedUpcoming = useRef(false);
  const locale = i18n.resolvedLanguage ?? "pt-BR";
  const projectedNow = useMemo(() => dashboard.data
    ? projectServerNow(dashboard.data.server_now, dashboard.dataUpdatedAt, clientNow)
    : null, [clientNow, dashboard.data, dashboard.dataUpdatedAt]);
  const projectedDashboard = useMemo(() => dashboard.data && projectedNow
    ? projectDailyMedicationDashboard(dashboard.data, projectedNow)
    : null, [dashboard.data, projectedNow]);
  const staleDate = Boolean(projectedDashboard && projectedDashboard.date !== getDateInTimeZone(
    projectedDashboard.timezone, new Date(projectedDashboard.server_now),
  ));
  const data = staleDate ? null : projectedDashboard;
  const prnItems = useMemo(
    () => (routines.data ?? [])
      .filter((routine) =>
        isRoutineAsNeeded(routine) &&
        isAsNeededRoutineAvailable(routine, data?.date),
      )
      .map((routine) => ({
        medication: (medications.data ?? []).find(
          (medication) => medication.id === routine.medication_id && !medication.is_archived,
        ),
        routine,
      }))
      .filter((item) => Boolean(item.medication)),
    [data?.date, medications.data, routines.data],
  );
  const medicationGroups = useMemo(
    () => groupHomeMedicationItems(data?.items ?? [], data?.server_now ?? ""),
    [data?.items, data?.server_now],
  );
  const notificationEventId = getNotificationEventId(params.event);
  const notificationAccordion = notificationEventId
    ? findHomeMedicationAccordion(medicationGroups, notificationEventId) : null;
  const notificationMissing = Boolean(notificationEventId && !dashboard.isFetching && data && !notificationAccordion);
  const firstName = profile.data?.full_name?.trim().split(/\s+/)[0] || t("home.personFallback");

  useEffect(() => {
    if (!dashboard.data || !projectedNow) return;
    const transition = getNextDailyMedicationTransitionAt(dashboard.data, projectedNow);
    const now = new Date(projectedNow).getTime();
    const delay = Math.max(50, Math.min(60_000, transition ? transition - now : 60_000));
    const timer = setTimeout(() => setClientNow(Date.now()), delay);
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") setClientNow(Date.now());
    });
    return () => { clearTimeout(timer); subscription.remove(); };
  }, [dashboard.data, projectedNow]);

  useEffect(() => {
    if (!staleDate || !projectedDashboard) return;
    const rolloverKey = `${projectedDashboard.date}:${projectedDashboard.timezone}`;
    if (lastRolloverRefetch.current === rolloverKey) return;
    lastRolloverRefetch.current = rolloverKey;
    void dashboard.refetch({ cancelRefetch: false });
  }, [dashboard, projectedDashboard, staleDate]);

  useEffect(() => {
    if (!notificationEventId || refreshedEvents.current.has(notificationEventId)) return;
    refreshedEvents.current.add(notificationEventId);
    void dashboard.refetch({ cancelRefetch: false });
  }, [dashboard, notificationEventId]);

  useEffect(() => {
    if (!notificationAccordion) return;
    setExpanded((current) => ({ ...current, [notificationAccordion]: true }));
  }, [notificationAccordion, notificationEventId]);

  useEffect(() => {
    if (!data || initializedUpcoming.current) return;
    initializedUpcoming.current = true;
    if (medicationGroups.current.length + medicationGroups.earlierPending.length === 0 && medicationGroups.upcoming.length > 0) {
      setExpanded((current) => ({ ...current, upcoming: true }));
    }
  }, [data, medicationGroups]);

  const refresh = () => {
    setClientNow(Date.now());
    void dashboard.refetch({ cancelRefetch: false });
    void routines.refetch();
    void medications.refetch();
  };

  const openDoseAction = (item: DailyMedicationItem, kind: "taken" | "skip") => {
    const acknowledgeEarly = isScheduledAfterServerNow(item, data?.server_now);
    if (!acknowledgeEarly) {
      setDoseSheet({ acknowledgeEarly: false, item, kind });
      return;
    }

    Alert.alert(
      t("home.earlyActionTitle"),
      t("home.earlyActionDescription", {
        medication: item.medication_name,
        time: formatMedicationTime(locale, item.scheduled_for, data?.timezone),
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
    >
      <PageHeading subtitle={t("home.dailyRhythmSubtitle")}>
        {t(getGreetingKey())}, {firstName}
      </PageHeading>
      {dashboard.isLoading ? <StateMessage loading title={t("home.loading")} /> : null}
      {dashboard.isError ? (
        <StateMessage
          action={<Button onPress={refresh}>{t("common.tryAgain")}</Button>}
          body={messageOf(dashboard.error, t("home.loadError"))}
          title={t("home.couldNotLoad")}
        />
      ) : null}
      {statusMessage ? (
        <View accessibilityRole="alert" style={styles.feedback}>
          <CheckCircle2 color={colors.success} size={20} />
          <Body>{statusMessage}</Body>
        </View>
      ) : null}
      {notificationMissing ? <View style={styles.feedback}><Body muted>{t("home.loadError")}</Body></View> : null}
      {data ? (
        <>
          {data.items.length > 0 ? <Card>
            <View style={nativeStyles.rowBetween}>
              <View>
                <Text style={styles.progressValue}>
                  {data.total_taken}/{data.total_scheduled}
                </Text>
                <Body muted>{t("home.dailyProgress")}</Body>
                {data.next_scheduled_for ? <Body muted>{t("home.nextReminderAt", { time: formatMedicationTime(locale, data.next_scheduled_for, data.timezone) })}</Body> : null}
              </View>
              <ProgressRing percent={clampProgressPercent(data.progress_percent)} />
            </View>
            <Body muted>
              {formatDashboardDate(locale, data.date, data.timezone)}
            </Body>
          </Card> : null}

          <Section title={t("home.todaysMedications")}>
            {data.items.length === 0 && prnItems.length === 0 && !routines.isLoading && !medications.isLoading ? (
              <StateMessage
                action={<Button icon={Plus} onPress={() => router.push("/(app)/medications")}>{t("medications.addCta")}</Button>}
                body={t("home.noMedicationsScheduledBody")}
                title={t("home.noMedicationsScheduledToday")}
              />
            ) : <>
              <Accordion
                expanded={expanded.attention}
                icon={Clock}
                onExpandedChange={(value) => setExpanded((current) => ({ ...current, attention: value }))}
                subtitle={t("home.nowCategorySubtitle")}
                title={`${t("home.now")} (${medicationGroups.current.length + medicationGroups.earlierPending.length})`}
              >
                {medicationGroups.earlierPending.length > 0 ? (
                  <View style={styles.attentionNotice}>
                    <Text style={styles.attentionTitle}>{t("home.earlierPendingTitle")}</Text>
                    <Body>{t("home.earlierPendingSubtitle")}</Body>
                  </View>
                ) : null}
                {[...medicationGroups.earlierPending, ...medicationGroups.current].map((item) => (
                  <DoseCard highlighted={item.event_id === notificationEventId} item={item} key={item.event_id} locale={locale} onSkip={() => openDoseAction(item, "skip")} onTaken={() => openDoseAction(item, "taken")} serverNow={data.server_now} timezone={data.timezone} />
                ))}
                {medicationGroups.current.length + medicationGroups.earlierPending.length === 0 ? <Body muted>{t("home.nowCategoryEmpty")}</Body> : null}
              </Accordion>
              <Accordion
                expanded={expanded.prn}
                icon={Pill}
                onExpandedChange={(value) => setExpanded((current) => ({ ...current, prn: value }))}
                subtitle={t("home.asNeededSubtitle")}
                title={`${t("home.asNeededTitle")} (${prnItems.length})`}
              >
                {routines.isLoading || medications.isLoading ? <StateMessage loading title={t("routines.loading")} /> : null}
                {routines.isError || medications.isError ? <StateMessage action={<Button onPress={refresh}>{t("common.tryAgain")}</Button>} title={t("routines.couldNotLoad")} /> : null}
                {!routines.isLoading && !medications.isLoading && prnItems.length === 0 ? <Body muted>{t("home.asNeededCategoryEmpty")}</Body> : null}
                {prnItems.map(({ medication, routine }) => (
                  <Card key={routine.id}>
                    <Text style={styles.medicationName}>{medication!.name}</Text>
                    {routine.title ? <Body muted>{routine.title}</Body> : null}
                    <Body>{formatDose(t, routine, medication!.form)}</Body>
                    <Body muted>{formatAsNeededLimits(t, routine).join(" • ")}</Body>
                    <Button onPress={() => { setStatusMessage(null); setPrnSelection({ medication: medication!, routine }); }}>{t("home.logUse")}</Button>
                  </Card>
                ))}
              </Accordion>
              <Accordion
                expanded={expanded.completed}
                icon={CheckCircle2}
                onExpandedChange={(value) => setExpanded((current) => ({ ...current, completed: value }))}
                subtitle={t("home.completedCategorySubtitle")}
                title={`${t("home.completedCategoryTitle")} (${medicationGroups.completed.length})`}
              >
                {medicationGroups.completed.map((item) => (
                  <DoseCard highlighted={item.event_id === notificationEventId} item={item} key={item.event_id} locale={locale} onSkip={() => openDoseAction(item, "skip")} onTaken={() => openDoseAction(item, "taken")} serverNow={data.server_now} timezone={data.timezone} />
                ))}
                {medicationGroups.completed.length === 0 ? <Body muted>{t("home.completedCategoryEmpty")}</Body> : null}
              </Accordion>
              <Accordion
                expanded={expanded.upcoming}
                icon={CalendarDays}
                onExpandedChange={(value) => setExpanded((current) => ({ ...current, upcoming: value }))}
                subtitle={t("home.upcomingCategorySubtitle")}
                title={`${t("home.upcomingCategoryTitle")} (${medicationGroups.upcoming.length})`}
              >
                {medicationGroups.upcoming.map((item) => (
                  <DoseCard highlighted={item.event_id === notificationEventId} item={item} key={item.event_id} locale={locale} onSkip={() => openDoseAction(item, "skip")} onTaken={() => openDoseAction(item, "taken")} serverNow={data.server_now} timezone={data.timezone} />
                ))}
                {medicationGroups.upcoming.length === 0 ? <Body muted>{t("home.upcomingCategoryEmpty")}</Body> : null}
              </Accordion>
            </>}
          </Section>
        </>
      ) : null}

      {doseSheet ? (
        <DoseActionSheet
          dashboardNow={data?.server_now}
          dashboardDate={data?.date}
          key={`${doseSheet.item.event_id}:${doseSheet.kind}:${doseSheet.acknowledgeEarly}`}
          onClose={() => setDoseSheet(null)}
          onSuccess={(message) => setStatusMessage(message)}
          state={doseSheet}
          timezone={data?.timezone}
        />
      ) : null}
      <PrnUsageSheet
        key={prnSelection ? `prn-${prnSelection.routine.id}` : "prn-closed"}
        onClose={() => setPrnSelection(null)}
        onSuccess={() => setStatusMessage(t("home.useLogged"))}
        selection={prnSelection}
        serverNow={data?.server_now}
        timezone={data?.timezone}
      />
    </Screen>
  );
}

function DoseCard({
  highlighted,
  item,
  locale,
  onSkip,
  onTaken,
  serverNow,
  timezone,
}: {
  highlighted?: boolean;
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
    <Card style={highlighted ? styles.highlightedCard : undefined}>
      <View style={nativeStyles.rowBetween}>
        <View style={styles.flex}>
          <Text style={styles.medicationName}>{item.medication_name}</Text>
          <Body muted>{getMedicationDetails(t, item, t(getTreatmentTypeLabelKey(item.treatment_type)))}</Body>
        </View>
        <Badge tone={statusTone(item.status)}>{t(getStatusLabelKey(item.status))}</Badge>
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
  onSuccess,
  state,
  timezone,
}: {
  dashboardNow?: string;
  dashboardDate?: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
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
      onSuccess(t("home.doseMarkedTaken"));
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
      onSuccess(t("home.doseSkipped"));
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
  onSuccess,
  selection,
  serverNow,
  timezone,
}: {
  onClose: () => void;
  onSuccess: () => void;
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
                .then(() => { onSuccess(); onClose(); })
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
      onSuccess();
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

function statusTone(status: DailyMedicationItem["status"]): "danger" | "neutral" | "primary" | "success" | "warning" {
  if (status === "taken") return "success";
  if (status === "skipped") return "neutral";
  if (status === "overdue") return "danger";
  if (status === "due") return "warning";
  return "primary";
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

function ProgressRing({ percent }: { percent: number }) {
  const size = 72;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <View accessibilityLabel={`${percent}%`} accessibilityRole="progressbar" style={styles.progressRing}>
      <Svg height={size} width={size}>
        <Circle cx={size / 2} cy={size / 2} fill="none" r={radius} stroke={colors.primarySoft} strokeWidth={stroke} />
        <Circle cx={size / 2} cy={size / 2} fill="none" r={radius} rotation="-90" origin={`${size / 2}, ${size / 2}`} stroke={colors.primary} strokeDasharray={`${circumference} ${circumference}`} strokeDashoffset={circumference * (1 - percent / 100)} strokeLinecap="round" strokeWidth={stroke} />
      </Svg>
      <Text style={styles.progressPercent}>{percent}%</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  attentionNotice: { backgroundColor: colors.dangerSoft, borderRadius: radii.md, padding: 14 },
  attentionTitle: { color: colors.danger, fontSize: 16, fontWeight: "800" },
  flex: { flex: 1 },
  feedback: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, flexDirection: "row", gap: 10, padding: 14 },
  highlightedCard: { borderColor: colors.primary, borderWidth: 2 },
  medicationName: { color: colors.ink, fontSize: 18, fontWeight: "800" },
  progressPercent: { color: colors.primary, fontSize: 16, fontWeight: "800", position: "absolute" },
  progressRing: { alignItems: "center", height: 72, justifyContent: "center", width: 72 },
  progressValue: { color: colors.ink, fontSize: 24, fontWeight: "800" },
});
