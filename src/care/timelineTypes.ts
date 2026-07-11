import type { AsNeededUsageLog } from "../asNeededUsageLogs/types";
import type {
  AdherenceHistory,
  AdherenceHistoryFilterOptions,
  AdherenceHistoryFilters,
} from "../history/types";

export type CareTimeline = AdherenceHistory & {
  as_needed_usage_logs: AsNeededUsageLog[];
  patient_display_name: string;
};

export type CareTimelineFilters = AdherenceHistoryFilters;
export type CareTimelineFilterOptions = AdherenceHistoryFilterOptions;
