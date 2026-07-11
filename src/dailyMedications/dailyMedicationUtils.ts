/**
 * AI_CONTEXT
 * repo: luma-front-webapp
 * layer: service
 * domain: daily-medications
 * purpose: Pure date, status, progress, and payload helpers for daily medication UI.
 * entrypoints:
 *   - canMarkDoseTaken
 *   - canSkipDose
 *   - buildManualTakenAt
 * reads:
 *   - DailyMedicationItem
 * mutates:
 *   - none
 * used_by:
 *   - src/home/*
 * read_first_when:
 *   - Changing Home action availability or local datetime formatting.
 * avoid_reading_when:
 *   - Only changing API endpoint paths.
 * invariants:
 *   - UI affordances must remain aligned with luma-core dose status rules.
 */
import type { TFunction } from "i18next";
import type {
  DailyMedicationItem,
  DailyMedicationStatus,
  TakenMode,
} from "./types";
import { getMedicationUnitLabel } from "../lib/medicationUnits";
import { normalizeDoseUnit } from "../routines/routineUtils";

export function formatDashboardDate(locale: string, date?: string | null, timezone?: string | null) {
  const safeTimezone = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

  if (!date) {
    return new Intl.DateTimeFormat(locale, {
      day: "numeric",
      month: "long",
      timeZone: safeTimezone,
      year: "numeric",
    }).format(new Date());
  }

  const dashboardMidday = buildManualTakenAt(date, "12:00", safeTimezone);

  return new Intl.DateTimeFormat(locale, {
    day: "numeric",
    month: "long",
    timeZone: safeTimezone,
    year: "numeric",
  }).format(new Date(dashboardMidday ?? `${date}T12:00:00Z`));
}

export function formatMedicationTime(locale: string, isoDateTime?: string | null, timezone?: string) {
  if (!isoDateTime) {
    return "";
  }

  const date = new Date(isoDateTime);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone: timezone,
  }).format(date);
}

export function clampProgressPercent(progressPercent: number) {
  if (!Number.isFinite(progressPercent)) {
    return 0;
  }

  return Math.max(0, Math.min(100, progressPercent));
}

export function canMarkDoseTaken(item: DailyMedicationItem) {
  return (
    item.can_mark_taken &&
    item.allowed_taken_options.length > 0 &&
    item.status !== "taken" &&
    item.status !== "skipped"
  );
}

export function canSkipDose(item: DailyMedicationItem) {
  if (typeof item.can_skip === "boolean") {
    return item.can_skip;
  }

  return item.status === "due" || item.status === "overdue";
}

export function getTreatmentTypeLabelKey(treatmentType: DailyMedicationItem["treatment_type"]) {
  return {
    as_needed: "routines.asNeeded",
    continuous: "routines.continuous",
    temporary: "routines.fixedPeriod",
  }[treatmentType];
}

export function getStatusLabelKey(status: DailyMedicationStatus) {
  return {
    due: "home.dueNow",
    overdue: "home.overdue",
    skipped: "home.skipped",
    taken: "home.taken",
    upcoming: "home.upcoming",
  }[status];
}

export function getTakenModeLabelKey(mode: TakenMode) {
  return {
    manual: "home.fillTimeManually",
    now: "home.now",
    on_time: "home.onTime",
  }[mode];
}

export function getDefaultTakenMode(options: TakenMode[]) {
  return options[0] ?? "now";
}

export function getMedicationDetails(
  t: TFunction,
  item: DailyMedicationItem,
  treatmentLabel: string,
) {
  const eventDose =
    item.dose_quantity == null
      ? null
      : `${item.dose_quantity} ${getMedicationUnitLabel(
          t,
          normalizeDoseUnit(item.dose_unit, item.form),
        )}`.trim();
  return [
    eventDose || item.dosage_text,
    item.phase_title,
    treatmentLabel,
  ]
    .map((value) => value?.trim())
    .filter(Boolean)
    .join(" • ");
}

export function buildManualTakenAt(
  date?: string | null,
  time?: string | null,
  timezone?: string | null,
) {
  if (!date || !time || !timezone) {
    return null;
  }

  const dateMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  const timeMatch = time.match(/^([01]\d|2[0-3]):([0-5]\d)$/);

  if (!dateMatch || !timeMatch) {
    return null;
  }

  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const day = Number(dateMatch[3]);
  const hour = Number(timeMatch[1]);
  const minute = Number(timeMatch[2]);
  const localAsUtc = Date.UTC(year, month - 1, day, hour, minute, 0);
  const firstOffset = getTimeZoneOffsetMillis(new Date(localAsUtc), timezone);
  const resolvedInstant = new Date(localAsUtc - firstOffset);
  const resolvedOffset = getTimeZoneOffsetMillis(resolvedInstant, timezone);

  return `${date}T${time}:00${formatOffset(resolvedOffset)}`;
}

export function isAfterServerNow(isoDateTime: string, serverNow: string) {
  const takenAt = new Date(isoDateTime).getTime();
  const serverTime = new Date(serverNow).getTime();

  if (Number.isNaN(takenAt) || Number.isNaN(serverTime)) {
    return false;
  }

  return takenAt > serverTime;
}

function getTimeZoneOffsetMillis(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    month: "2-digit",
    second: "2-digit",
    timeZone: timezone,
    year: "numeric",
  }).formatToParts(date);
  const partValue = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  const asUtc = Date.UTC(
    partValue("year"),
    partValue("month") - 1,
    partValue("day"),
    partValue("hour"),
    partValue("minute"),
    partValue("second"),
  );

  return asUtc - date.getTime();
}

function formatOffset(offsetMillis: number) {
  const sign = offsetMillis >= 0 ? "+" : "-";
  const absoluteMinutes = Math.abs(Math.round(offsetMillis / 60_000));
  const hours = Math.floor(absoluteMinutes / 60);
  const minutes = absoluteMinutes % 60;

  return `${sign}${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
