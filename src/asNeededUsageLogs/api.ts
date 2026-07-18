import { apiRequest, requireAccessToken } from "../lib/apiClient";
import type {
  AsNeededUsageLog,
  AsNeededUsageLogFilters,
  AsNeededUsagePreview,
  CreateAsNeededUsageLogPayload,
} from "./types";

export function createAsNeededUsageLog(
  accessToken: string | null | undefined,
  payload: CreateAsNeededUsageLogPayload,
) {
  return apiRequest<AsNeededUsageLog>("/v1/as-needed-usage-logs", {
    accessToken: requireAccessToken(accessToken),
    body: payload,
    method: "POST",
  });
}

export function previewAsNeededUsageLog(
  accessToken: string | null | undefined,
  payload: CreateAsNeededUsageLogPayload,
) {
  return apiRequest<AsNeededUsagePreview>("/v1/as-needed-usage-logs/preview", {
    accessToken: requireAccessToken(accessToken),
    body: payload,
    method: "POST",
  });
}

export function getAsNeededUsageLogs(
  accessToken: string | null | undefined,
  filters: AsNeededUsageLogFilters = {},
) {
  const searchParams = new URLSearchParams();

  if (filters.routine_id) {
    searchParams.set("routine_id", filters.routine_id);
  }
  if (filters.medication_id) {
    searchParams.set("medication_id", filters.medication_id);
  }
  if (filters.date_from) {
    searchParams.set("date_from", filters.date_from);
  }
  if (filters.date_to) {
    searchParams.set("date_to", filters.date_to);
  }
  if (filters.limit) {
    searchParams.set("limit", String(filters.limit));
  }

  const query = searchParams.toString();

  return apiRequest<AsNeededUsageLog[]>(
    `/v1/as-needed-usage-logs${query ? `?${query}` : ""}`,
    {
      accessToken: requireAccessToken(accessToken),
      method: "GET",
    },
  );
}
