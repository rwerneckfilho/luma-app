import { Clock3, Pill } from "lucide-react-native";
import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import type { AsNeededUsageLog } from "../../asNeededUsageLogs/types";
import { colors, fonts, radii, spacing } from "../../design/theme";
import {
  dateKeyInTimezone,
  formatAsNeededUsageDateTime,
  formatHistoryDate,
  formatHistoryTime,
  getHistoryStatusLabelKey,
  getTimelineDescription,
} from "../../history/historyUtils";
import type { AdherenceHistoryItem } from "../../history/types";
import { Accordion, Badge, Body, StateMessage } from "../shared/native";
import { historyStatusTone } from "./historyViewModel";

type TimelineEntry =
  | { at: string; id: string; item: AdherenceHistoryItem; kind: "scheduled" }
  | { at: string; id: string; item: AsNeededUsageLog; kind: "prn" };

export function HistoryTimeline({ asNeeded, items, locale, timezone }: { asNeeded: AsNeededUsageLog[]; items: AdherenceHistoryItem[]; locale: string; timezone: string }) {
  const { t } = useTranslation();
  const groups = useMemo(() => {
    const entries: TimelineEntry[] = [
      ...items.map((item) => ({ at: item.scheduled_for, id: item.event_id, item, kind: "scheduled" as const })),
      ...asNeeded.map((item) => ({ at: item.used_at, id: item.id, item, kind: "prn" as const })),
    ];
    const grouped = new Map<string, TimelineEntry[]>();
    for (const entry of entries) {
      const date = new Date(entry.at);
      const dateKey = entry.kind === "scheduled" || Number.isNaN(date.getTime()) ? entry.at.slice(0, 10) : dateKeyInTimezone(date, timezone);
      grouped.set(dateKey, [...(grouped.get(dateKey) ?? []), entry]);
    }
    return Array.from(grouped.entries())
      .sort(([left], [right]) => right.localeCompare(left))
      .map(([dateKey, dayEntries]) => ({ dateKey, entries: dayEntries.sort((left, right) => right.at.localeCompare(left.at)) }));
  }, [asNeeded, items, timezone]);

  if (groups.length === 0) return <StateMessage body={t("history.noHistoryBody")} title={t("history.noHistory")} />;

  return (
    <View style={styles.groups}>
      {groups.map((group, index) => (
        <Accordion defaultExpanded={index === 0} key={group.dateKey} subtitle={t("history.dayEntries", { count: group.entries.length })} title={formatHistoryDate(locale, group.dateKey)}>
          <View>
            {group.entries.map((entry, entryIndex) => (
              <TimelineRow entry={entry} isLast={entryIndex === group.entries.length - 1} key={`${entry.kind}-${entry.id}`} locale={locale} timezone={timezone} />
            ))}
          </View>
        </Accordion>
      ))}
    </View>
  );
}

function TimelineRow({ entry, isLast, locale, timezone }: { entry: TimelineEntry; isLast: boolean; locale: string; timezone: string }) {
  const { t } = useTranslation();
  const isPrn = entry.kind === "prn";
  const tone = isPrn ? "primary" : historyStatusTone(entry.item.status);
  const nodeColor = tone === "neutral" ? colors.outline : colors[tone];
  const time = formatHistoryTime(locale, entry.at, timezone);

  return (
    <View style={styles.row}>
      <View style={styles.railColumn}>
        <View style={[styles.node, { borderColor: nodeColor }]}>{isPrn ? <Pill color={nodeColor} size={13} /> : <Clock3 color={nodeColor} size={13} />}</View>
        {!isLast ? <View style={styles.rail} /> : null}
      </View>
      <View style={[styles.content, !isLast && styles.contentWithSpacing]}>
        <View style={styles.headingRow}>
          <View style={styles.titleWrap}>
            {time ? <Text style={styles.time}>{time}</Text> : null}
            <Text style={styles.name}>{entry.item.medication_name}</Text>
          </View>
          <Badge tone={tone}>{isPrn ? t("history.asNeeded") : t(getHistoryStatusLabelKey(entry.item.status))}</Badge>
        </View>
        {isPrn ? (
          <>
            <Body muted>{formatAsNeededUsageDateTime(t, locale, entry.item.used_at, timezone)}</Body>
            {entry.item.dose_quantity != null ? <Context label={t("history.dose")} value={`${entry.item.dose_quantity} ${entry.item.dose_unit ?? ""}`.trim()} /> : null}
            {entry.item.note ? <Context label={t("history.note")} value={entry.item.note} /> : null}
          </>
        ) : (
          <>
            <Body muted>{getTimelineDescription(t, entry.item.status, {
              delayMinutes: entry.item.delay_minutes,
              skippedAt: formatHistoryTime(locale, entry.item.skipped_at, timezone),
              takenAt: formatHistoryTime(locale, entry.item.taken_at, timezone),
            })}</Body>
            {entry.item.dosage_text ? <Context label={t("history.dose")} value={entry.item.dosage_text} /> : null}
            {entry.item.recorded_by_display_name ? <Body muted>{t("history.recordedBy", { name: entry.item.recorded_by_display_name })}</Body> : null}
          </>
        )}
      </View>
    </View>
  );
}

function Context({ label, value }: { label: string; value: string }) {
  return <View style={styles.context}><Text style={styles.contextLabel}>{label}</Text><Text style={styles.contextValue}>{value}</Text></View>;
}

const styles = StyleSheet.create({
  content: { backgroundColor: colors.surfaceMuted, borderRadius: radii.sm, flex: 1, gap: spacing.sm, padding: spacing.md },
  contentWithSpacing: { marginBottom: spacing.md },
  context: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  contextLabel: { color: colors.muted, fontFamily: fonts.bodySemibold, fontSize: 13 },
  contextValue: { color: colors.ink, flexShrink: 1, fontFamily: fonts.body, fontSize: 13 },
  groups: { gap: spacing.md },
  headingRow: { alignItems: "flex-start", flexDirection: "row", gap: spacing.sm, justifyContent: "space-between" },
  name: { color: colors.ink, flexShrink: 1, fontFamily: fonts.bodyBold, fontSize: 16 },
  node: { alignItems: "center", backgroundColor: colors.surface, borderRadius: 18, borderWidth: 2, height: 30, justifyContent: "center", width: 30, zIndex: 1 },
  rail: { backgroundColor: colors.border, bottom: -spacing.md, position: "absolute", top: 30, width: 2 },
  railColumn: { alignItems: "center", width: 34 },
  row: { alignItems: "stretch", flexDirection: "row", gap: spacing.sm },
  time: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: 13 },
  titleWrap: { flex: 1, gap: 2 },
});
