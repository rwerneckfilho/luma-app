import type { TreatmentType } from "../routines/types";

export type DailyMedicationStatus = "upcoming" | "due" | "overdue" | "taken" | "skipped";

export type TakenMode = "on_time" | "now" | "manual";

export type RecordedTakenMode = TakenMode | "provider_reply";

export type DailyMedicationItem = {
  allowed_taken_options: TakenMode[];
  can_skip?: boolean;
  can_mark_taken: boolean;
  dose_quantity?: number | null;
  dose_unit?: string | null;
  dosage_text?: string | null;
  event_id: string;
  form?: string | null;
  medication_id: string;
  medication_name: string;
  phase_order?: number | null;
  phase_title?: string | null;
  routine_group_id: string;
  routine_id: string;
  routine_version: number;
  schedule_id: string;
  scheduled_for: string;
  status: DailyMedicationStatus;
  skipped_at?: string | null;
  taken_at?: string | null;
  taken_mode?: RecordedTakenMode | null;
  recorded_by_display_name?: string | null;
  recorded_by_role?: "patient" | "caregiver" | null;
  recorded_by_user_id?: string | null;
  treatment_type: TreatmentType;
};

export type DailyMedicationDashboard = {
  date: string;
  items: DailyMedicationItem[];
  next_scheduled_for?: string | null;
  progress_percent: number;
  server_now: string;
  timezone: string;
  total_scheduled: number;
  total_taken: number;
};

export type MarkDoseTakenPayload = {
  acknowledge_early?: boolean;
  mode: TakenMode;
  taken_at?: string | null;
};

type BulkMarkDoseTakenBase = {
  client_request_id?: string;
  event_ids: string[];
};

export type BulkMarkDoseTakenPayload = BulkMarkDoseTakenBase & (
  | { mode: "manual"; taken_at: string }
  | { mode: "now" | "on_time"; taken_at?: never }
);

export type BulkMarkDoseTakenStatus =
  | "marked"
  | "already_taken"
  | "already_skipped"
  | "not_due"
  | "not_found";

export type BulkMarkDoseTakenResult = {
  event_id: string;
  item: DailyMedicationItem | null;
  status: BulkMarkDoseTakenStatus;
};

export type BulkMarkDoseTakenResponse = {
  already_taken: number;
  marked: number;
  not_applied: number;
  requested: number;
  results: BulkMarkDoseTakenResult[];
};

export type SkipDosePayload = {
  acknowledge_early?: boolean;
};
