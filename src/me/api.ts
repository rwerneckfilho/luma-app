/**
 * AI_CONTEXT
 * repo: luma-front-webapp
 * layer: api-client
 * domain: profile-preferences
 * purpose: luma-core API wrapper for notification preferences and user profile.
 * entrypoints:
 *   - getNotificationPreferences
 *   - updateNotificationPreferences
 *   - getUserProfile
 *   - updateUserProfile
 * reads:
 *   - /v1/me/*
 * mutates:
 *   - /v1/me/*
 * used_by:
 *   - src/me/hooks.ts
 * read_first_when:
 *   - Changing profile or notification preference endpoints.
 * avoid_reading_when:
 *   - Only changing settings page layout.
 * invariants:
 *   - All requests require a current Supabase access token.
 */
import { apiRequest, requireAccessToken } from "../lib/apiClient";
import { unwrapObject } from "../lib/apiResponse";
import type {
  NotificationPreferences,
  OnboardingCompleteResponse,
  SampleReminderResponse,
  UpdateNotificationPreferencesPayload,
  UserProfile,
  UserProfileUpdate,
  WhatsAppVerificationStartResponse,
  WhatsAppVerificationVerifyResponse,
} from "./types";

export async function getNotificationPreferences(accessToken: string | null | undefined) {
  const response = await apiRequest<unknown>("/v1/me/notification-preferences", {
    accessToken: requireAccessToken(accessToken),
    method: "GET",
  });

  return unwrapObject<NotificationPreferences>(response, ["notification_preferences", "preferences", "data"]);
}

export function updateNotificationPreferences(
  accessToken: string | null | undefined,
  payload: UpdateNotificationPreferencesPayload,
) {
  return apiRequest<NotificationPreferences>("/v1/me/notification-preferences", {
    accessToken: requireAccessToken(accessToken),
    body: payload,
    method: "PUT",
  });
}

/**
 * Get the authenticated user's profile.
 * GET /v1/me/profile
 */
export async function getUserProfile(accessToken: string | null | undefined) {
  const response = await apiRequest<unknown>("/v1/me/profile", {
    accessToken: requireAccessToken(accessToken),
    method: "GET",
  });

  return unwrapObject<UserProfile>(response, ["profile", "user", "data"]);
}

/**
 * Update the authenticated user's profile.
 * PUT /v1/me/profile
 */
export function updateUserProfile(
  accessToken: string | null | undefined,
  payload: UserProfileUpdate,
) {
  return apiRequest<UserProfile>("/v1/me/profile", {
    accessToken: requireAccessToken(accessToken),
    body: payload,
    method: "PUT",
  });
}

/**
 * Mark the guided onboarding wizard as completed (idempotent).
 * POST /v1/me/onboarding/complete
 */
export function completeOnboarding(accessToken: string | null | undefined) {
  return apiRequest<OnboardingCompleteResponse>("/v1/me/onboarding/complete", {
    accessToken: requireAccessToken(accessToken),
    method: "POST",
  });
}

/**
 * Send the onboarding sample WhatsApp reminder.
 * POST /v1/me/onboarding/sample-reminder
 */
export function sendSampleReminder(accessToken: string | null | undefined) {
  return apiRequest<SampleReminderResponse>("/v1/me/onboarding/sample-reminder", {
    accessToken: requireAccessToken(accessToken),
    method: "POST",
  });
}

export function startWhatsAppVerification(
  accessToken: string | null | undefined,
  payload: { phone_e164: string; purpose: "onboarding" },
) {
  return apiRequest<WhatsAppVerificationStartResponse>("/v1/me/whatsapp-verification/start", {
    accessToken: requireAccessToken(accessToken),
    body: payload,
    method: "POST",
  });
}

export function verifyWhatsAppVerification(
  accessToken: string | null | undefined,
  payload: { verification_id: string; token: string },
) {
  return apiRequest<WhatsAppVerificationVerifyResponse>("/v1/me/whatsapp-verification/verify", {
    accessToken: requireAccessToken(accessToken),
    body: payload,
    method: "POST",
  });
}

export function resendWhatsAppVerification(
  accessToken: string | null | undefined,
  payload: { verification_id: string },
) {
  return apiRequest<WhatsAppVerificationStartResponse>("/v1/me/whatsapp-verification/resend", {
    accessToken: requireAccessToken(accessToken),
    body: payload,
    method: "POST",
  });
}

export function startWhatsAppPhoneChange(
  accessToken: string | null | undefined,
  payload: { new_phone_e164: string },
) {
  return apiRequest<WhatsAppVerificationStartResponse>("/v1/me/whatsapp-phone-change/start", {
    accessToken: requireAccessToken(accessToken),
    body: payload,
    method: "POST",
  });
}

export function verifyWhatsAppPhoneChange(
  accessToken: string | null | undefined,
  payload: { verification_id: string; token: string },
) {
  return apiRequest<WhatsAppVerificationVerifyResponse>("/v1/me/whatsapp-phone-change/verify", {
    accessToken: requireAccessToken(accessToken),
    body: payload,
    method: "POST",
  });
}
