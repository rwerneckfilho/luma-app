import AsyncStorage from "@react-native-async-storage/async-storage";
import type * as Notifications from "expo-notifications";
import { ApiError } from "../lib/apiClient";
import { normalizeInternalRoute } from "../lib/deepLinks";
import { submitSkippedPushAction, submitTakenPushAction } from "./api";
import { MARK_TAKEN_ACTION, SKIP_DOSE_ACTION } from "./registration";

const PROCESSED_RESPONSES_KEY = "luma.notifications.processedResponses.v1";
const MAX_PROCESSED_RESPONSES = 128;
const inFlightResponses = new Map<string, Promise<NotificationResponseResult>>();

export type NotificationResponseResult = {
  route: string | null;
  terminal: boolean;
};

export function notificationResponseKey(response: Notifications.NotificationResponse) {
  return `${response.notification.request.identifier}:${response.actionIdentifier}`;
}

async function readProcessedResponses() {
  try {
    const value = await AsyncStorage.getItem(PROCESSED_RESPONSES_KEY);
    const parsed = value ? JSON.parse(value) : [];
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

async function markProcessed(key: string) {
  const previous = await readProcessedResponses();
  const next = [...previous.filter((item) => item !== key), key].slice(-MAX_PROCESSED_RESPONSES);
  await AsyncStorage.setItem(PROCESSED_RESPONSES_KEY, JSON.stringify(next));
}

function tokenFromData(data: Record<string, unknown>, key: string) {
  const value = data[key];
  return typeof value === "string" && value.trim() ? value : null;
}

async function processOnce(response: Notifications.NotificationResponse) {
  const key = notificationResponseKey(response);
  const data = response.notification.request.content.data as Record<string, unknown>;
  const route = normalizeInternalRoute(data.deep_link ?? data.url, "/");
  if ((await readProcessedResponses()).includes(key)) {
    return { route: null, terminal: true } satisfies NotificationResponseResult;
  }

  let action: (() => Promise<unknown>) | null = null;
  if (response.actionIdentifier === MARK_TAKEN_ACTION) {
    const token = tokenFromData(data, "taken_action_token");
    if (token) action = () => submitTakenPushAction(token);
  } else if (response.actionIdentifier === SKIP_DOSE_ACTION) {
    const token = tokenFromData(data, "skipped_action_token");
    if (token) action = () => submitSkippedPushAction(token);
  }

  if (action) {
    try {
      await action();
    } catch (error) {
      if (!(error instanceof ApiError && (error.status === 401 || error.status === 409))) {
        return { route: null, terminal: false } satisfies NotificationResponseResult;
      }
    }
  }

  await markProcessed(key);
  return { route, terminal: true } satisfies NotificationResponseResult;
}

/** Deduplicates cold-start and live-listener delivery without persisting action tokens. */
export function processNotificationResponse(response: Notifications.NotificationResponse) {
  const key = notificationResponseKey(response);
  const existing = inFlightResponses.get(key);
  if (existing) return existing;

  const promise = processOnce(response).finally(() => inFlightResponses.delete(key));
  inFlightResponses.set(key, promise);
  return promise;
}
