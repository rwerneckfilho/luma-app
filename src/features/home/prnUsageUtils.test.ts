import type { Routine } from "../../routines/types";
import { buildPrnUsagePayload } from "./prnUsageUtils";

function routine(overrides: Partial<Routine> = {}): Routine {
  return {
    active: true,
    as_needed_limits: null,
    created_at: "2026-07-01T00:00:00Z",
    dose_quantity: 1,
    dose_unit: null,
    end_date: null,
    id: "routine-1",
    instructions: null,
    is_current: true,
    medication_id: "medication-1",
    routine_group_id: "routine-group-1",
    start_date: "2026-07-01",
    status: "active",
    title: null,
    treatment_type: "as_needed",
    updated_at: "2026-07-01T00:00:00Z",
    user_id: "user-1",
    version: 1,
    ...overrides,
  } as Routine;
}

describe("buildPrnUsagePayload", () => {
  it("uses the submission instant for now mode and falls back to the medication form", () => {
    const result = buildPrnUsagePayload({
      doseInput: "1,5",
      manualDate: "",
      manualTime: "",
      medicationForm: "comprimido",
      mode: "now",
      note: "  Dor  ",
      now: () => "2026-07-11T15:30:00.000Z",
      routine: routine(),
      serverNow: "2026-07-11T15:29:58.000Z",
      timezone: "America/Sao_Paulo",
    });

    expect(result).toEqual({
      ok: true,
      payload: {
        dose_quantity: 1.5,
        dose_unit: "comprimido",
        note: "Dor",
        routine_id: "routine-1",
        used_at: "2026-07-11T15:30:00.000Z",
      },
    });
  });

  it("builds an offset-aware manual timestamp in the dashboard timezone", () => {
    const result = buildPrnUsagePayload({
      doseInput: "",
      manualDate: "2026-07-11",
      manualTime: "10:15",
      medicationForm: "comprimido",
      mode: "manual",
      note: "",
      now: () => "2026-07-11T15:00:00.000Z",
      routine: routine(),
      serverNow: "2026-07-11T15:00:00.000Z",
      timezone: "America/Sao_Paulo",
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.payload.used_at).toBe("2026-07-11T10:15:00-03:00");
  });

  it("rejects malformed/future manual values and non-positive or non-finite doses", () => {
    expect(buildPrnUsagePayload({
      doseInput: "1",
      manualDate: "2026-07-11",
      manualTime: "99:00",
      mode: "manual",
      note: "",
      routine: routine(),
      serverNow: "2026-07-11T15:00:00.000Z",
      timezone: "America/Sao_Paulo",
    })).toEqual({ error: "invalid_datetime", ok: false });

    expect(buildPrnUsagePayload({
      doseInput: "1",
      manualDate: "2026-07-11",
      manualTime: "13:00",
      mode: "manual",
      note: "",
      routine: routine(),
      serverNow: "2026-07-11T15:00:00.000Z",
      timezone: "America/Sao_Paulo",
    })).toEqual({ error: "future_datetime", ok: false });

    for (const doseInput of ["0", "-1", "1e309", "not-a-number"]) {
      expect(buildPrnUsagePayload({
        doseInput,
        manualDate: "",
        manualTime: "",
        mode: "now",
        note: "",
        routine: routine(),
      })).toEqual({ error: "invalid_dose", ok: false });
    }
  });
});
