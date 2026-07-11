export type Medication = {
  dosage_text: string | null;
  form: string | null;
  id: string;
  is_archived: boolean;
  medication_reason?: string | null;
  name: string;
  normalized_name: string | null;
  notes: string | null;
  prescribing_doctor_name?: string | null;
  user_id: string;
};

export type MedicationMutationPayload = {
  dosage_text?: string | null;
  form?: string | null;
  medication_reason?: string | null;
  name: string;
  normalized_name?: string | null;
  notes?: string | null;
  prescribing_doctor_name?: string | null;
};

export type MedicationUpdatePayload = Partial<MedicationMutationPayload>;
