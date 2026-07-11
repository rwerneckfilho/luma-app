import { apiRequest, requireAccessToken } from "../lib/apiClient";
import type {
  NativePushRegistrationPayload,
  NativePushSubscription,
  NativePushSubscriptionList,
  NativePushTestResult,
} from "./types";

const basePath = "/v1/me/native-push-subscriptions";

export async function listNativePushSubscriptions(accessToken: string | null | undefined) {
  const response = await apiRequest<NativePushSubscriptionList | NativePushSubscription[]>(basePath, {
    accessToken: requireAccessToken(accessToken),
    method: "GET",
  });
  return Array.isArray(response)
    ? { active_count: response.filter((item) => item.is_active).length, items: response }
    : response;
}

export function registerNativePushSubscription(
  accessToken: string | null | undefined,
  payload: NativePushRegistrationPayload,
) {
  return apiRequest<NativePushSubscription>(basePath, {
    accessToken: requireAccessToken(accessToken),
    body: payload,
    method: "POST",
  });
}

export function deactivateNativePushSubscription(
  accessToken: string | null | undefined,
  subscriptionId: string,
) {
  return apiRequest<NativePushSubscription>(`${basePath}/${subscriptionId}`, {
    accessToken: requireAccessToken(accessToken),
    method: "DELETE",
  });
}

export function sendNativePushTest(
  accessToken: string | null | undefined,
  subscriptionId: string,
) {
  return apiRequest<NativePushTestResult>(`${basePath}/${subscriptionId}/test`, {
    accessToken: requireAccessToken(accessToken),
    method: "POST",
  });
}

export function submitTakenPushAction(token: string) {
  return apiRequest<unknown>("/v1/push-actions/taken", {
    body: { token },
    method: "POST",
  });
}

export function submitSkippedPushAction(token: string) {
  return apiRequest<unknown>("/v1/push-actions/skipped", {
    body: { token },
    method: "POST",
  });
}
