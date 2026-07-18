import { useMemo, useRef, useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  buildBulkMarkDoseTakenPayload,
  buildManualTakenAt,
  chunkBulkEventIds,
  formatMedicationTime,
  getCommonTakenModes,
  getDefaultTakenMode,
  getMedicationDetails,
  getTakenModeLabelKey,
  getTreatmentTypeLabelKey,
  isAfterServerNow,
} from "../../dailyMedications/dailyMedicationUtils";
import { useMarkDosesTakenBatch } from "../../dailyMedications/hooks";
import type {
  BulkMarkDoseTakenPayload,
  BulkMarkDoseTakenResponse,
  DailyMedicationItem,
  TakenMode,
} from "../../dailyMedications/types";
import { colors, radii, spacing } from "../../design/theme";
import { ApiError } from "../../lib/apiClient";
import {
  Body,
  Button,
  Choice,
  Field,
  Sheet,
  ToggleRow,
  nativeStyles,
} from "../shared/native";

export type SingleFlightGate = {
  isRunning: () => boolean;
  run: <T>(operation: () => Promise<T>) => Promise<T | undefined>;
};

export function createSingleFlightGate(): SingleFlightGate {
  let running = false;
  return {
    isRunning: () => running,
    run: async <T,>(operation: () => Promise<T>) => {
      if (running) return undefined;
      running = true;
      try {
        return await operation();
      } finally {
        running = false;
      }
    },
  };
}

export function toggleBulkSelection(
  selectedEventIds: ReadonlySet<string>,
  eventId: string,
  selected: boolean,
) {
  const next = new Set(selectedEventIds);
  if (selected) next.add(eventId);
  else next.delete(eventId);
  return next;
}

export function createInitialBulkSelection(items: DailyMedicationItem[]) {
  return new Set(items.map((item) => item.event_id));
}

export function formatBulkResultKey(result: BulkMarkDoseTakenResponse) {
  return result.not_applied > 0 ? "home.bulkPartialResult" : "home.bulkSuccessResult";
}

