/**
 * AI_CONTEXT
 * repo: luma-front-webapp
 * layer: schema
 * domain: medications
 * purpose: Zod schema and payload mapper for medication create/edit forms.
 * entrypoints:
 *   - createMedicationFormSchema
 *   - medicationToFormValues
 *   - toMedicationPayload
 * reads:
 *   - Medication form values
 * mutates:
 *   - none
 * used_by:
 *   - src/medications/MedicationForm.tsx
 *   - src/routines/routineSchema.ts
 * read_first_when:
 *   - Changing medication validation, defaults, or API payload normalization.
 * avoid_reading_when:
 *   - Only changing medication card layout.
 * invariants:
 *   - Empty optional strings become null before API mutation payloads.
 */
import type { TFunction } from "i18next";
import { z } from "zod";
import { emptyToNull } from "../lib/formValues";
import { CUSTOM_MEDICATION_UNIT_VALUE } from "../lib/medicationUnits";
import type { Medication, MedicationMutationPayload } from "./types";

export const createMedicationFormSchema = (t: TFunction) => z.object({
  dosage_text: z.string().trim().optional(),
  form: z.string().trim().optional().refine(
    (value) => value !== CUSTOM_MEDICATION_UNIT_VALUE,
    t("validation.customUnitRequired"),
  ),
  medication_reason: z.string().trim().optional(),
  name: z.string().trim().min(1, t("validation.medicationNameRequired")),
  notes: z.string().trim().optional(),
  prescribing_doctor_name: z.string().trim().optional(),
});

export type MedicationFormValues = z.infer<ReturnType<typeof createMedicationFormSchema>>;

export const emptyMedicationFormValues: MedicationFormValues = {
  dosage_text: "",
  form: "",
  medication_reason: "",
  name: "",
  notes: "",
  prescribing_doctor_name: "",
};

export function normalizeMedicationName(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function medicationToFormValues(medication?: Medication | null): MedicationFormValues {
  return {
    dosage_text: medication?.dosage_text ?? "",
    form: medication?.form ?? "",
    medication_reason: medication?.medication_reason ?? "",
    name: medication?.name ?? "",
    notes: medication?.notes ?? "",
    prescribing_doctor_name: medication?.prescribing_doctor_name ?? "",
  };
}

export function toMedicationPayload(values: MedicationFormValues): MedicationMutationPayload {
  const name = values.name.trim();

  return {
    dosage_text: emptyToNull(values.dosage_text),
    form: emptyToNull(values.form),
    medication_reason: emptyToNull(values.medication_reason),
    name,
    normalized_name: normalizeMedicationName(name),
    notes: emptyToNull(values.notes),
    prescribing_doctor_name: emptyToNull(values.prescribing_doctor_name),
  };
}
