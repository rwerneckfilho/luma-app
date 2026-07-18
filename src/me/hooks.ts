/**
 * AI_CONTEXT
 * repo: luma-front-webapp
 * layer: hook
 * domain: profile-preferences
 * purpose: React Query hooks for user profile and notification preferences.
 * entrypoints:
 *   - useNotificationPreferences
 *   - useUpdateNotificationPreferences
 *   - useUserProfile
 *   - useUpdateUserProfile
 * reads:
 *   - /v1/me/profile
 *   - /v1/me/notification-preferences
 * mutates:
 *   - profile and preference query keys
 * used_by:
 *   - src/settings/SettingsPage.tsx
 * read_first_when:
 *   - Changing profile/preference fetches or cache invalidation.
 * avoid_reading_when:
 *   - Only changing adherence history filters.
 * invariants:
 *   - Query keys include current user identity for auth-scoped data.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../auth/useAuth";
import {
  completeOnboarding,
  getNotificationPreferences,
  getUserProfile,
  resendWhatsAppVerification,
  sendSampleReminder,
  startWhatsAppPhoneChange,
  startWhatsAppVerification,
  updateNotificationPreferences,
  updateUserProfile,
  verifyWhatsAppPhoneChange,
  verifyWhatsAppVerification,
} from "./api";
import type {
  NotificationPreferences,
  UpdateNotificationPreferencesPayload,
  UserProfile,
  UserProfileUpdate,
} from "./types";

export const notificationPreferencesQueryKey = ["notification-preferences"] as const;
export const userProfileQueryKey = ["user-profile"] as const;

const notificationPreferencesQueryKeyForUser = (userId?: string) =>
  [...notificationPreferencesQueryKey, userId ?? "anonymous"] as const;
export const userProfileQueryKeyForUser = (userId?: string) =>
  [...userProfileQueryKey, userId ?? "anonymous"] as const;

export function useNotificationPreferences(enabled = true) {
  const { accessToken, user } = useAuth();

  return useQuery({
    enabled: enabled && Boolean(accessToken) && Boolean(user?.id),
    queryFn: () => getNotificationPreferences(accessToken),
    queryKey: notificationPreferencesQueryKeyForUser(user?.id),
  });
}

export function useUpdateNotificationPreferences() {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UpdateNotificationPreferencesPayload) =>
      updateNotificationPreferences(accessToken, payload),
    onSuccess: (preferences: NotificationPreferences) => {
      if (user?.id) {
        queryClient.setQueryData(
          notificationPreferencesQueryKeyForUser(user.id),
          preferences,
        );
      }

      void queryClient.invalidateQueries({ queryKey: notificationPreferencesQueryKey });
    },
  });
}

/**
 * Hook to fetch the authenticated user's profile.
 */
export function useUserProfile(enabled = true) {
  const { accessToken, user } = useAuth();

  return useQuery({
    enabled: enabled && Boolean(accessToken) && Boolean(user?.id),
    queryFn: () => getUserProfile(accessToken),
    queryKey: userProfileQueryKeyForUser(user?.id),
  });
}

/**
 * Hook to update the authenticated user's profile.
 */
export function useUpdateUserProfile() {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: UserProfileUpdate) => updateUserProfile(accessToken, payload),
    onSuccess: (profile: UserProfile) => {
      queryClient.setQueryData(userProfileQueryKeyForUser(user?.id), profile);
      void queryClient.invalidateQueries({ queryKey: userProfileQueryKey });
    },
  });
}

/**
 * Hook to mark the guided onboarding wizard as completed.
 */
export function useCompleteOnboarding() {
  const { accessToken, user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => completeOnboarding(accessToken),
    onSuccess: () => {
      queryClient.setQueryData<UserProfile | undefined>(userProfileQueryKeyForUser(user?.id), (profile) =>
        profile?.onboarding
          ? { ...profile, onboarding: { ...profile.onboarding, completed: true } }
          : profile,
      );
      void queryClient.invalidateQueries({ queryKey: userProfileQueryKey });
    },
  });
}

/**
 * Hook to send the onboarding sample WhatsApp reminder.
 */
export function useSendSampleReminder() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => sendSampleReminder(accessToken),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userProfileQueryKey });
      void queryClient.invalidateQueries({ queryKey: notificationPreferencesQueryKey });
    },
  });
}

export function useStartWhatsAppVerification() {
  const { accessToken } = useAuth();
  return useMutation({
    mutationFn: (payload: { phone_e164: string; purpose: "onboarding" }) =>
      startWhatsAppVerification(accessToken, payload),
  });
}

export function useVerifyWhatsAppVerification() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { verification_id: string; token: string }) =>
      verifyWhatsAppVerification(accessToken, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userProfileQueryKey });
      void queryClient.invalidateQueries({ queryKey: notificationPreferencesQueryKey });
    },
  });
}

export function useResendWhatsAppVerification() {
  const { accessToken } = useAuth();
  return useMutation({
    mutationFn: (payload: { verification_id: string }) =>
      resendWhatsAppVerification(accessToken, payload),
  });
}

export function useStartWhatsAppPhoneChange() {
  const { accessToken } = useAuth();
  return useMutation({
    mutationFn: (payload: { new_phone_e164: string }) =>
      startWhatsAppPhoneChange(accessToken, payload),
  });
}

export function useVerifyWhatsAppPhoneChange() {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { verification_id: string; token: string }) =>
      verifyWhatsAppPhoneChange(accessToken, payload),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: userProfileQueryKey });
      void queryClient.invalidateQueries({ queryKey: notificationPreferencesQueryKey });
    },
  });
}
