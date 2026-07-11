/**
 * AI_CONTEXT
 * repo: luma-front-webapp
 * layer: api-client
 * domain: care-relationships
 * purpose: luma-core API wrapper for care invitations, relationships, permissions, and scope.
 * entrypoints:
 *   - createCareRelationship
 *   - updateCarePermissions
 *   - updateCaregiverRoutine
 * reads:
 *   - /v1/care/*
 * mutates:
 *   - /v1/care/relationships
 *   - /v1/care/relationships/:id/*
 * used_by:
 *   - src/care/hooks.ts
 * read_first_when:
 *   - Changing caregiver relationship endpoint paths or payloads.
 * avoid_reading_when:
 *   - Only changing settings layout.
 * invariants:
 *   - Every request requires a current Supabase access token.
 */
import { apiRequest, requireAccessToken } from "../lib/apiClient";
import type {
  CareInvitationsList,
  CarePublicUser,
  CareRelationship,
  CareRelationshipCreatePayload,
  CareRelationshipCreateResult,
  CareRelationshipRevokePayload,
  CareRelationshipsList,
  CareRelationshipRoutines,
  CarePermissionsPayload,
  CarePreferencesPayload,
  CareScopePayload,
} from "./types";
import type { Routine, RoutineRevisionPayload } from "../routines/types";

export function lookupCareUserByLumaId(
  accessToken: string | null | undefined,
  lumaId: string,
) {
  /** Look up public confirmation data for a caregiver Luma ID. */
  return apiRequest<CarePublicUser>(`/v1/care/users/by-luma-id/${encodeURIComponent(lumaId)}`, {
    accessToken: requireAccessToken(accessToken),
    method: "GET",
  });
}

export function createCareRelationship(
  accessToken: string | null | undefined,
  payload: CareRelationshipCreatePayload,
) {
  return apiRequest<CareRelationshipCreateResult>("/v1/care/relationships", {
    accessToken: requireAccessToken(accessToken),
    body: payload,
    method: "POST",
  });
}

export function getCareRelationships(accessToken: string | null | undefined) {
  return apiRequest<CareRelationshipsList>("/v1/care/relationships", {
    accessToken: requireAccessToken(accessToken),
    method: "GET",
  });
}

export function getCareInvitations(accessToken: string | null | undefined) {
  return apiRequest<CareInvitationsList>("/v1/care/invitations", {
    accessToken: requireAccessToken(accessToken),
    method: "GET",
  });
}

export function acceptCareInvitation(accessToken: string | null | undefined, invitationId: string) {
  return apiRequest<CareRelationship>(`/v1/care/invitations/${invitationId}/accept`, {
    accessToken: requireAccessToken(accessToken),
    method: "POST",
  });
}

export function declineCareInvitation(accessToken: string | null | undefined, invitationId: string) {
  return apiRequest<CareRelationship>(`/v1/care/invitations/${invitationId}/decline`, {
    accessToken: requireAccessToken(accessToken),
    method: "POST",
  });
}

export function revokeCareRelationship(
  accessToken: string | null | undefined,
  relationshipId: string,
  payload: CareRelationshipRevokePayload,
) {
  return apiRequest<CareRelationship>(`/v1/care/relationships/${relationshipId}/revoke`, {
    accessToken: requireAccessToken(accessToken),
    body: payload,
    method: "POST",
  });
}

export function updateCarePermissions(
  accessToken: string | null | undefined,
  relationshipId: string,
  payload: CarePermissionsPayload,
) {
  /** Persist patient-owned permissions for an accepted caregiver relationship. */
  return apiRequest<CareRelationship>(`/v1/care/relationships/${relationshipId}/permissions`, {
    accessToken: requireAccessToken(accessToken),
    body: payload,
    method: "PUT",
  });
}

export function updateCarePreferences(
  accessToken: string | null | undefined,
  relationshipId: string,
  payload: CarePreferencesPayload,
) {
  return apiRequest<CareRelationship>(`/v1/care/relationships/${relationshipId}/preferences`, {
    accessToken: requireAccessToken(accessToken),
    body: payload,
    method: "PUT",
  });
}

export function updateCareScope(
  accessToken: string | null | undefined,
  relationshipId: string,
  payload: CareScopePayload,
) {
  return apiRequest<CareRelationship>(`/v1/care/relationships/${relationshipId}/scope`, {
    accessToken: requireAccessToken(accessToken),
    body: payload,
    method: "PUT",
  });
}

export function getCareRelationshipRoutines(
  accessToken: string | null | undefined,
  relationshipId: string,
) {
  return apiRequest<CareRelationshipRoutines>(
    `/v1/care/relationships/${relationshipId}/routines`,
    {
      accessToken: requireAccessToken(accessToken),
      method: "GET",
    },
  );
}

export function updateCaregiverRoutine(
  accessToken: string | null | undefined,
  relationshipId: string,
  routineId: string,
  payload: RoutineRevisionPayload,
) {
  /** Create a caregiver-authored routine revision for an authorized patient routine. */
  return apiRequest<Routine>(
    `/v1/care/relationships/${relationshipId}/routines/${routineId}`,
    {
      accessToken: requireAccessToken(accessToken),
      body: payload,
      method: "PUT",
    },
  );
}
