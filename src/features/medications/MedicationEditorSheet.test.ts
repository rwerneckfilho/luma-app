/* eslint-disable import/first -- Jest must register the virtual native module before imports. */
jest.mock("expo-document-picker", () => ({}), { virtual: true });

import { medicationImportMimeType } from "../imports/MedicationImportSheet";
import type { MedicationImportItem } from "../../medicationImports/types";
import type { CreateRoutinePayload, Routine } from "../../routines/types";
import {
  medicationImportItemToFormValues,
  normalizeImportedTime,
  persistRoutinePayloads,
  type RoutineSaveCheckpoint,
} from "./MedicationEditorSheet";

function importItem(overrides: Partial<MedicationImportItem["usage"]>): MedicationImportItem {
  return {
    confidence: "high",
    medication: { display_name: "Medicamento", form: "tablet" },
    missing_fields: [],
    temporary_id: "draft-1",
    usage: {
      schedules: [],
      type: "scheduled",
      ...overrides,
    },
    warnings: [],
  };
}

function routine(id: string): Routine {
  return {
    active: true,
    id,
    is_current: true,
    medication_id: "med-1",
    routine_group_id: `group-${id}`,
    status: "active",
    treatment_type: "continuous",
    user_id: "user-1",
    version: 1,
  };
}

function payload(title: string): CreateRoutinePayload {
  return {
    active: true,
    medication_id: "med-1",
    schedules: [{ is_active: true, schedule_type: "daily", time_of_day: "08:00" }],
    status: "active",
    title,
    treatment_type: "continuous",
  };
}

describe("medication AI import mapping", () => {
  it("normalizes supported clock strings without inventing missing times", () => {
    expect(normalizeImportedTime("8:05")).toBe("08:05");
    expect(normalizeImportedTime("18:30:00")).toBe("18:30");
    expect(normalizeImportedTime(null)).toBe("");
    expect(normalizeImportedTime("25:00")).toBe("");
  });

  it("preserves a monthly custom rule and its dose slot", () => {
    const values = medicationImportItemToFormValues(importItem({
      schedules: [{
        custom_rule: {
          anchor_date: "2026-07-15",
          day_of_month: 15,
          kind: "monthly_day",
          missing_day_policy: "last_day",
          version: 1,
        },
        dose_quantity: 2,
        dose_unit: "tablet",
        schedule_type: "custom",
        time_of_day: "18:30:00",
      }],
      type: "calendar_recurrence",
    }));

    expect(values.schedule_type).toBe("custom");
    expect(values.custom_kind).toBe("monthly_day");
    expect(values.custom_anchor_date).toBe("2026-07-15");
    expect(values.custom_day_of_month).toBe(15);
    expect(values.scheduled_doses).toEqual([
      { dose_quantity: "2", dose_unit: "tablet", time_of_day: "18:30" },
    ]);
  });

  it("preserves structured as-needed limits", () => {
    const values = medicationImportItemToFormValues(importItem({
      as_needed_limits: {
        behavior: "warn",
        max_dose_quantity_per_period: 4,
        max_uses_per_period: 3,
        min_interval_minutes: 360,
        period_minutes: 1440,
      },
      dose_quantity: 1,
      type: "as_needed",
    }));

    expect(values.as_needed_max_dose_quantity).toBe(4);
    expect(values.as_needed_max_uses).toBe(3);
    expect(values.as_needed_min_interval_hours).toBe(6);
    expect(values.as_needed_period_hours).toBe(24);
  });

  it("combines phased custom-rule slots without losing their dose times", () => {
    const phaseRule = (time: string, dose: number) => ({
      anchor_date: "2026-07-01",
      kind: "titration_phases",
      phases: [
        {
          dose_quantity: dose,
          dose_unit: "tablet",
          duration_days: 7,
          order: 1,
          schedule: { schedule_type: "daily", time_of_day: time },
          title: "Semana 1",
        },
        {
          dose_quantity: dose + 1,
          dose_unit: "tablet",
          duration_days: null,
          order: 2,
          schedule: { schedule_type: "daily", time_of_day: time },
          title: "Depois",
        },
      ],
      version: 1,
    });
    const values = medicationImportItemToFormValues(importItem({
      schedules: [
        { custom_rule: phaseRule("08:00:00", 1), schedule_type: "custom", time_of_day: "08:00" },
        { custom_rule: phaseRule("20:00:00", 2), schedule_type: "custom", time_of_day: "20:00" },
      ],
      type: "phased",
    }));

    expect(values.custom_kind).toBe("titration_phases");
    expect(values.custom_anchor_date).toBe("2026-07-01");
    expect(values.titration_phases[0].doses).toEqual([
      { dose_quantity: "1", dose_unit: "tablet", time_of_day: "08:00" },
      { dose_quantity: "2", dose_unit: "tablet", time_of_day: "20:00" },
    ]);
    expect(values.titration_phases[1].duration_days).toBeUndefined();
  });

  it("keeps an absent scheduled time empty so review validation blocks invented reminders", () => {
    const values = medicationImportItemToFormValues(importItem({
      dose_quantity: 1,
      schedules: [{ dose_quantity: 1, schedule_type: "daily", time_of_day: null }],
    }));

    expect(values.scheduled_doses[0].time_of_day).toBe("");
  });

  it("does not invent a repeat interval when the draft omits it", () => {
    const values = medicationImportItemToFormValues(importItem({
      dose_quantity: 1,
      schedules: [{ dose_quantity: 1, interval_hours: null, schedule_type: "interval", time_of_day: "08:00" }],
      type: "interval",
    }));

    expect(values.schedule_type).toBe("interval");
    expect(values.interval_hours).toBeUndefined();
  });
});