export function BulkDoseActionSheet({
  dashboardDate,
  dashboardNow,
  items,
  locale,
  onClose,
  timezone,
}: {
  dashboardDate: string;
  dashboardNow: string;
  items: DailyMedicationItem[];
  locale: string;
  onClose: () => void;
  timezone: string;
}) {
  const { t } = useTranslation();
  const markBatch = useMarkDosesTakenBatch();
  const singleFlight = useRef(createSingleFlightGate()).current;
  const availableItems = items;
  const [selectedEventIds, setSelectedEventIds] = useState(
    () => createInitialBulkSelection(availableItems),
  );
  const selectedItems = useMemo(
    () => availableItems.filter((item) => selectedEventIds.has(item.event_id)),
    [availableItems, selectedEventIds],
  );
  const commonModes = useMemo(() => getCommonTakenModes(selectedItems), [selectedItems]);
  const [mode, setMode] = useState<TakenMode>(() =>
    getDefaultTakenMode(getCommonTakenModes(availableItems)),
  );
  const selectedMode = commonModes.includes(mode) ? mode : getDefaultTakenMode(commonModes);
  const [manualDate, setManualDate] = useState(dashboardDate);
  const [manualTime, setManualTime] = useState(() => timeInTimezone(dashboardNow, timezone));
  const busy = markBatch.isPending;

  const close = () => {
    if (markBatch.isPending || singleFlight.isRunning()) return;
    markBatch.reset();
    onClose();
  };

  const submit = () => singleFlight.run(async () => {
    if (markBatch.isPending || selectedItems.length === 0 || commonModes.length === 0) return;

    const takenAt = selectedMode === "manual"
      ? buildManualTakenAt(manualDate, manualTime, timezone)
      : undefined;
    if (
      selectedMode === "manual" &&
      (!takenAt || isAfterServerNow(takenAt, dashboardNow))
    ) {
      Alert.alert(t("home.manualTimeInFuture"));
      return;
    }

    const payloads = chunkBulkEventIds(
      selectedItems.map((item) => item.event_id),
    ).map((eventIds) => buildBulkMarkDoseTakenPayload({
      eventIds,
      mode: selectedMode,
      takenAt,
    }));
    const validPayloads = payloads.filter(
      (payload): payload is BulkMarkDoseTakenPayload => payload !== null,
    );
    if (payloads.length === 0 || validPayloads.length !== payloads.length) {
      Alert.alert(t("home.bulkInvalidSelection"));
      return;
    }

    try {
      const result = await markBatch.mutateAsync(validPayloads);
      onClose();
      Alert.alert(
        t(result.not_applied > 0 ? "home.bulkPartialTitle" : "home.bulkSuccessTitle"),
        t(formatBulkResultKey(result), {
          alreadyTaken: result.already_taken,
          marked: result.marked,
          notApplied: result.not_applied,
          requested: result.requested,
        }),
      );
    } catch (error) {
      const message = error instanceof ApiError ? error.message : t("common.somethingWentWrong");
      Alert.alert(
        t("home.bulkErrorTitle"),
        t("home.bulkErrorDescription", { message }),
      );
    }
  });

  return (
    <Sheet
      closeDisabled={busy}
      closeLabel={t("common.close")}
      onClose={close}
      testID="bulk-dose-sheet"
      title={t("home.bulkSheetTitle")}
      visible
    >
      <Body>{t("home.bulkSheetDescription")}</Body>
      <View accessibilityLiveRegion="polite" style={styles.countCard}>
        <Text style={styles.countText}>
          {t("home.bulkSelectedCount", {
            count: selectedItems.length,
            total: availableItems.length,
          })}
        </Text>
      </View>
      <View style={styles.list} testID="bulk-dose-list">
        {availableItems.map((item) => {
          const details = getMedicationDetails(
            t,
            item,
            t(getTreatmentTypeLabelKey(item.treatment_type)),
          );
          const time = formatMedicationTime(locale, item.scheduled_for, timezone);
          return (
            <View key={item.event_id} style={styles.itemRow}>
              <ToggleRow
                accessibilityLabel={[item.medication_name, details, t("home.scheduledForTime", { time })]
                  .filter(Boolean)
                  .join(", ")}
                description={[details, t("home.scheduledForTime", { time })]
                  .filter(Boolean)
                  .join(" • ")}
                disabled={busy}
                label={item.medication_name}
                onValueChange={(selected) =>
                  setSelectedEventIds((current) =>
                    toggleBulkSelection(current, item.event_id, selected),
                  )
                }
                testID={`bulk-dose-toggle-${item.event_id}`}
                value={selectedEventIds.has(item.event_id)}
              />
            </View>
          );
        })}
      </View>

      {selectedItems.length === 0 ? (
        <Body muted>{t("home.bulkEmptySelection")}</Body>
      ) : commonModes.length === 0 ? (
        <Body muted>{t("home.bulkNoCommonMode")}</Body>
      ) : (
        <>
          <Choice
            label={t("home.bulkTakenTime")}
            onChange={setMode}
            options={commonModes.map((value) => ({
              label: t(getTakenModeLabelKey(value)),
              value,
            }))}
            value={selectedMode}
          />
          {selectedMode === "on_time" ? <Body muted>{t("home.bulkOnTimeHint")}</Body> : null}
          {selectedMode === "manual" ? (
            <View style={nativeStyles.row}>
              <View style={styles.flex}>
                <Field
                  editable={!busy}
                  label={t("home.usedDate")}
                  onChangeText={setManualDate}
                  value={manualDate}
                />
              </View>
              <View style={styles.flex}>
                <Field
                  editable={!busy}
                  label={t("home.usedTime")}
                  onChangeText={setManualTime}
                  value={manualTime}
                />
              </View>
            </View>
          ) : null}
        </>
      )}

      <Button
        accessibilityLabel={t("home.bulkConfirmAccessibility", {
          count: selectedItems.length,
        })}
        disabled={selectedItems.length === 0 || commonModes.length === 0}
        loading={busy}
        onPress={() => void submit()}
        testID="bulk-dose-confirm"
      >
        {t("home.bulkConfirm", { count: selectedItems.length })}
      </Button>
    </Sheet>
  );
}

function timeInTimezone(serverNow: string, timezone: string) {
  const value = new Date(serverNow);
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
  countCard: {
    backgroundColor: colors.primarySoft,
    borderRadius: radii.md,
    padding: spacing.md,
  },
  countText: { color: colors.primary, fontSize: 16, fontWeight: "800" },
  flex: { flex: 1 },
  itemRow: {
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm,
  },
  list: {
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
  },
});
