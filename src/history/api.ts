/**
 * AI_CONTEXT
 * repo: luma-front-webapp
 * layer: api-client
 * domain: adherence-history
 * purpose: luma-core API wrapper for adherence history and filter options.
 * entrypoints:
 *   - getAdherenceHistory
 *   - getAdherenceHistoryFilters
 * reads:
 *   - /v1/me/adherence-history
 *   - /v1/me/adherence-history/filters
 * mutates:
 *   - none
 * used_by:
 *   - src/history/hooks.ts
 * read_first_when:
 *   - Changing history query parameters or response contracts.
 * avoid_reading_when:
 *   - Only changing history card styling.
 * invariants:
 *   - Filter query params must stay compatible with luma-core history filters.
 */
import { apiRequest, requireAccessToken } from "../lib/apiClient";
import type {
  AdherenceHistory,
  AdherenceHistoryFilterOptions,
  AdherenceHistoryFilters,
} from "./types";

function buildHistoryQuery(filters: AdherenceHistoryFilters) {
  const searchParams = new URLSearchParams();

  if (filters.date) {
    searchParams.set("date", filters.date);
  }

  if (filters.date_from) {
    searchParams.set("date_from", filters.date_from);
  }

  if (filters.date_to) {
    searchParams.set("date_to", filters.date_to);
  }

  if (filters.medication_id) {
    searchParams.set("medication_id", filters.medication_id);
  }

  if (filters.prescribing_doctor_name) {
    searchParams.set("prescribing_doctor_name", filters.prescribing_doctor_name);
  }

  if (filters.status) {
    searchParams.set("status", filters.status);
  }

  const query = searchParams.toString();
  return query ? `?${query}` : "";
}

export function getAdherenceHistory(
  accessToken: string | null | undefined,
  filters: AdherenceHistoryFilters,
) {
  return apiRequest<AdherenceHistory>(`/v1/me/adherence-history${buildHistoryQuery(filters)}`, {
    accessToken: requireAccessToken(accessToken),
    method: "GET",
  });
}

export function getAdherenceHistoryFilters(accessToken: string | null | undefined) {
  return apiRequest<AdherenceHistoryFilterOptions>("/v1/me/adherence-history/filters", {
    accessToken: requireAccessToken(accessToken),
    method: "GET",
  });
}