describe("resumable routine persistence", () => {
  it("resumes after a partial failure without recreating completed routines", async () => {
    const checkpoint: RoutineSaveCheckpoint = { routines: new Map() };
    const create = jest
      .fn<Promise<Routine>, [CreateRoutinePayload]>()
      .mockResolvedValueOnce(routine("routine-a"))
      .mockRejectedValueOnce(new Error("network"));
    const operations = {
      cancel: jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined),
      create,
      revise: jest.fn<Promise<Routine>, [string, object]>().mockResolvedValue(routine("revised")),
    };
    const payloads = [payload("A"), payload("B")];

    await expect(persistRoutinePayloads(payloads, checkpoint, operations)).rejects.toThrow("network");
    expect(checkpoint.routines.get(0)?.routine.id).toBe("routine-a");

    create.mockResolvedValueOnce(routine("routine-b"));
    await persistRoutinePayloads(payloads, checkpoint, operations);

    expect(create).toHaveBeenCalledTimes(3);
    expect(create.mock.calls.filter(([item]) => item.title === "A")).toHaveLength(1);
    expect(checkpoint.routines.get(1)?.routine.id).toBe("routine-b");
  });

  it("revises changed slots and cancels slots removed before retry", async () => {
    const checkpoint: RoutineSaveCheckpoint = { routines: new Map() };
    const operations = {
      cancel: jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined),
      create: jest.fn<Promise<Routine>, [CreateRoutinePayload]>()
        .mockResolvedValueOnce(routine("routine-a"))
        .mockResolvedValueOnce(routine("routine-b")),
      revise: jest.fn<Promise<Routine>, [string, object]>().mockResolvedValue(routine("routine-a-v2")),
    };
    await persistRoutinePayloads([payload("A"), payload("B")], checkpoint, operations);

    await persistRoutinePayloads([payload("A changed")], checkpoint, operations);

    expect(operations.revise).toHaveBeenCalledWith(
      "routine-a",
      expect.objectContaining({ title: "A changed" }),
    );
    expect(operations.cancel).toHaveBeenCalledWith("routine-b");
    expect(checkpoint.routines.size).toBe(1);
  });
});

describe("medication import MIME inference", () => {
  it("uses a supported extension when Android omits MIME metadata", () => {
    expect(medicationImportMimeType("receita.PDF", null)).toBe("application/pdf");
    expect(medicationImportMimeType("foto.jpg", undefined)).toBe("image/jpeg");
    expect(medicationImportMimeType("foto.jpg", "image/jpg")).toBe("image/jpeg");
  });
});
