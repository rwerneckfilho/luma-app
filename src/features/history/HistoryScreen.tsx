import {
  CalendarDays,
  CheckCircle2,
  CircleGauge,
  ClockAlert,
  ListChecks,
  RotateCcw,
  SkipForward,
  TimerOff,
} from "lucide-react-native";
import type { ComponentType } from "react";
import { useState } from "react";
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useTranslation } from "react-i18next";
import { useAsNeededUsageLogs } from "../../asNeededUsageLogs/hooks";
import { colors, fonts, radii, spacing } from "../../design/theme";
import { useAdherenceHistory, useAdherenceHistoryFilters } from "../../history/hooks";
import type { AdherenceHistoryFilters, AdherenceHistoryStatus } from "../../history/types";
import {
  dateDaysAgo,
  dateRangeToIso,
  getHistoryStatusLabelKey,
  summaryPercent,
  toDateInputValue,
  validateHistoryDateRange,
} from "../../history/historyUtils";
import { Accordion, Body, Button, Field, Label, Screen, Section, Sheet, StateMessage } from "../shared/native";
import { HistoryTimeline } from "./HistoryTimeline";
import { combineHistoryResources } from "./historyViewModel";

type Preset = "today" | "7" | "30" | "custom";
type Option = { label: string; value: string };

function filtersForPreset(preset: Preset, from: string, to: string): AdherenceHistoryFilters {
  if (preset === "today") return { date: to };
  if (preset === "7") return { date_from: dateDaysAgo(new Date(), 6), date_to: toDateInputValue() };
  if (preset === "30") return { date_from: dateDaysAgo(new Date(), 29), date_to: toDateInputValue() };
  return { date_from: from, date_to: to };
}

export function HistoryScreen() {
  const { i18n, t } = useTranslation();
  const { width } = useWindowDimensions();
  const [preset, setPreset] = useState<Preset>("today");
  const [dateFrom, setDateFrom] = useState(dateDaysAgo(new Date(), 6));
  const [dateTo, setDateTo] = useState(toDateInputValue());
  const [medicationId, setMedicationId] = useState("");
  const [doctor, setDoctor] = useState("");
  const [status, setStatus] = useState<AdherenceHistoryStatus | "">("");
  const dateError = preset === "custom"
    ? validateHistoryDateRange(dateFrom, dateTo)
    : preset === "today" ? validateHistoryDateRange(dateTo, dateTo) : null;
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
  const resourceState = combineHistoryResources([
    history,
    { ...prn, enabled: includeAsNeeded },
    filterOptions,
  ]);
  const locale = i18n.resolvedLanguage ?? "pt-BR";

  const refresh = () => {
    if (dateError === null) {
      void history.refetch();
      if (includeAsNeeded) void prn.refetch();
    }
    void filterOptions.refetch();
  };
  const clearFilters = () => {
    setPreset("today");
    setDateFrom(dateDaysAgo(new Date(), 6));
    setDateTo(toDateInputValue());
    setMedicationId("");
    setDoctor("");
    setStatus("");
  };

  const presetOptions: Option[] = [
    { label: t("history.today"), value: "today" },
    { label: t("history.last7Days"), value: "7" },
    { label: t("history.last30Days"), value: "30" },
    { label: t("history.custom"), value: "custom" },
  ];
  const medicationOptions: Option[] = [
    { label: t("history.allMedications"), value: "" },
    ...(filterOptions.data?.medications ?? []).map((item) => ({ label: item.name, value: item.id })),
  ];
  const doctorOptions: Option[] = [
    { label: t("history.allDoctors"), value: "" },
    ...(filterOptions.data?.doctors ?? []).map((name) => ({ label: name, value: name })),
  ];
  const statusOptions: Option[] = [
    { label: t("history.allStatuses"), value: "" },
    ...(filterOptions.data?.statuses ?? []).map((value) => ({ label: t(getHistoryStatusLabelKey(value)), value })),
  ];

  return (
    <Screen onRefresh={refresh} refreshing={history.isRefetching || prn.isRefetching || filterOptions.isRefetching} title={t("history.title")}>
      <Accordion defaultExpanded title={t("history.filters")}>
        <View style={styles.filterGrid}>
          <CompactSelect label={t("history.datePreset")} onChange={(value) => setPreset(value as Preset)} options={presetOptions} value={preset} />
          <CompactSelect label={t("history.medication")} onChange={setMedicationId} options={medicationOptions} value={medicationId} />
          <CompactSelect label={t("history.doctor")} onChange={setDoctor} options={doctorOptions} value={doctor} />
          <CompactSelect label={t("history.status")} onChange={(value) => setStatus(value as AdherenceHistoryStatus | "")} options={statusOptions} value={status} />
        </View>
        {preset === "today" ? (
          <Field error={dateError ? t("validation.validEndDate") : undefined} label={t("history.date")} onChangeText={setDateTo} value={dateTo} />
        ) : null}
        {preset === "custom" ? (
          <View style={[styles.dateRow, width < 480 && styles.dateRowNarrow]}>
            <View style={styles.flex}><Field error={dateError === "invalid_start" ? t("validation.validStartDate") : undefined} label={t("history.dateFrom")} onChangeText={setDateFrom} value={dateFrom} /></View>
            <View style={styles.flex}><Field error={dateError === "invalid_end" ? t("validation.validEndDate") : dateError === "end_before_start" ? t("validation.endDateAfterStart") : undefined} label={t("history.dateTo")} onChangeText={setDateTo} value={dateTo} /></View>
          </View>
        ) : null}
        <View style={styles.clearRow}><Button icon={RotateCcw} onPress={clearFilters} variant="ghost">{t("history.clearFilters")}</Button></View>
      </Accordion>

      {resourceState.isLoading ? <StateMessage loading title={t("history.loading")} /> : null}
      {!resourceState.isLoading && resourceState.isError ? <StateMessage action={<Button onPress={refresh}>{t("common.tryAgain")}</Button>} title={t("history.unableToLoad")} /> : null}
      {!resourceState.isLoading && !resourceState.isError && history.data ? (
        <>
          <View style={styles.metrics}>
            <Metric icon={ListChecks} label={t("history.scheduled")} value={String(history.data.summary.total_scheduled)} />
            <Metric icon={CheckCircle2} label={t("history.taken")} value={String(history.data.summary.total_taken)} tone="success" />
            <Metric icon={SkipForward} label={t("history.skipped")} value={String(history.data.summary.total_skipped)} tone="danger" />
            <Metric icon={TimerOff} label={t("history.overdue")} value={String(history.data.summary.total_overdue)} tone="danger" />
            <Metric icon={ClockAlert} label={t("history.takenLate")} value={String(history.data.summary.total_taken_late ?? 0)} tone="warning" />
            <Metric icon={CircleGauge} label={t("history.adherence")} value={`${Math.round(summaryPercent(history.data.summary))}%`} tone="success" />
          </View>
          <Section title={t("history.timeline")}>
            <HistoryTimeline asNeeded={includeAsNeeded ? prn.data ?? [] : []} items={history.data.items} locale={locale} timezone={history.data.timezone} />
          </Section>
        </>
      ) : null}
    </Screen>
  );
}

