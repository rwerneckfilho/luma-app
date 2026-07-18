/**
 * AI_CONTEXT
 * repo: luma-front-webapp
 * layer: service
 * domain: adherence-history
 * purpose: Pure date, grouping, summary, and display helpers for adherence history.
 * entrypoints:
 *   - groupHistoryItemsByDate
 *   - getTimelineDescription
 *   - dateRangeToIso
 * reads:
 *   - AdherenceHistoryItem
 * mutates:
 *   - none
 * used_by:
 *   - src/history/HistoryPage.tsx
 * read_first_when:
 *   - Changing history grouping, filter date math, or timeline labels.
 * avoid_reading_when:
 *   - Only changing API auth behavior.
 * invariants:
 *   - Date keys should remain stable for selected timezone/history grouping.
 */
import type { TFunction } from "i18next";
import type { Medication } from "../medications/types";
import type {
  AdherenceHistoryItem,
  AdherenceHistoryStatus,
  AdherenceHistorySummary,
} from "./types";

export function toDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateDaysAgo(date = new Date(), daysAgo = 0) {
  const next = new Date(date);
  next.setDate(next.getDate() - daysAgo);
  return toDateInputValue(next);
}

export type DateRangeValidationError = "end_before_start" | "invalid_end" | "invalid_start";

export function validateHistoryDateRange(
  start: string,
  end: string,
): DateRangeValidationError | null {
  if (!isValidDateKey(start)) return "invalid_start";
  if (!isValidDateKey(end)) return "invalid_end";
  if (end < start) return "end_before_start";
  return null;
}

export function formatHistoryDate(locale: string, dateKey: string) {
  const value = new Date(`${dateKey}T12:00:00`);

  if (Number.isNaN(value.getTime())) {
    return dateKey;
  }

  return new Intl.DateTimeFormat(locale, {
    dateStyle: "long",
  }).format(value);
}

export function formatHistoryTime(locale: string, iso: string | null | undefined, timezone: string) {
  if (!iso) {
    return null;
  }

  const value = new Date(iso);

  if (Number.isNaN(value.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone: timezone,
  }).format(value);
}

export function formatAsNeededUsageDateTime(
  t: TFunction,
  locale: string,
  iso: string,
  timezone: string,
  now = new Date(),
) {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) {
    return iso;
  }

  const time = new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(value);
  const valueDate = dateKeyInTimezone(value, timezone);
  const today = dateKeyInTimezone(now, timezone);
  const yesterday = dateKeyInTimezone(new Date(now.getTime() - 86_400_000), timezone);

  if (valueDate === today) {
    return t("history.asNeededUsedTodayAt", { time });
  }
  if (valueDate === yesterday) {
    return t("history.asNeededUsedYesterdayAt", { time });
  }

  const date = new Intl.DateTimeFormat(locale, {
    dateStyle: "short",
    timeZone: timezone,
  }).format(value);
  return t("history.asNeededUsedOnAt", { date, time });
}

export function dateRangeToIso(date: string, endOfDay = false) {
  if (!date) {
    return undefined;
  }

  const value = new Date(`${date}T${endOfDay ? "23:59:59.999" : "00:00:00.000"}`);
  return Number.isNaN(value.getTime()) ? undefined : value.toISOString();
}

export function dateKeyInTimezone(value: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function summaryPercent(summary: AdherenceHistorySummary) {
  if (!Number.isFinite(summary.adherence_percent)) {
    return 0;
  }

  return Math.max(0, Math.min(100, summary.adherence_percent));
}

export function groupHistoryItemsByDate(items?: AdherenceHistoryItem[] | null) {
  const safeItems = Array.isArray(items) ? items : [];
  const groups = new Map<string, AdherenceHistoryItem[]>();

  for (const item of safeItems) {
    const key = getDateKey(item.scheduled_for);

    if (!groups.has(key)) {
      groups.set(key, []);
    }

    groups.get(key)?.push(item);
  }

  return Array.from(groups.entries())
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([dateKey, groupedItems]) => ({
      dateKey,
      items: groupedItems.sort((a, b) => (a.scheduled_for > b.scheduled_for ? 1 : -1)),
    }));
}

export function getHistoryStatusLabelKey(status: AdherenceHistoryStatus) {
  return `history.statuses.${status}`;
}

export function buildDoctorOptions(
  medications: Medication[],
  historyItems: AdherenceHistoryItem[],
  backendDoctors: string[] = [],
) {
  const values = new Set<string>();

  for (const doctor of backendDoctors) {
    if (doctor.trim()) {
      values.add(doctor.trim());
    }
  }

  for (const medication of medications) {
    if (medication.prescribing_doctor_name?.trim()) {
      values.add(medication.prescribing_doctor_name.trim());
    }
  }

  for (const item of historyItems) {
    if (item.prescribing_doctor_name?.trim()) {
      values.add(item.prescribing_doctor_name.trim());
    }
  }

  return Array.from(values).sort((a, b) => a.localeCompare(b));
}

export function getTimelineDescription(
  t: TFunction,
  status: AdherenceHistoryStatus,
  details: {
    delayMinutes?: number | null;
    skippedAt?: string | null;
    takenAt?: string | null;
  },
) {
  if (status === "taken" && details.takenAt) {
    if (typeof details.delayMinutes === "number" && details.delayMinutes > 0) {
      return `${t("history.takenAt", { time: details.takenAt })} - ${t("history.minutesLate", {
        count: details.delayMinutes,
      })}`;
    }

    return t("history.takenAt", { time: details.takenAt });
  }

  if (status === "skipped") {
    return details.skippedAt
      ? t("history.skippedAt", { time: details.skippedAt })
      : t("history.statuses.skipped");
  }

  return t(getHistoryStatusLabelKey(status));
}

function getDateKey(iso: string) {
  return iso.slice(0, 10) || iso;
}

function isValidDateKey(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return (
    parsed.getUTCFullYear() === year &&
    parsed.getUTCMonth() === month - 1 &&
    parsed.getUTCDate() === day
  );
}
