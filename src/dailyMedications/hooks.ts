/**
 * AI_CONTEXT
 * repo: luma-front-webapp
 * layer: hook
 * domain: daily-medications
 * purpose: React Query hooks for Home dashboard reads and dose taken/skipped mutations.
 * entrypoints:
 *   - useDailyMedications
 *   - useMarkDoseTaken
 *   - useSkipDose
 * reads:
 *   - /v1/me/daily-medications
 * mutates:
 *   - /v1/me/daily-medications/:eventId/taken
 *   - /v1/me/daily-medications/:eventId/skipped
 * used_by:
 *   - src/home/HomePage.tsx
 * read_first_when:
 *   - Debugging Home dashboard fetches, mark taken, skip, or cache invalidation.
 * avoid_reading_when:
 *   - Only changing medication form validation.
 * invariants:
 *   - 409 conflicts invalidate daily medication queries so stale dose state refetches.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/useAuth";
import { ApiError } from "../lib/apiClient";
import { getDailyMedications, markDoseTaken, skipDose } from "./api";
import type { MarkDoseTakenPayload } from "./types";

export const dailyMedicationsQueryKey = ["daily-medications"] as const;

export const dailyMedicationsQueryKeyForUser = (userId?: string, date?: string) =>
  [...dailyMedicationsQueryKey, userId ?? "anonymous", date ?? "today"] as const;

export function useDailyMedications(date?: string) {
  const { accessToken, user } = useAuth();

  return useQuery({
    enabled: Boolean(accessToken) && Boolean(user?.id),
    queryFn: () => getDailyMedications(accessToken, date),
    queryKey: dailyMedicationsQueryKeyForUser(user?.id, date),
    refetchInterval: 60_000,
  });
}

export function useMarkDoseTaken() {
  /** Mark one dose taken and invalidate dashboard data on success or stale-state conflict. */
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      eventId,
      payload,
    }: {
      eventId: string;
      payload: MarkDoseTakenPayload;
    }) => markDoseTaken(accessToken, eventId, payload),
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: dailyMedicationsQueryKey });
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: dailyMedicationsQueryKey });
    },
  });
}

export function useSkipDose() {
  /** Skip one dose and invalidate dashboard data on success or stale-state conflict. */
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      acknowledgeEarly,
      eventId,
    }: {
      acknowledgeEarly?: boolean;
      eventId: string;
    }) =>
      skipDose(
        accessToken,
        eventId,
        acknowledgeEarly ? { acknowledge_early: true } : undefined,
      ),
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: dailyMedicationsQueryKey });
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: dailyMedicationsQueryKey });
    },
  });
}
