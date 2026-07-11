import type { CarePermissionsPayload, CareScopePayload } from "../../care/types";
import {
  normalizeCarePreference,
  normalizeCareScope,
  persistCareAccess,
  validateCareInvite,
  validateDateRange,
} from "./careFormUtils";

const permissions: CarePermissionsPayload = {
  allow_manage_routines: false,
  allow_mark_patient_taken: false,
  allow_receive_overdue: false,
  allow_receive_together: false,
  allow_skip_patient_dose: false,
  allow_view_timeline: false,
};

describe("care form validation", () => {
  it("rejects missing, invalid, and past invite end dates", () => {
    const scope: CareScopePayload = {
      medication_ids: [],
      medication_scope: "all_medications",
    };

    expect(validateCareInvite({ duration: "until_date", scope, today: "2026-07-11", validUntil: "" })).toBe("invalid_valid_until");
    expect(validateCareInvite({ duration: "until_date", scope, today: "2026-07-11", validUntil: "2026-02-30" })).toBe("invalid_valid_until");
    expect(validateCareInvite({ duration: "until_date", scope, today: "2026-07-11", validUntil: "2026-07-10" })).toBe("invalid_valid_until");
    expect(validateCareInvite({ duration: "until_date", scope, today: "2026-07-11", validUntil: "2026-07-11" })).toBeNull();
  });

  it("rejects an empty selected-medication scope and clears ids for all medications", () => {
    expect(validateCareInvite({
      duration: "indefinite",
      scope: { medication_ids: [], medication_scope: "selected_medications" },
      validUntil: "",
    })).toBe("selected_scope_empty");
    expect(normalizeCareScope({
      medication_ids: ["medication-1"],
      medication_scope: "all_medications",
    })).toEqual({ medication_ids: [], medication_scope: "all_medications" });
  });

  it("validates custom timeline ranges before querying", () => {
    expect(validateDateRange("2026-07-11", "2026-07-10")).toBe("end_before_start");
    expect(validateDateRange("", "2026-07-11")).toBe("invalid_start");
    expect(validateDateRange("2026-07-01", "2026-07-11")).toBeNull();
  });
});

describe("care access persistence", () => {
  it("restores the previous scope when the permissions request fails", async () => {
    const calls: string[] = [];
    const currentScope: CareScopePayload = {
      medication_ids: [],
      medication_scope: "all_medications",
    };
    const nextScope: CareScopePayload = {
      medication_ids: ["medication-1"],
      medication_scope: "selected_medications",
    };
    const updateScope = jest.fn(async (payload: CareScopePayload) => {
      calls.push(`scope:${payload.medication_scope}`);
    });
    const updatePermissions = jest.fn(async () => {
      calls.push("permissions");
      throw new Error("permission update failed");
    });

    await expect(persistCareAccess({
      currentPermissions: permissions,
      currentScope,
      nextPermissions: { ...permissions, allow_view_timeline: true },
      nextScope,
      updatePermissions,
      updateScope,
    })).rejects.toThrow("permission update failed");
    expect(calls).toEqual([
      "scope:selected_medications",
      "permissions",
      "scope:all_medications",
    ]);
  });

  it("never sends an unauthorized caregiver notification preference", () => {
    const relationship = {
      allow_receive_overdue: true,
      allow_receive_together: false,
    };
    expect(normalizeCarePreference("together", relationship)).toBe("none");
    expect(normalizeCarePreference("overdue_only", relationship)).toBe("overdue_only");
  });
});
