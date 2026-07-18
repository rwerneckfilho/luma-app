export type AsNeededUsageLog = {
  created_at: string;
  dose_quantity?: number | null;
  dose_unit?: string | null;
  id: string;
  medication_id: string;
  medication_name: string;
  note?: string | null;
  routine_id: string;
  used_at: string;
};

export type CreateAsNeededUsageLogPayload = {
  acknowledge_warnings?: boolean;
  dose_quantity?: number | null;
  dose_unit?: string | null;
  note?: string | null;
  routine_id: string;
  used_at: string;
};

export type AsNeededLimitWarning = {
  code: "min_interval" | "max_uses" | "max_dose_quantity";
  current_value: number;
  last_used_at?: string | null;
  limit: number;
  period_minutes?: number | null;
  projected_value: number;
};

export type AsNeededUsagePreview = {
  requires_confirmation: boolean;
  warnings: AsNeededLimitWarning[];
};

export type AsNeededUsageLogFilters = {
  date_from?: string;
  date_to?: string;
  limit?: number;
  medication_id?: string;
  routine_id?: string;
};
