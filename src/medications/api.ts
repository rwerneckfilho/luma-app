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
import { ApiError, apiRequest, requireAccessToken, resolveApiUrl } from "../lib/apiClient";
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

export type MedicationListShare = {
  share_url: string;
  expires_at: string;
  expires_in_seconds: number;
};

export function createMedicationListShare(accessToken: string | null | undefined) {
  return apiRequest<MedicationListShare>("/v1/me/medication-list-shares", {
    accessToken: requireAccessToken(accessToken),
    method: "POST",
  });
}

/** Downloads the authenticated PDF into the app cache using Expo's File API. */
export async function downloadMedicationListPdf(
  accessToken: string | null | undefined,
  destinationUri: string,
) {
  const token = requireAccessToken(accessToken);
  let response: Response;
  try {
    response = await fetch(resolveApiUrl("/v1/me/medication-list.pdf"), {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    throw new ApiError("MEDICATION_LIST_PDF_DOWNLOAD_FAILED", 0);
  }
  if (!response.ok) throw new ApiError("MEDICATION_LIST_PDF_DOWNLOAD_FAILED", response.status);

  const { File } = await import("expo-file-system");
  const file = new File(destinationUri);
  file.create({ overwrite: true });
  file.write(await response.bytes());
  return file.uri;
}
