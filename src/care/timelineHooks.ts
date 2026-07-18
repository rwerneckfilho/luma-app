/** React Query hooks for caregiver-authorized patient timelines. */
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/useAuth";
import { getCareTimeline, getCareTimelineFilters } from "./timelineApi";
import type { CareTimelineFilters } from "./timelineTypes";

export const careTimelineQueryKey = (
  relationshipId?: string,
  userId?: string,
  filters?: CareTimelineFilters,
) =>
  [
    "care-timeline",
    userId ?? "anonymous",
    relationshipId ?? "unknown",
    filters?.date ?? "",
    filters?.date_from ?? "",
    filters?.date_to ?? "",
    filters?.medication_id ?? "",
    filters?.prescribing_doctor_name ?? "",
    filters?.status ?? "",
  ] as const;

export function useCareTimeline(
  relationshipId: string,
  filters: CareTimelineFilters,
  enabled = true,
) {
  const { accessToken, user } = useAuth();

  return useQuery({
    enabled: enabled && Boolean(accessToken) && Boolean(user?.id) && Boolean(relationshipId),
    queryFn: () => getCareTimeline(accessToken, relationshipId, filters),
    queryKey: careTimelineQueryKey(relationshipId, user?.id, filters),
  });
}

export function useCareTimelineFilters(relationshipId: string, enabled = true) {
  const { accessToken, user } = useAuth();

  return useQuery({
    enabled: enabled && Boolean(accessToken) && Boolean(user?.id) && Boolean(relationshipId),
    queryFn: () => getCareTimelineFilters(accessToken, relationshipId),
    queryKey: [
      "care-timeline",
      user?.id ?? "anonymous",
      relationshipId || "unknown",
      "filters",
    ] as const,
    retry: false,
  });
}
