export type TreatmentType = "continuous" | "temporary" | "as_needed";
export type RoutineStatus = "draft" | "active" | "paused" | "completed" | "cancelled";
export type ScheduleType = "daily" | "weekly" | "interval" | "custom";
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export type EveryNWeeksCustomRule = {
  anchor_date: string;
  interval_weeks: number;
  kind: "every_n_weeks";
  version: 1;
  weekday: DayOfWeek;
};

export type MonthlyDayCustomRule = {
  anchor_date: string;
  day_of_month: number;
  kind: "monthly_day";
  missing_day_policy: "last_day";
  version: 1;
};

export type CycleActiveWindow = {
  end_day: number;
  start_day: number;
};

export type CycleDaysCustomRule = {
  active_windows: CycleActiveWindow[];
  anchor_date: string;
  cycle_length_days: number;
  kind: "cycle_days";
  version: 1;
};

export type TitrationPhaseSchedule = {
  days_of_week?: DayOfWeek[] | null;
  interval_hours?: number | null;
  schedule_type: "daily" | "weekly" | "interval";
  time_of_day: string;
};

export type TitrationPhase = {
  dose_quantity?: number | null;
  dose_unit?: string | null;
  duration_days?: number | null;
  order: number;
  schedule?: TitrationPhaseSchedule | null;
  title: string;
};

export type TitrationPhasesCustomRule = {
  anchor_date: string;
  kind: "titration_phases";
  phases: TitrationPhase[];
  version: 1;
};

export type CustomScheduleRule =
  | EveryNWeeksCustomRule
  | MonthlyDayCustomRule
  | CycleDaysCustomRule
  | TitrationPhasesCustomRule;

export type AsNeededLimits = {
  behavior: "warn";
  max_dose_quantity_per_period?: number | null;
  max_uses_per_period?: number | null;
  min_interval_minutes?: number | null;
  period_minutes?: number | null;
};

export type SchedulePayload = {
  custom_rule?: CustomScheduleRule | null;
  days_of_week?: DayOfWeek[] | null;
  interval_hours?: number | null;
  is_active?: boolean;
  schedule_type?: ScheduleType;
  time_of_day: string;
};

export type Schedule = {
  custom_rule?: CustomScheduleRule | null;
  days_of_week?: DayOfWeek[] | null;
  id?: string;
  interval_hours?: number | null;
  is_active: boolean;
  medication_routine_id?: string;
  schedule_type: ScheduleType;
  time_of_day: string;
};

export type CreateRoutinePayload = {
  active?: boolean;
  as_needed_limits?: AsNeededLimits | null;
  dose_quantity?: number | null;
  dose_unit?: string | null;
  end_date?: string | null;
  instructions?: string | null;
  medication_id: string;
  schedules?: SchedulePayload[];
  start_date?: string | null;
  status?: RoutineStatus;
  title?: string | null;
  treatment_type?: TreatmentType;
};

export type Routine = {
  active: boolean;
  as_needed_limits?: AsNeededLimits | null;
  dose_quantity?: number | null;
  dose_unit?: string | null;
  end_date?: string | null;
  id: string;
  instructions?: string | null;
  is_current: boolean;
  medication_id: string;
  routine_group_id: string;
  schedules?: Schedule[];
  start_date?: string | null;
  status: RoutineStatus;
  superseded_at?: string | null;
  superseded_by_id?: string | null;
  title?: string | null;
  treatment_type: TreatmentType;
  updated_by_display_name?: string | null;
  updated_by_role?: "caregiver" | null;
  updated_by_user_id?: string | null;
  user_id: string;
  version: number;
};

export type RoutineRevisionPayload = {
  active?: boolean | null;
  as_needed_limits?: AsNeededLimits | null;
  dose_quantity?: number | null;
  dose_unit?: string | null;
  end_date?: string | null;
  instructions?: string | null;
  schedules?: SchedulePayload[] | null;
  start_date?: string | null;
  status?: RoutineStatus | null;
  title?: string | null;
  treatment_type?: TreatmentType | null;
};
