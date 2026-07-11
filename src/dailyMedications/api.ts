/**
 * AI_CONTEXT
 * repo: luma-front-webapp
 * layer: api-client
 * domain: daily-medications
 * purpose: luma-core API wrapper for Home dashboard and dose state transitions.
 * entrypoints:
 *   - getDailyMedications
 *   - markDoseTaken
 *   - skipDose
 * reads:
 *   - /v1/me/daily-medications
 * mutates:
 *   - /v1/me/daily-medications/:eventId/taken
 *   - /v1/me/daily-medications/:eventId/skipped
 * used_by:
 *   - src/dailyMedications/hooks.ts
 * read_first_when:
 *   - Changing Home dashboard endpoint paths or taken/skipped payloads.
 * avoid_reading_when:
 *   - Only changing Home card styling.
 * invariants:
 *   - All requests require a current Supabase access token.
 */
import { apiRequest, requireAccessToken } from "../lib/apiClient";
import type {
  DailyMedicationDashboard,
  MarkDoseTakenPayload,
  SkipDosePayload,
} from "./types";

export function getDailyMedications(
  accessToken: string | null | undefined,
  date?: string,
) {
  const searchParams = new URLSearchParams();

  if (date) {
    searchParams.set("date", date);
  }

  const query = searchParams.toString();

  return apiRequest<DailyMedicationDashboard>(
    `/v1/me/daily-medications${query ? `?${query}` : ""}`,
    {
      accessToken: requireAccessToken(accessToken),
      method: "GET",
    },
  );
}

export function markDoseTaken(
  accessToken: string | null | undefined,
  eventId: string,
  payload: MarkDoseTakenPayload,
) {
  return apiRequest<unknown>(`/v1/me/daily-medications/${eventId}/taken`, {
    accessToken: requireAccessToken(accessToken),
    body: payload,
    method: "POST",
  });
}

export function skipDose(
  accessToken: string | null | undefined,
  eventId: string,
  payload?: SkipDosePayload,
) {
  return apiRequest<unknown>(`/v1/me/daily-medications/${eventId}/skipped`, {
    accessToken: requireAccessToken(accessToken),
    body: payload,
    method: "POST",
  });
}
