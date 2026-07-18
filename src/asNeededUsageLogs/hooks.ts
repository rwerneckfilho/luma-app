import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/useAuth";
import {
  createAsNeededUsageLog,
  getAsNeededUsageLogs,
  previewAsNeededUsageLog,
} from "./api";
import type { AsNeededUsageLogFilters, CreateAsNeededUsageLogPayload } from "./types";

export const asNeededUsageLogsQueryKey = ["as-needed-usage-logs"] as const;
export const asNeededUsageLogsQueryKeyForUser = (
  userId?: string,
  filters: AsNeededUsageLogFilters = {},
) => [...asNeededUsageLogsQueryKey, userId ?? "anonymous", filters] as const;

export function useAsNeededUsageLogs(
  filters: AsNeededUsageLogFilters = {},
  enabled = true,
) {
  const { accessToken, user } = useAuth();

  return useQuery({
    enabled: enabled && Boolean(accessToken) && Boolean(user?.id),
    queryFn: () => getAsNeededUsageLogs(accessToken, filters),
    queryKey: asNeededUsageLogsQueryKeyForUser(user?.id, filters),
  });
}

export function useCreateAsNeededUsageLog() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateAsNeededUsageLogPayload) =>
      createAsNeededUsageLog(accessToken, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: asNeededUsageLogsQueryKey });
    },
  });
}

export function usePreviewAsNeededUsageLog() {
  const { accessToken } = useAuth();
  return useMutation({
    mutationFn: (payload: CreateAsNeededUsageLogPayload) =>
      previewAsNeededUsageLog(accessToken, payload),
  });
}
