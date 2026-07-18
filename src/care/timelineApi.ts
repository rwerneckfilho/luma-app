/** API client for caregiver-authorized patient timelines. */
import { apiRequest, requireAccessToken } from "../lib/apiClient";
import type {
  CareTimeline,
  CareTimelineFilterOptions,
  CareTimelineFilters,
} from "./timelineTypes";

function buildTimelineQuery(filters: CareTimelineFilters) {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(filters)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function getCareTimeline(
  accessToken: string | null | undefined,
  relationshipId: string,
  filters: CareTimelineFilters,
) {
  return apiRequest<CareTimeline>(
    `/v1/care/relationships/${relationshipId}/timeline${buildTimelineQuery(filters)}`,
    {
      accessToken: requireAccessToken(accessToken),
      method: "GET",
    },
  );
}

export function getCareTimelineFilters(
  accessToken: string | null | undefined,
  relationshipId: string,
) {
  return apiRequest<CareTimelineFilterOptions>(
    `/v1/care/relationships/${relationshipId}/timeline/filters`,
    {
      accessToken: requireAccessToken(accessToken),
      method: "GET",
    },
  );
}
