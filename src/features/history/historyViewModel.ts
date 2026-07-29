import type { AdherenceHistoryStatus } from "../../history/types";

export type HistoryResourceState = {
  enabled?: boolean;
  isError: boolean;
  isLoading: boolean;
};

export function combineHistoryResources(resources: HistoryResourceState[]) {
  const active = resources.filter((resource) => resource.enabled !== false);
  return {
    isError: active.some((resource) => resource.isError),
    isLoading: active.some((resource) => resource.isLoading),
  };
}

export function historyStatusTone(status: AdherenceHistoryStatus) {
  if (status === "taken") return "success" as const;
  if (status === "overdue" || status === "skipped") return "danger" as const;
  if (status === "due") return "warning" as const;
  return "neutral" as const;
}
