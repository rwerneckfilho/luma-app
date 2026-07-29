import type { DailyMedicationDashboard, DailyMedicationItem } from "./types";
import { getNextDailyMedicationTransitionAt, projectDailyMedicationDashboard, projectDailyMedicationItem, projectServerNow } from "./dailyMedicationUtils";

const item: DailyMedicationItem = { allowed_taken_options: [], can_mark_taken: false, event_id: "e", medication_id: "m", medication_name: "M", routine_group_id: "g", routine_id: "r", routine_version: 1, schedule_id: "s", scheduled_for: "2026-07-11T12:00:00Z", status: "upcoming", treatment_type: "continuous" };
const dashboard: DailyMedicationDashboard = { date: "2026-07-11", items: [item], progress_percent: 0, server_now: "2026-07-11T11:59:00Z", timezone: "UTC", total_scheduled: 1, total_taken: 0 };

describe("daily medication clock projection", () => {
  it("crosses upcoming, due and overdue boundaries", () => {
    expect(projectDailyMedicationItem(item, "2026-07-11T11:59:59Z").status).toBe("upcoming");
    expect(projectDailyMedicationItem(item, "2026-07-11T12:00:00Z")).toMatchObject({ status: "due", can_mark_taken: true, can_skip: true });
    expect(projectDailyMedicationItem(item, "2026-07-11T12:10:00.001Z").status).toBe("overdue");
  });
  it("projects the API clock and next transition", () => {
    expect(projectServerNow("2026-07-11T12:00:00Z", 1000, 61000)).toBe("2026-07-11T12:01:00.000Z");
    expect(getNextDailyMedicationTransitionAt(dashboard, dashboard.server_now)).toBe(Date.parse(item.scheduled_for));
    expect(projectDailyMedicationDashboard(dashboard, "2026-07-11T12:00:00Z").items[0].status).toBe("due");
  });
});
