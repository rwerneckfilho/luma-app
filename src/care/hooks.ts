/**
 * AI_CONTEXT
 * repo: luma-front-webapp
 * layer: hook
 * domain: care-relationships
 * purpose: React Query hooks for caregiver relationships, invitations, scope, and routine edits.
 * entrypoints:
 *   - useCareRelationships
 *   - useUpdateCarePermissions
 *   - useUpdateCaregiverRoutine
 * reads:
 *   - care relationship query keys
 * mutates:
 *   - care relationship caches
 *   - care relationship routines cache
 * used_by:
 *   - src/settings/SettingsPage.tsx
 * read_first_when:
 *   - Debugging caregiver settings cache behavior or mutations.
 * avoid_reading_when:
 *   - Only changing backend care authorization.
 * invariants:
 *   - Mutations must invalidate relationship/invitation data that can become stale.
 */
import { type QueryClient, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/useAuth";
import {
  acceptCareInvitation,
  createCareRelationship,
  declineCareInvitation,
  getCareRelationshipRoutines,
  getCareInvitations,
  getCareRelationships,
  lookupCareUserByLumaId,
  revokeCareRelationship,
  updateCaregiverRoutine,
  updateCarePermissions,
  updateCarePreferences,
  updateCareScope,
} from "./api";
import type {
  CareRelationshipCreatePayload,
  CareRelationshipRevokePayload,
  CarePermissionsPayload,
  CarePreferencesPayload,
  CareScopePayload,
} from "./types";
import type { RoutineRevisionPayload } from "../routines/types";

export const careRelationshipsQueryKey = ["care-relationships"] as const;
export const careInvitationsQueryKey = ["care-invitations"] as const;
export const careRelationshipRoutinesQueryKey = (relationshipId?: string, userId?: string) =>
  ["care-relationship-routines", userId ?? "anonymous", relationshipId ?? "unknown"] as const;

function invalidateCareQueries(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: careRelationshipsQueryKey });
  void queryClient.invalidateQueries({ queryKey: careInvitationsQueryKey });
}

export function useCareRelationships(enabled = true) {
  const { accessToken, user } = useAuth();

  return useQuery({
    enabled: enabled && Boolean(accessToken) && Boolean(user?.id),
    queryFn: () => getCareRelationships(accessToken),
    queryKey: [...careRelationshipsQueryKey, user?.id ?? "anonymous"],
  });
}

export function useCareInvitations(enabled = true) {
  const { accessToken, user } = useAuth();

  return useQuery({
    enabled: enabled && Boolean(accessToken) && Boolean(user?.id),
    queryFn: () => getCareInvitations(accessToken),
    queryKey: [...careInvitationsQueryKey, user?.id ?? "anonymous"],
  });
}

export function useLookupCareUserByLumaId() {
  const { accessToken } = useAuth();

  return useMutation({
    mutationFn: (lumaId: string) => lookupCareUserByLumaId(accessToken, lumaId),
  });
}

export function useCreateCareRelationship() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CareRelationshipCreatePayload) =>
      createCareRelationship(accessToken, payload),
    onSuccess: () => invalidateCareQueries(queryClient),
  });
}

export function useAcceptCareInvitation() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invitationId: string) => acceptCareInvitation(accessToken, invitationId),
    onSuccess: () => invalidateCareQueries(queryClient),
  });
}

export function useDeclineCareInvitation() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (invitationId: string) => declineCareInvitation(accessToken, invitationId),
    onSuccess: () => invalidateCareQueries(queryClient),
  });
}

export function useRevokeCareRelationship() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      relationshipId,
      payload,
    }: {
      relationshipId: string;
      payload: CareRelationshipRevokePayload;
    }) => revokeCareRelationship(accessToken, relationshipId, payload),
    onSuccess: () => invalidateCareQueries(queryClient),
  });
}

export function useUpdateCarePermissions() {
  /**
   * Persist patient-owned caregiver permissions and refresh relationship lists.
   *
   * Invalidates:
   * - careRelationshipsQueryKey
   * - careInvitationsQueryKey
   */
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      relationshipId,
      payload,
    }: {
      relationshipId: string;
      payload: CarePermissionsPayload;
    }) => updateCarePermissions(accessToken, relationshipId, payload),
    onSuccess: () => invalidateCareQueries(queryClient),
  });
}

export function useUpdateCarePreferences() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      relationshipId,
      payload,
    }: {
      relationshipId: string;
      payload: CarePreferencesPayload;
    }) => updateCarePreferences(accessToken, relationshipId, payload),
    onSuccess: () => invalidateCareQueries(queryClient),
  });
}

export function useUpdateCareScope() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      relationshipId,
      payload,
    }: {
      relationshipId: string;
      payload: CareScopePayload;
    }) => updateCareScope(accessToken, relationshipId, payload),
    onSuccess: () => invalidateCareQueries(queryClient),
  });
}

export function useCareRelationshipRoutines(relationshipId?: string | null, enabled = true) {
  const { accessToken, user } = useAuth();

  return useQuery({
    enabled: enabled && Boolean(accessToken) && Boolean(user?.id) && Boolean(relationshipId),
    queryFn: () => getCareRelationshipRoutines(accessToken, relationshipId ?? ""),
    queryKey: careRelationshipRoutinesQueryKey(relationshipId ?? undefined, user?.id),
  });
}

export function useUpdateCaregiverRoutine() {
  /**
   * Save a caregiver-managed patient routine revision.
   *
   * Invalidates:
   * - The relationship-specific routines query for the current caregiver.
   */
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      payload,
      relationshipId,
      routineId,
    }: {
      payload: RoutineRevisionPayload;
      relationshipId: string;
      routineId: string;
    }) => updateCaregiverRoutine(accessToken, relationshipId, routineId, payload),
    onSuccess: (_routine, variables) => {
      void queryClient.invalidateQueries({
        queryKey: careRelationshipRoutinesQueryKey(variables.relationshipId, user?.id),
      });
    },
  });
}
