/**
 * AI_CONTEXT
 * repo: luma-front-webapp
 * layer: api-client
 * domain: medications
 * purpose: luma-core API wrapper for medication list, create, update, and archive.
 * entrypoints:
 *   - getMedications
 *   - createMedication
 *   - updateMedication
 *   - deleteMedication
 * reads:
 *   - /v1/medications
 * mutates:
 *   - /v1/medications
 *   - /v1/medications/:id
 * used_by:
 *   - src/medications/hooks.ts
 * read_first_when:
 *   - Changing medication endpoint paths or payloads.
 * avoid_reading_when:
 *   - Only changing medication card presentation.
 * invariants:
 *   - Delete calls archive medication records through luma-core.
 */
import { apiRequest, requireAccessToken } from "../lib/apiClient";
import { unwrapItems } from "../lib/apiResponse";
import type { Medication, MedicationMutationPayload, MedicationUpdatePayload } from "./types";

export async function listMedications(accessToken: string | null | undefined) {
  const response = await apiRequest<unknown>("/v1/medications", {
    accessToken: requireAccessToken(accessToken),
    method: "GET",
  });

  return unwrapItems<Medication>(response);
}

export function createMedication(
  accessToken: string | null | undefined,
  payload: MedicationMutationPayload,
) {
  return apiRequest<Medication>("/v1/medications", {
    accessToken: requireAccessToken(accessToken),
    body: payload,
    method: "POST",
  });
}

export function updateMedication(
  accessToken: string | null | undefined,
  medicationId: string,
  payload: MedicationUpdatePayload,
) {
  return apiRequest<Medication>(`/v1/medications/${medicationId}`, {
    accessToken: requireAccessToken(accessToken),
    body: payload,
    method: "PATCH",
  });
}

export function deleteMedication(accessToken: string | null | undefined, medicationId: string) {
  return apiRequest<void>(`/v1/medications/${medicationId}`, {
    accessToken: requireAccessToken(accessToken),
    method: "DELETE",
  });
}
