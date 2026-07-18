import type { TFunction } from "i18next";

export const CUSTOM_MEDICATION_UNIT_VALUE = "__custom_unit__";

export const medicationUnitOptions = [
  { labelKey: "addMedication.unitOptions.tablet", value: "tablet" },
  { labelKey: "addMedication.unitOptions.capsule", value: "capsule" },
  { labelKey: "addMedication.unitOptions.drops", value: "drops" },
  { labelKey: "addMedication.unitOptions.injection", value: "injection" },
  { labelKey: "addMedication.unitOptions.syrup", value: "syrup" },
  { labelKey: "addMedication.unitOptions.mg", value: "mg" },
  { labelKey: "addMedication.unitOptions.ml", value: "ml" },
  { labelKey: "addMedication.unitOptions.unit", value: "unit" },
  { labelKey: "addMedication.unitOptions.puff", value: "puff" },
] as const;

export type MedicationUnitOption = (typeof medicationUnitOptions)[number];
export type StandardMedicationUnit = MedicationUnitOption["value"];

export function isStandardMedicationUnit(unit?: string | null): unit is StandardMedicationUnit {
  const trimmedUnit = unit?.trim();
  return medicationUnitOptions.some((option) => option.value === trimmedUnit);
}

export function getMedicationUnitLabel(t: TFunction, unit?: string | null) {
  const trimmedUnit = unit?.trim() ?? "";

  if (!trimmedUnit || trimmedUnit === CUSTOM_MEDICATION_UNIT_VALUE) {
    return "";
  }

  const option = medicationUnitOptions.find((item) => item.value === trimmedUnit);
  return option ? t(option.labelKey) : trimmedUnit;
}
