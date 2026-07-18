import type {
  CarePermissionsPayload,
  CarePreferencesPayload,
  CareRelationship,
  CareScopePayload,
} from "../../care/types";

const permissionKeys: (keyof CarePermissionsPayload)[] = [
  "allow_manage_routines",
  "allow_mark_patient_taken",
  "allow_receive_overdue",
  "allow_receive_together",
  "allow_skip_patient_dose",
  "allow_view_timeline",
];

export type CareInviteValidationError = "invalid_valid_until" | "selected_scope_empty";
export type DateRangeValidationError = "end_before_start" | "invalid_end" | "invalid_start";

export class CareAccessRollbackError extends Error {
  readonly originalError: unknown;
  readonly rollbackError: unknown;

  constructor(originalError: unknown, rollbackError: unknown) {
    super("Care access update failed and the previous state could not be restored.");
    this.name = "CareAccessRollbackError";
    this.originalError = originalError;
    this.rollbackError = rollbackError;
  }
}

export function validateCareInvite({
  duration,
  scope,
  today = utcDateKey(),
  validUntil,
}: {
  duration: "indefinite" | "until_date";
  scope: CareScopePayload;
  today?: string;
  validUntil: string;
}): CareInviteValidationError | null {
  if (
    duration === "until_date" &&
    (!isValidDateKey(validUntil) || validUntil < today)
  ) {
    return "invalid_valid_until";
  }

  if (scope.medication_scope === "selected_medications" && scope.medication_ids.length === 0) {
    return "selected_scope_empty";
  }

  return null;
}

export function validateDateRange(
  start: string,
  end: string,
): DateRangeValidationError | null {
  if (!isValidDateKey(start)) return "invalid_start";
  if (!isValidDateKey(end)) return "invalid_end";
  if (end < start) return "end_before_start";
  return null;
}

export function normalizeCareScope(scope: CareScopePayload): CareScopePayload {
  if (scope.medication_scope === "all_medications") {
    return { medication_ids: [], medication_scope: "all_medications" };
  }

  return {
    medication_ids: [...new Set(scope.medication_ids.filter(Boolean))].sort(),
    medication_scope: "selected_medications",
  };
}

export function permissionsFromRelationship(
  relationship: CareRelationship,
): CarePermissionsPayload {
  return {
    allow_manage_routines: relationship.allow_manage_routines,
    allow_mark_patient_taken: relationship.allow_mark_patient_taken,
    allow_receive_overdue: relationship.allow_receive_overdue,
    allow_receive_together: relationship.allow_receive_together,
    allow_skip_patient_dose: relationship.allow_skip_patient_dose,
    allow_view_timeline: relationship.allow_view_timeline,
  };
}

export function isCarePreferenceAllowed(
  preference: CarePreferencesPayload["notification_mode"],
  relationship: Pick<CareRelationship, "allow_receive_overdue" | "allow_receive_together">,
) {
  if (preference === "together") return relationship.allow_receive_together;
  if (preference === "overdue_only") return relationship.allow_receive_overdue;
  return true;
}

export function normalizeCarePreference(
  preference: CarePreferencesPayload["notification_mode"],
  relationship: Pick<CareRelationship, "allow_receive_overdue" | "allow_receive_together">,
): CarePreferencesPayload["notification_mode"] {
  return isCarePreferenceAllowed(preference, relationship) ? preference : "none";
}

export async function persistCareAccess({
  currentPermissions,
  currentScope,
  nextPermissions,
  nextScope,
  updatePermissions,
  updateScope,
}: {
  currentPermissions: CarePermissionsPayload;
  currentScope: CareScopePayload;
  nextPermissions: CarePermissionsPayload;
  nextScope: CareScopePayload;
  updatePermissions: (payload: CarePermissionsPayload) => Promise<unknown>;
  updateScope: (payload: CareScopePayload) => Promise<unknown>;
}) {
  const previousScope = normalizeCareScope(currentScope);
  const normalizedScope = normalizeCareScope(nextScope);
  const permissionsChanged = !permissionKeys.every(
    (key) => currentPermissions[key] === nextPermissions[key],
  );
  const scopeChanged = !sameScope(previousScope, normalizedScope);

  if (normalizedScope.medication_scope === "selected_medications" && normalizedScope.medication_ids.length === 0) {
    throw new Error("selected_scope_empty");
  }

  if (!permissionsChanged && !scopeChanged) return;
  if (!scopeChanged) {
    await updatePermissions(nextPermissions);
    return;
  }
  if (!permissionsChanged) {
    await updateScope(normalizedScope);
    return;
  }

  // Scope is persisted before permission grants so newly enabled capabilities
  // never observe a broader stale scope. If the second request fails, restore
  // the original scope before surfacing the error.
  await updateScope(normalizedScope);
  try {
    await updatePermissions(nextPermissions);
  } catch (error) {
    try {
      await updateScope(previousScope);
    } catch (rollbackError) {
      throw new CareAccessRollbackError(error, rollbackError);
    }
    throw error;
  }
}

function sameScope(left: CareScopePayload, right: CareScopePayload) {
  return (
    left.medication_scope === right.medication_scope &&
    left.medication_ids.length === right.medication_ids.length &&
    left.medication_ids.every((id, index) => id === right.medication_ids[index])
  );
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

function utcDateKey(value = new Date()) {
  return value.toISOString().slice(0, 10);
}
