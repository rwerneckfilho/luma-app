/**
 * AI_CONTEXT
 * repo: luma-front-webapp
 * layer: hook
 * domain: adherence-history
 * purpose: React Query hooks for adherence history results and filter options.
 * entrypoints:
 *   - useAdherenceHistory
 *   - useAdherenceHistoryFilters
 * reads:
 *   - /v1/me/adherence-history
 *   - /v1/me/adherence-history/filters
 * mutates:
 *   - React Query history cache only
 * used_by:
 *   - src/history/HistoryPage.tsx
 * read_first_when:
 *   - Changing history filters, query keys, or date range behavior.
 * avoid_reading_when:
 *   - Only changing Home dose action mutations.
 * invariants:
 *   - Filter values are included in the query key to prevent stale history views.
 */
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../auth/useAuth";
import { getAdherenceHistory, getAdherenceHistoryFilters } from "./api";
import type { AdherenceHistoryFilters } from "./types";

export const adherenceHistoryQueryKey = ["adherence-history"] as const;

export const adherenceHistoryQueryKeyForUser = (
  userId?: string,
  filters?: AdherenceHistoryFilters,
) =>
  [
    ...adherenceHistoryQueryKey,
    userId ?? "anonymous",
    filters?.date ?? "",
    filters?.date_from ?? "",
    filters?.date_to ?? "",
    filters?.medication_id ?? "",
    filters?.prescribing_doctor_name ?? "",
    filters?.status ?? "",
  ] as const;

export function useAdherenceHistory(filters: AdherenceHistoryFilters, enabled = true) {
  const { accessToken, user } = useAuth();

  return useQuery({
    enabled: enabled && Boolean(accessToken) && Boolean(user?.id),
    queryFn: () => getAdherenceHistory(accessToken, filters),
    queryKey: adherenceHistoryQueryKeyForUser(user?.id, filters),
  });
}

export function useAdherenceHistoryFilters() {
  const { accessToken, user } = useAuth();

  return useQuery({
    enabled: Boolean(accessToken) && Boolean(user?.id),
    queryFn: () => getAdherenceHistoryFilters(accessToken),
    queryKey: [...adherenceHistoryQueryKey, user?.id ?? "anonymous", "filters"] as const,
    retry: false,
  });
}
