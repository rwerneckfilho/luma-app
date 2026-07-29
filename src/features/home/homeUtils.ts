import type { DailyMedicationItem } from "../../dailyMedications/types";

const CURRENT_WINDOW_BEFORE_MINUTES = 40;
const CURRENT_WINDOW_AFTER_MINUTES = 10;

export type HomeMedicationGroups = {
  completed: DailyMedicationItem[];
  current: DailyMedicationItem[];
  earlierPending: DailyMedicationItem[];
  upcoming: DailyMedicationItem[];
};

export type HomeMedicationAccordion = "attention" | "completed" | "upcoming";

export function getNotificationEventId(value?: string | string[]) {
  const eventId = (Array.isArray(value) ? value[0] : value)?.trim();
  return eventId || null;
}

export function findHomeMedicationAccordion(groups: HomeMedicationGroups, eventId: string) {
  if ([...groups.earlierPending, ...groups.current].some((item) => item.event_id === eventId)) return "attention";
  if (groups.completed.some((item) => item.event_id === eventId)) return "completed";
  if (groups.upcoming.some((item) => item.event_id === eventId)) return "upcoming";
  return null;
}

export function getDateInTimeZone(timezone: string, instant: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit", month: "2-digit", timeZone: timezone, year: "numeric",
  }).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function getGreetingKey(date = new Date()) {
  const hour = date.getHours();
  if (hour < 12) return "home.greeting.morning";
  if (hour < 18) return "home.greeting.afternoon";
  return "home.greeting.evening";
}

export function groupHomeMedicationItems(
  items: DailyMedicationItem[],
  serverNow: string,
): HomeMedicationGroups {
  const groups: HomeMedicationGroups = {
    completed: [],
    current: [],
    earlierPending: [],
    upcoming: [],
  };
  const now = new Date(serverNow).getTime();
  const hasValidNow = Number.isFinite(now);
  const currentWindowStart = now - CURRENT_WINDOW_BEFORE_MINUTES * 60_000;
  const currentWindowEnd = now + CURRENT_WINDOW_AFTER_MINUTES * 60_000;

  items.forEach((item) => {
    if (item.status === "taken" || item.status === "skipped") {
      groups.completed.push(item);
      return;
    }

    const scheduledFor = new Date(item.scheduled_for).getTime();
    if (!hasValidNow || !Number.isFinite(scheduledFor)) {
      groups[item.status === "upcoming" ? "upcoming" : "current"].push(item);
    } else if (scheduledFor > currentWindowEnd) {
      groups.upcoming.push(item);
    } else if (scheduledFor < currentWindowStart) {
      groups.earlierPending.push(item);
    } else {
      groups.current.push(item);
    }
  });

  return groups;
}
