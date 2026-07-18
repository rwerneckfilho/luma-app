import type { TreatmentType } from "../routines/types";

export type AdherenceHistoryStatus =
  | "scheduled"
  | "upcoming"
  | "due"
  | "overdue"
  | "taken"
  | "skipped";

export type AdherenceHistorySummary = {
  adherence_percent: number;
  total_overdue: number;
  total_scheduled: number;
  total_skipped: number;
  total_taken: number;
  total_taken_late?: number;
};

export type AdherenceHistoryItem = {
  delay_minutes?: number | null;
  dosage_text?: string | null;
  event_id: string;
  form?: string | null;
  medication_id: string;
  medication_name: string;
  prescribing_doctor_name?: string | null;
  recorded_by_display_name?: string | null;
  recorded_by_role?: "patient" | "caregiver" | null;
  recorded_by_user_id?: string | null;
  routine_group_id: string;
  routine_id: string;
  routine_version: number;
  schedule_id: string;
  scheduled_for: string;
  skipped_at?: string | null;
  status: AdherenceHistoryStatus;
  taken_at?: string | null;
  taken_mode?: string | null;
  taken_source?: string | null;
  treatment_type: TreatmentType;
};

export type AdherenceHistory = {
  date_from: string;
  date_to: string;
  items: AdherenceHistoryItem[];
  server_now: string;
  summary: AdherenceHistorySummary;
  timezone: string;
};

export type AdherenceHistoryFilters = {
  date?: string;
  date_from?: string;
  date_to?: string;
  medication_id?: string;
  prescribing_doctor_name?: string;
  status?: AdherenceHistoryStatus;
};

export type AdherenceHistoryFilterOptions = {
  doctors: string[];
  medications: { id: string; name: string }[];
  statuses: AdherenceHistoryStatus[];
};
