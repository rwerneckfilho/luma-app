import type {
  DailyMedicationDashboard,
  DailyMedicationItem,
  DailyMedicationStatus,
} from "../dailyMedications/types";

const SERVER_NOW = "2026-07-18T13:00:00-03:00";
const TIMEZONE = "America/Sao_Paulo";

export function makeDailyMedicationFixture(
  index: number,
  overrides: Partial<DailyMedicationItem> = {},
): DailyMedicationItem {
  const eventSuffix = String(index + 1).padStart(12, "0");
  return {
    allowed_taken_options: ["on_time", "now", "manual"],
    can_mark_taken: true,
    can_skip: true,
    dosage_text: "1 comprimido",
    event_id: `00000000-0000-4000-8000-${eventSuffix}`,
    medication_id: `medication-${index + 1}`,
    medication_name: `Medicamento ${index + 1}`,
    routine_group_id: `routine-group-${index + 1}`,
    routine_id: `routine-${index + 1}`,
    routine_version: 1,
    schedule_id: `schedule-${index + 1}`,
    scheduled_for: `2026-07-18T${String(8 + (index % 5)).padStart(2, "0")}:00:00-03:00`,
    status: index % 2 === 0 ? "overdue" : "due",
    treatment_type: "continuous",
    ...overrides,
  };
}

export function makeBulkHomeFixture(
  count: number,
  status?: DailyMedicationStatus,
): DailyMedicationDashboard {
  const items = Array.from({ length: count }, (_, index) =>
    makeDailyMedicationFixture(index, status ? { status } : {}),
  );
  return {
    date: "2026-07-18",
    items,
    next_scheduled_for: null,
    progress_percent: 0,
    server_now: SERVER_NOW,
    timezone: TIMEZONE,
    total_scheduled: count,
    total_taken: 0,
  };
}

export const homeVisualFixtures = {
  bulkEleven: makeBulkHomeFixture(11),
  bulkOne: makeBulkHomeFixture(1),
  bulkTwentyOne: makeBulkHomeFixture(21),
  bulkTwoHundredFive: makeBulkHomeFixture(205),
  mixed: {
    ...makeBulkHomeFixture(7),
    items: [
      makeDailyMedicationFixture(0, { status: "overdue" }),
      makeDailyMedicationFixture(1, { status: "due" }),
      makeDailyMedicationFixture(2, { status: "upcoming", can_mark_taken: false }),
      makeDailyMedicationFixture(3, { status: "taken", can_mark_taken: false }),
      makeDailyMedicationFixture(4, { status: "skipped", can_mark_taken: false }),
      makeDailyMedicationFixture(5, { treatment_type: "as_needed" }),
      makeDailyMedicationFixture(6, { can_mark_taken: false }),
    ],
  },
} satisfies Record<string, DailyMedicationDashboard>;
