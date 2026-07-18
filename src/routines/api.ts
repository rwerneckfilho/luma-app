/**
 * AI_CONTEXT
 * repo: luma-front-webapp
 * layer: api-client
 * domain: routines
 * purpose: luma-core API wrapper for routine CRUD, revisions, schedules, and history.
 * entrypoints:
 *   - createRoutine
 *   - createRoutineRevision
 *   - updateRoutine
 *   - cancelRoutine
 * reads:
 *   - /v1/routines
 * mutates:
 *   - /v1/routines/*
 * used_by:
 *   - src/routines/hooks.ts
 * read_first_when:
 *   - Changing routine endpoint paths, payloads, or response unwrapping.
 * avoid_reading_when:
 *   - Only changing routine card styling.
 * invariants:
 *   - All requests require a current Supabase access token.
 */
import { apiRequest, requireAccessToken } from "../lib/apiClient";
import { unwrapItems } from "../lib/apiResponse";
import type {
  CreateRoutinePayload,
  Routine,
  RoutineRevisionPayload,
  SchedulePayload,
} from "./types";

export async function getRoutines(accessToken: string | null | undefined) {
  const response = await apiRequest<unknown>("/v1/routines", {
    accessToken: requireAccessToken(accessToken),
    method: "GET",
  });

  return unwrapItems<Routine>(response);
}

export const listRoutines = getRoutines;

export function createRoutine(
  accessToken: string | null | undefined,
  payload: CreateRoutinePayload,
) {
  return apiRequest<Routine>("/v1/routines", {
    accessToken: requireAccessToken(accessToken),
    body: payload,
    method: "POST",
  });
}

export function replaceRoutineSchedules(
  accessToken: string | null | undefined,
  routineId: string,
  payload: SchedulePayload[],
) {
  return apiRequest<Routine>(`/v1/routines/${routineId}/schedules`, {
    accessToken: requireAccessToken(accessToken),
    body: payload,
    method: "PUT",
  });
}

export function createRoutineRevision(
  accessToken: string | null | undefined,
  routineId: string,
  payload: RoutineRevisionPayload,
) {
  return apiRequest<Routine>(`/v1/routines/${routineId}/revisions`, {
    accessToken: requireAccessToken(accessToken),
    body: payload,
    method: "POST",
  });
}

export function updateRoutine(
  accessToken: string | null | undefined,
  routineId: string,
  payload: RoutineRevisionPayload,
) {
  return apiRequest<Routine>(`/v1/routines/${routineId}`, {
    accessToken: requireAccessToken(accessToken),
    body: payload,
    method: "PATCH",
  });
}

export function getRoutineHistory(
  accessToken: string | null | undefined,
  routineId: string,
) {
  return apiRequest<Routine[]>(`/v1/routines/${routineId}/history`, {
    accessToken: requireAccessToken(accessToken),
    method: "GET",
  });
}

export function cancelRoutine(accessToken: string | null | undefined, routineId: string) {
  return apiRequest<void>(`/v1/routines/${routineId}`, {
    accessToken: requireAccessToken(accessToken),
    method: "DELETE",
  });
}
