import { useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useAdherenceHistory, useAdherenceHistoryFilters } from "../../history/hooks";
import type { AdherenceHistoryFilters, AdherenceHistoryStatus } from "../../history/types";
import {
  dateDaysAgo,
  dateRangeToIso,
  formatAsNeededUsageDateTime,
  formatHistoryDate,
  formatHistoryTime,
  getHistoryStatusLabelKey,
  getTimelineDescription,
  summaryPercent,
  toDateInputValue,
  validateHistoryDateRange,
} from "../../history/historyUtils";
import { useAsNeededUsageLogs } from "../../asNeededUsageLogs/hooks";
import { colors, spacing } from "../../design/theme";
import { Body, Button, Card, Choice, Field, Screen, Section, StateMessage, nativeStyles } from "../shared/native";

type Preset = "today" | "7" | "30" | "custom";

function filtersForPreset(preset: Preset, from: string, to: string): AdherenceHistoryFilters {
  if (preset === "today") return { date: toDateInputValue() };
  if (preset === "7") return { date_from: dateDaysAgo(new Date(), 6), date_to: toDateInputValue() };
  if (preset === "30") return { date_from: dateDaysAgo(new Date(), 29), date_to: toDateInputValue() };
  return { date_from: from, date_to: to };
}

export function HistoryScreen() {
  const { i18n, t } = useTranslation();
  const [preset, setPreset] = useState<Preset>("7");
  const [dateFrom, setDateFrom] = useState(dateDaysAgo(new Date(), 6));
  const [dateTo, setDateTo] = useState(toDateInputValue());
  const [medicationId, setMedicationId] = useState("");
  const [doctor, setDoctor] = useState("");
  const [status, setStatus] = useState<AdherenceHistoryStatus | "">("");
  const dateError = preset === "custom" ? validateHistoryDateRange(dateFrom, dateTo) : null;
  const baseFilters = filtersForPreset(preset, dateFrom, dateTo);
  const filters: AdherenceHistoryFilters = {
    ...baseFilters,
    medication_id: medicationId || undefined,
    prescribing_doctor_name: doctor || undefined,
    status: status || undefined,
  };
  const history = useAdherenceHistory(filters, dateError === null);
  const filterOptions = useAdherenceHistoryFilters();
  const includeAsNeeded = !doctor && !status;
  const prn = useAsNeededUsageLogs({
    date_from: dateRangeToIso(baseFilters.date ?? baseFilters.date_from ?? ""),
    date_to: dateRangeToIso(baseFilters.date ?? baseFilters.date_to ?? "", true),
    medication_id: medicationId || undefined,
    limit: 100,
  }, includeAsNeeded && dateError === null);
  const locale = i18n.resolvedLanguage ?? "pt-BR";

  const timeline = useMemo(() => {
    const scheduled = (history.data?.items ?? []).map((item) => ({
      at: item.scheduled_for,
      id: item.event_id,
      kind: "scheduled" as const,
      item,
    }));
    const asNeeded = (includeAsNeeded ? prn.data ?? [] : []).map((item) => ({
      at: item.used_at,
      id: item.id,
      item,
      kind: "prn" as const,
    }));
    return [...scheduled, ...asNeeded].sort((a, b) => (a.at < b.at ? 1 : -1));
  }, [history.data?.items, includeAsNeeded, prn.data]);

  const refresh = () => {
    if (dateError === null) {
      void history.refetch();
      void prn.refetch();
    }
    void filterOptions.refetch();
  };

  return (
    <Screen onRefresh={refresh} refreshing={history.isRefetching || prn.isRefetching} title={t("history.title")}>
      <Choice<Preset>
        label={t("history.datePreset")}
        onChange={setPreset}
        options={[
          { label: t("history.today"), value: "today" },
          { label: t("history.last7Days"), value: "7" },
          { label: t("history.last30Days"), value: "30" },
          { label: t("history.custom"), value: "custom" },
        ]}
        value={preset}
      />
      {preset === "custom" ? (
        <View style={styles.row}>
          <View style={styles.flex}><Field error={dateError === "invalid_start" ? t("validation.validStartDate") : undefined} label={t("history.dateFrom")} onChangeText={setDateFrom} value={dateFrom} /></View>
          <View style={styles.flex}><Field error={dateError === "invalid_end" ? t("validation.validEndDate") : dateError === "end_before_start" ? t("validation.endDateAfterStart") : undefined} label={t("history.dateTo")} onChangeText={setDateTo} value={dateTo} /></View>
        </View>
      ) : null}
      <Choice
        label={t("history.medication")}
        onChange={setMedicationId}
        options={[
          { label: t("history.allMedications"), value: "" },
          ...(filterOptions.data?.medications ?? []).map((item) => ({ label: item.name, value: item.id })),
        ]}
        value={medicationId}
      />
      <Choice
        label={t("history.doctor")}
        onChange={setDoctor}
        options={[
          { label: t("history.allDoctors"), value: "" },
          ...(filterOptions.data?.doctors ?? []).map((name) => ({ label: name, value: name })),
        ]}
        value={doctor}
      />
      <Choice
        label={t("history.status")}
        onChange={(value) => setStatus(value as AdherenceHistoryStatus | "")}
        options={[
          { label: t("history.allStatuses"), value: "" },
          ...(filterOptions.data?.statuses ?? []).map((value) => ({ label: t(getHistoryStatusLabelKey(value)), value })),
        ]}
        value={status}
      />
      {history.isLoading ? <StateMessage loading title={t("history.loading")} /> : null}
      {history.isError ? <StateMessage action={<Button onPress={refresh}>{t("common.tryAgain")}</Button>} title={t("history.unableToLoad")} /> : null}
      {history.data ? (
        <>
          <View style={styles.metrics}>
            <Metric label={t("history.adherence")} value={`${summaryPercent(history.data.summary)}%`} />
            <Metric label={t("history.taken")} value={String(history.data.summary.total_taken)} />
            <Metric label={t("history.takenLate")} value={String(history.data.summary.total_taken_late ?? 0)} />
            <Metric label={t("history.skipped")} value={String(history.data.summary.total_skipped)} />
            <Metric label={t("history.overdue")} value={String(history.data.summary.total_overdue)} />
          </View>
          <Section title={t("history.timeline")}>
            {timeline.length === 0 ? <StateMessage body={t("history.noHistoryBody")} title={t("history.noHistory")} /> : null}
            {timeline.map((entry) =>
              entry.kind === "prn" ? (
                <Card key={`prn-${entry.id}`}>
                  <View style={nativeStyles.rowBetween}>
                    <Text style={styles.name}>{entry.item.medication_name}</Text>
                    <Text style={nativeStyles.badge}>{t("history.asNeeded")}</Text>
                  </View>
                  <Body>{formatAsNeededUsageDateTime(t, locale, entry.item.used_at, history.data.timezone)}</Body>
                  {entry.item.dose_quantity != null ? <Body muted>{entry.item.dose_quantity} {entry.item.dose_unit}</Body> : null}
                  {entry.item.note ? <Body muted>{entry.item.note}</Body> : null}
                </Card>
              ) : (
                <Card key={`scheduled-${entry.id}`}>
                  <View style={nativeStyles.rowBetween}>
                    <Text style={styles.name}>{entry.item.medication_name}</Text>
                    <Text style={nativeStyles.badge}>{t(getHistoryStatusLabelKey(entry.item.status))}</Text>
                  </View>
                  <Body>{formatHistoryDate(locale, entry.item.scheduled_for.slice(0, 10))} • {formatHistoryTime(locale, entry.item.scheduled_for, history.data.timezone)}</Body>
                  <Body muted>{getTimelineDescription(t, entry.item.status, {
                    delayMinutes: entry.item.delay_minutes,
                    skippedAt: formatHistoryTime(locale, entry.item.skipped_at, history.data.timezone),
                    takenAt: formatHistoryTime(locale, entry.item.taken_at, history.data.timezone),
                  })}</Body>
                  {entry.item.recorded_by_display_name ? <Body muted>{t("history.recordedBy", { name: entry.item.recorded_by_display_name })}</Body> : null}
                </Card>
              ),
            )}
          </Section>
        </>
      ) : null}
    </Screen>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Body muted>{label}</Body>
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  metric: { minWidth: "45%" },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  metricValue: { color: colors.primary, fontSize: 26, fontWeight: "800" },
  name: { color: colors.ink, flex: 1, fontSize: 17, fontWeight: "800" },
  row: { flexDirection: "row", gap: spacing.md },
});