function CompactSelect({ label, onChange, options, value }: { label: string; onChange: (value: string) => void; options: Option[]; value: string }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? options[0];
  return (
    <View style={styles.selectWrap}>
      <Label>{label}</Label>
      <Pressable accessibilityLabel={label} accessibilityRole="button" onPress={() => setOpen(true)} style={({ pressed }) => [styles.select, pressed && styles.pressed]}>
        <Text numberOfLines={1} style={styles.selectText}>{selected?.label}</Text>
        <CalendarDays color={colors.primary} size={18} />
      </Pressable>
      <Sheet onClose={() => setOpen(false)} title={label} visible={open}>
        {options.map((option) => (
          <Pressable accessibilityRole="radio" accessibilityState={{ checked: option.value === value }} key={`${label}-${option.value}`} onPress={() => { onChange(option.value); setOpen(false); }} style={[styles.option, option.value === value && styles.optionSelected]}>
            <Text style={[styles.optionText, option.value === value && styles.optionTextSelected]}>{option.label}</Text>
            {option.value === value ? <CheckCircle2 color={colors.primary} size={20} /> : null}
          </Pressable>
        ))}
      </Sheet>
    </View>
  );
}

function Metric({ icon: Icon, label, tone = "primary", value }: { icon: ComponentType<{ color?: string; size?: number }>; label: string; tone?: "primary" | "success" | "danger" | "warning"; value: string }) {
  const color = colors[tone];
  return (
    <View style={styles.metric}>
      <View style={[styles.metricIcon, { backgroundColor: tone === "primary" ? colors.primarySoft : colors[`${tone}Soft`] }]}><Icon color={color} size={20} /></View>
      <View style={styles.metricCopy}><Text style={[styles.metricValue, { color }]}>{value}</Text><Body muted>{label}</Body></View>
    </View>
  );
}

const styles = StyleSheet.create({
  clearRow: { alignItems: "flex-start" },
  dateRow: { flexDirection: "row", gap: spacing.md },
  dateRowNarrow: { flexDirection: "column" },
  filterGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  flex: { flex: 1 },
  metric: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.sm, borderWidth: 1, flexBasis: 150, flexDirection: "row", flexGrow: 1, gap: spacing.md, minHeight: 82, padding: spacing.md },
  metricCopy: { flex: 1 },
  metricIcon: { alignItems: "center", borderRadius: radii.sm, height: 36, justifyContent: "center", width: 36 },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md },
  metricValue: { fontFamily: fonts.headingBold, fontSize: 24, fontWeight: "800" },
  option: { alignItems: "center", borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", justifyContent: "space-between", minHeight: 52, paddingHorizontal: spacing.md },
  optionSelected: { backgroundColor: colors.primarySoft },
  optionText: { color: colors.ink, flex: 1, fontFamily: fonts.body, fontSize: 16 },
  optionTextSelected: { color: colors.primary, fontFamily: fonts.bodySemibold },
  pressed: { opacity: 0.75 },
  select: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.sm, borderWidth: 1, flexDirection: "row", gap: spacing.sm, minHeight: 44, paddingHorizontal: spacing.md },
  selectText: { color: colors.ink, flex: 1, fontFamily: fonts.body, fontSize: 14 },
  selectWrap: { flexBasis: 210, flexGrow: 1, gap: spacing.xs, minWidth: 150 },
});
