/**
 * AI_CONTEXT
 * repo: luma-front-webapp
 * layer: hook
 * domain: routines
 * purpose: React Query hooks for routine list, revisions, status changes, history, and cancel.
 * entrypoints:
 *   - useRoutines
 *   - useCreateRoutineRevision
 *   - useUpdateRoutineStatus
 * reads:
 *   - /v1/routines
 * mutates:
 *   - /v1/routines/*
 * used_by:
 *   - src/routines/*
 *   - src/medications/MedicationForm.tsx
 * read_first_when:
 *   - Debugging routine mutations, conflict handling, or cache invalidation.
 * avoid_reading_when:
 *   - Only changing care relationship invitation UI.
 * invariants:
 *   - 409 conflicts invalidate routines because luma-core routine revisions are immutable.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/useAuth";
import { ApiError } from "../lib/apiClient";
import {
  cancelRoutine,
  createRoutine,
  createRoutineRevision,
  getRoutineHistory,
  getRoutines,
  replaceRoutineSchedules,
  updateRoutine,
} from "./api";
import type { CreateRoutinePayload, RoutineRevisionPayload, RoutineStatus, SchedulePayload } from "./types";

export const routinesQueryKey = ["routines"] as const;
export const routinesQueryKeyForUser = (userId?: string) =>
  [...routinesQueryKey, userId ?? "anonymous"] as const;
export const routineHistoryQueryKey = (routineId?: string, userId?: string) =>
  [...routinesQueryKey, userId ?? "anonymous", routineId ?? "unknown", "history"] as const;

export function useRoutines() {
  const { accessToken, user } = useAuth();

  return useQuery({
    enabled: Boolean(accessToken) && Boolean(user?.id),
    queryFn: () => getRoutines(accessToken),
    queryKey: routinesQueryKeyForUser(user?.id),
  });
}

export function useCreateRoutine() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CreateRoutinePayload) => createRoutine(accessToken, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: routinesQueryKey });
    },
  });
}

export function useReplaceRoutineSchedules() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ routineId, payload }: { payload: SchedulePayload[]; routineId: string }) =>
      replaceRoutineSchedules(accessToken, routineId, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: routinesQueryKey });
    },
  });
}

function invalidateRoutineQueries(queryClient: ReturnType<typeof useQueryClient>) {
  void queryClient.invalidateQueries({ queryKey: routinesQueryKey });
}

function invalidateOnConflict(
  queryClient: ReturnType<typeof useQueryClient>,
  error: unknown,
) {
  /** Refresh routine lists when backend reports stale immutable-revision state. */
  if (error instanceof ApiError && error.status === 409) {
    invalidateRoutineQueries(queryClient);
  }
}

export function useCreateRoutineRevision() {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      payload,
      routineId,
    }: {
      payload: RoutineRevisionPayload;
      routineId: string;
    }) => createRoutineRevision(accessToken, routineId, payload),
    onError: (error) => {
      invalidateOnConflict(queryClient, error);
    },
    onSuccess: (_routine, variables) => {
      invalidateRoutineQueries(queryClient);
      void queryClient.invalidateQueries({
        queryKey: routineHistoryQueryKey(variables.routineId, user?.id),
      });
    },
  });
}

export function useUpdateRoutineStatus() {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      active,
      routineId,
      status,
    }: {
      active: boolean;
      routineId: string;
      status: Extract<RoutineStatus, "active" | "paused">;
    }) => updateRoutine(accessToken, routineId, { active, status }),
    onError: (error) => {
      invalidateOnConflict(queryClient, error);
    },
    onSuccess: (_routine, variables) => {
      invalidateRoutineQueries(queryClient);
      void queryClient.invalidateQueries({
        queryKey: routineHistoryQueryKey(variables.routineId, user?.id),
      });
    },
  });
}

export function useRoutineHistory(routineId?: string | null, enabled = true) {
  const { accessToken, user } = useAuth();

  return useQuery({
    enabled: enabled && Boolean(accessToken) && Boolean(user?.id) && Boolean(routineId),
    queryFn: () => getRoutineHistory(accessToken, routineId ?? ""),
    queryKey: routineHistoryQueryKey(routineId ?? undefined, user?.id),
  });
}

export function useCancelRoutine() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (routineId: string) => cancelRoutine(accessToken, routineId),
    onError: (error) => {
      invalidateOnConflict(queryClient, error);
    },
    onSuccess: () => {
      invalidateRoutineQueries(queryClient);
    },
  });
}
