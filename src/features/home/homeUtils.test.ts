import type { DailyMedicationItem } from "../../dailyMedications/types";
import { findHomeMedicationAccordion, getDateInTimeZone, getNotificationEventId, groupHomeMedicationItems } from "./homeUtils";

const item = (event_id: string, scheduled_for: string, status: DailyMedicationItem["status"]): DailyMedicationItem => ({
  allowed_taken_options: [], can_mark_taken: false, event_id, medication_id: "m", medication_name: "M",
  routine_group_id: "g", routine_id: "r", routine_version: 1, schedule_id: "s", scheduled_for, status,
  treatment_type: "continuous",
});

describe("home helpers", () => {
  it("resolves notification targets to their accordion", () => {
    const groups = groupHomeMedicationItems([
      item("now", "2026-07-11T12:00:00Z", "due"), item("done", "2026-07-11T11:00:00Z", "taken"),
      item("later", "2026-07-11T14:00:00Z", "upcoming"),
    ], "2026-07-11T12:00:00Z");
    expect(findHomeMedicationAccordion(groups, "now")).toBe("attention");
    expect(findHomeMedicationAccordion(groups, "done")).toBe("completed");
    expect(findHomeMedicationAccordion(groups, "later")).toBe("upcoming");
  });

  it("normalizes route params and dates in the dashboard timezone", () => {
    expect(getNotificationEventId([" dose-1 ", "ignored"])).toBe("dose-1");
    expect(getNotificationEventId("  ")).toBeNull();
    expect(getDateInTimeZone("America/Sao_Paulo", new Date("2026-07-12T01:00:00Z"))).toBe("2026-07-11");
  });
});
