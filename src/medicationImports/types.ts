export type MedicationImportWarning = {
  code: string;
  message: string;
};

export type MedicationImportSchedule = {
  custom_rule?: Record<string, unknown> | null;
  days_of_week?: number[] | null;
  dose_quantity?: number | null;
  dose_unit?: string | null;
  interval_hours?: number | null;
  schedule_type: "daily" | "weekly" | "interval" | "custom";
  time_of_day?: string | null;
};

export type MedicationImportItem = {
  confidence: "high" | "medium" | "low";
  medication: {
    display_name: string;
    form?: string | null;
    notes?: string | null;
    strength_text?: string | null;
  };
  missing_fields: string[];
  raw_text?: string | null;
  temporary_id: string;
  usage: {
    as_needed_limits?: Record<string, unknown> | null;
    custom_rule?: Record<string, unknown> | null;
    detected_pattern?: string | null;
    dose_quantity?: number | null;
    dose_unit?: string | null;
    end_date?: string | null;
    instructions?: string | null;
    schedules: MedicationImportSchedule[];
    start_date?: string | null;
    type:
      | "scheduled"
      | "as_needed"
      | "interval"
      | "calendar_recurrence"
      | "cycle"
      | "phased"
      | "unsupported";
  };
  warnings: MedicationImportWarning[];
};

export type MedicationImportDraft = {
  items: MedicationImportItem[];
  source_type: "text" | "image" | "pdf";
};
