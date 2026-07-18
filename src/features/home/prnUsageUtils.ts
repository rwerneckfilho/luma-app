import type { CreateAsNeededUsageLogPayload } from "../../asNeededUsageLogs/types";
import { buildManualTakenAt, isAfterServerNow } from "../../dailyMedications/dailyMedicationUtils";
import { normalizeDoseUnit } from "../../routines/routineUtils";
import type { Routine } from "../../routines/types";

export type PrnUsageMode = "manual" | "now";
export type PrnUsageValidationError = "future_datetime" | "invalid_datetime" | "invalid_dose";

export type PrnUsagePayloadResult =
  | { error: PrnUsageValidationError; ok: false }
  | { ok: true; payload: CreateAsNeededUsageLogPayload };

export function buildPrnUsagePayload({
  doseInput,
  manualDate,
  manualTime,
  medicationForm,
  mode,
  note,
  now = () => new Date().toISOString(),
  routine,
  serverNow,
  timezone,
}: {
  doseInput: string;
  manualDate: string;
  manualTime: string;
  medicationForm?: string | null;
  mode: PrnUsageMode;
  note: string;
  now?: () => string;
  routine: Routine;
  serverNow?: string;
  timezone?: string;
}): PrnUsagePayloadResult {
  const currentTime = now();
  let usedAt = currentTime;

  if (mode === "manual") {
    const manualUsedAt = buildManualTakenAt(manualDate, manualTime, timezone);
    if (!manualUsedAt) return { error: "invalid_datetime", ok: false };
    if (isAfterServerNow(manualUsedAt, serverNow ?? currentTime)) {
      return { error: "future_datetime", ok: false };
    }
    usedAt = manualUsedAt;
  }

  const doseQuantity = parseDoseQuantity(doseInput, routine.dose_quantity);
  if (doseQuantity === undefined) return { error: "invalid_dose", ok: false };

  return {
    ok: true,
    payload: {
      dose_quantity: doseQuantity,
      dose_unit: normalizeDoseUnit(routine.dose_unit, medicationForm) || null,
      note: note.trim() || null,
      routine_id: routine.id,
      used_at: usedAt,
    },
  };
}

function parseDoseQuantity(value: string, fallback?: number | null) {
  const normalized = value.trim().replace(",", ".");
  const candidate = normalized ? Number(normalized) : fallback ?? null;
  if (candidate === null) return null;
  if (!Number.isFinite(candidate) || candidate <= 0) return undefined;
  return candidate;
}
