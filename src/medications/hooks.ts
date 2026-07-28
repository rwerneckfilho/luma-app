/**
 * AI_CONTEXT
 * repo: luma-front-webapp
 * layer: hook
 * domain: medications
 * purpose: React Query hooks for medication list and CRUD mutations.
 * entrypoints:
 *   - useMedications
 *   - useCreateMedication
 *   - useUpdateMedication
 *   - useDeleteMedication
 * reads:
 *   - /v1/medications
 * mutates:
 *   - medicationsQueryKey
 * used_by:
 *   - src/medications/*
 * read_first_when:
 *   - Debugging medication list cache or medication CRUD.
 * avoid_reading_when:
 *   - Only changing routine schedule display.
 * invariants:
 *   - Successful medication mutations invalidate the medication list.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/useAuth";
import {
  createMedication,
  createMedicationListShare,
  deleteMedication,
  listMedications,
  updateMedication,
} from "./api";
import type { MedicationMutationPayload, MedicationUpdatePayload } from "./types";

export const medicationsQueryKey = ["medications"] as const;
export const medicationsQueryKeyForUser = (userId?: string) =>
  [...medicationsQueryKey, userId ?? "anonymous"] as const;

export function useMedications() {
  const { accessToken, user } = useAuth();

  return useQuery({
    enabled: Boolean(accessToken) && Boolean(user?.id),
    queryFn: () => listMedications(accessToken),
    queryKey: medicationsQueryKeyForUser(user?.id),
  });
}

export function useCreateMedication() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: MedicationMutationPayload) => createMedication(accessToken, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: medicationsQueryKey });
    },
  });
}

export function useUpdateMedication() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      medicationId,
      payload,
    }: {
      medicationId: string;
      payload: MedicationUpdatePayload;
    }) => updateMedication(accessToken, medicationId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: medicationsQueryKey });
    },
  });
}

export function useDeleteMedication() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (medicationId: string) => deleteMedication(accessToken, medicationId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: medicationsQueryKey });
    },
  });
}

export function useCreateMedicationListShare() {
  const { accessToken } = useAuth();
  return useMutation({ mutationFn: () => createMedicationListShare(accessToken) });
}
