import type { Href } from "expo-router";
import { router, useSegments } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import { type PropsWithChildren, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/useAuth";
import { ApiError } from "../lib/apiClient";
import {
  deactivateNativePushSubscription,
  sendNativePushTest,
} from "./api";
import { NotificationsContext, type NotificationsContextValue } from "./notificationContext";
import {
  configureMedicationNotifications,
  hasNotificationPermission,
  registerCurrentDeviceForPush,
} from "./registration";
import { processNotificationResponse } from "./responseProcessor";
import { savePendingNotificationRoute } from "./pendingRoute";
import type { NativePushSubscription } from "./types";

const AUTO_REGISTRATION_DISABLED_PREFIX = "luma.notifications.autoRegister.disabled.v1";
const STORED_REGISTRATION_PREFIX = "luma.notifications.registration.v1";

function autoRegistrationDisabledKey(userId: string) {
  return `${AUTO_REGISTRATION_DISABLED_PREFIX}:${userId}`;
}

function storedRegistrationKey(userId: string) {
  return `${STORED_REGISTRATION_PREFIX}:${userId}`;
}

function parseStoredRegistration(value: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as NativePushSubscription;
    return parsed && typeof parsed.id === "string" && parsed.is_active ? parsed : null;
  } catch {
    return null;
  }
}

function isTerminalDeactivationError(error: unknown) {
  return error instanceof ApiError && (error.status === 401 || error.status === 404);
}

async function clearDeviceNotificationArtifacts() {
  Notifications.clearLastNotificationResponse();
  await Promise.all([
    Notifications.dismissAllNotificationsAsync().catch(() => undefined),
    Notifications.unregisterForNotificationsAsync().catch(() => undefined),
  ]);
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export function NotificationsProvider({ children }: PropsWithChildren) {
  const { accessToken, isLoading: isAuthLoading, registerBeforeSignOutCleanup, user } = useAuth();
  const { i18n } = useTranslation();
  const segments = useSegments();
  const userId = user?.id ?? null;
  const authIdentity = accessToken && userId ? `${userId}:${accessToken}` : null;
  const accessTokenRef = useRef(accessToken);
  const userIdRef = useRef(userId);
  const lastAuthenticatedTokenRef = useRef(accessToken);
  const lastAuthenticatedUserIdRef = useRef(userId);
  const registrationRef = useRef<NativePushSubscription | null>(null);
  const segmentsRef = useRef<readonly string[]>(segments);
  const authIdentityRef = useRef<string | null>(authIdentity);
  const registrationQueueRef = useRef<Promise<void>>(Promise.resolve());
  const registrationPromisesRef = useRef(
    new Map<string, Promise<NativePushSubscription>>(),
  );
  const autoRegistrationBlockedRef = useRef(true);
  const [registration, setRegistration] = useState<NativePushSubscription | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<Notifications.PermissionStatus | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    accessTokenRef.current = accessToken;
    userIdRef.current = userId;
    authIdentityRef.current = authIdentity;
    registrationRef.current = registration;
    segmentsRef.current = segments;
  }, [accessToken, authIdentity, registration, segments, userId]);

  const register = useCallback((requestPermission: boolean) => {
    const identity = authIdentityRef.current;
    const ownerToken = accessTokenRef.current;
    const ownerUserId = userIdRef.current;
    if (!identity || !ownerToken || !ownerUserId) {
      return Promise.reject(new Error("Sessão indisponível para registrar notificações."));
    }
    const existing = registrationPromisesRef.current.get(identity);
    if (existing) return existing;

    const operation = registrationQueueRef.current
      .catch(() => undefined)
      .then(async () => {
        if (authIdentityRef.current !== identity) {
          throw new Error("A conta mudou durante o registro de notificações.");
        }
        const saved = await registerCurrentDeviceForPush(ownerToken, requestPermission);
        if (authIdentityRef.current !== identity) {
          await deactivateNativePushSubscription(ownerToken, saved.id).catch(() => undefined);
          throw new Error("A conta mudou durante o registro de notificações.");
        }
        registrationRef.current = saved;
        await AsyncStorage.setItem(
          storedRegistrationKey(ownerUserId),
          JSON.stringify(saved),
        ).catch(() => undefined);
        setRegistration(saved);
        setError(null);
        return saved;
      });

    registrationPromisesRef.current.set(identity, operation);
    registrationQueueRef.current = operation.then(
      () => undefined,
      () => undefined,
    );
    void operation.finally(() => {
      if (registrationPromisesRef.current.get(identity) === operation) {
        registrationPromisesRef.current.delete(identity);
      }
    }).catch(() => undefined);
    return operation;
  }, []);

  const handleResponse = useCallback(
    async (response: Notifications.NotificationResponse) => {
      const result = await processNotificationResponse(response);
      if (result.terminal) Notifications.clearLastNotificationResponse();
      if (!result.route) return;

      if (accessTokenRef.current && segmentsRef.current[0] === "(app)") {
        router.push(result.route as Href);
        return;
      }

      await savePendingNotificationRoute(result.route);
    },
    [],
  );

  useEffect(() => {
    if (Platform.OS !== "web") void configureMedicationNotifications();
  }, [i18n.resolvedLanguage]);

  useEffect(() => registerBeforeSignOutCleanup(async () => {
    const ownerUserId = userIdRef.current;
    const ownerToken = accessTokenRef.current;
    if (!ownerUserId || !ownerToken) return;
    const stored = parseStoredRegistration(
      await AsyncStorage.getItem(storedRegistrationKey(ownerUserId)),
    );
    const current = registrationRef.current ?? stored;
    if (current) {
      try {
        await deactivateNativePushSubscription(ownerToken, current.id);
      } catch (error) {
        // A 401 also invalidates the local auth session; retrying cannot revoke with it.
        if (!isTerminalDeactivationError(error)) throw error;
      }
    }
    registrationRef.current = null;
    setRegistration(null);
    await AsyncStorage.removeItem(storedRegistrationKey(ownerUserId)).catch(() => undefined);
    await clearDeviceNotificationArtifacts();
  }), [registerBeforeSignOutCleanup]);

  useEffect(() => {
    if (Platform.OS === "web") return;
    void Notifications.getPermissionsAsync().then((status) => {
      setPermissionStatus(status.status);
    });

    const lastResponse = Notifications.getLastNotificationResponse();
    if (lastResponse) void handleResponse(lastResponse).catch(() => undefined);

    const responseSubscription = Notifications.addNotificationResponseReceivedListener((response) => {
      void handleResponse(response).catch(() => undefined);
    });
    const tokenSubscription = Notifications.addPushTokenListener(() => {
      if (accessTokenRef.current && !autoRegistrationBlockedRef.current) {
        void register(false).catch(() => undefined);
      }
    });
    return () => {
      responseSubscription.remove();
      tokenSubscription.remove();
    };
  }, [handleResponse, register]);

  useEffect(() => {
    if (!accessToken || !userId) {
      autoRegistrationBlockedRef.current = true;
      if (!isAuthLoading) void clearDeviceNotificationArtifacts();
      const previousToken = lastAuthenticatedTokenRef.current;
      const previousUserId = lastAuthenticatedUserIdRef.current;
      const previousRegistration = registrationRef.current;
      lastAuthenticatedTokenRef.current = null;
      lastAuthenticatedUserIdRef.current = null;
      registrationRef.current = null;
      setRegistration(null);
      if (previousToken && previousUserId) {
        void AsyncStorage.getItem(storedRegistrationKey(previousUserId))
          .then((storedValue) => previousRegistration ?? parseStoredRegistration(storedValue))
          .then(async (current) => {
            if (!current) return;
            try {
              await deactivateNativePushSubscription(previousToken, current.id);
            } catch (error) {
              if (!isTerminalDeactivationError(error)) throw error;
            }
            await AsyncStorage.removeItem(storedRegistrationKey(previousUserId)).catch(
              () => undefined,
            );
          })
          .catch(() => undefined);
      }
      return;
    }
    lastAuthenticatedTokenRef.current = accessToken;
    lastAuthenticatedUserIdRef.current = userId;
    autoRegistrationBlockedRef.current = true;
    if (Platform.OS !== "web") {
      let cancelled = false;
      const identity = authIdentityRef.current;
      void Promise.all([
        AsyncStorage.getItem(autoRegistrationDisabledKey(userId)),
        AsyncStorage.getItem(storedRegistrationKey(userId)),
      ]).then(async ([disabled, storedValue]) => {
        if (cancelled) return;
        autoRegistrationBlockedRef.current = disabled === "true";
        const stored = parseStoredRegistration(storedValue);
        if (autoRegistrationBlockedRef.current) {
          await AsyncStorage.removeItem(storedRegistrationKey(userId)).catch(() => undefined);
        } else if (stored && authIdentityRef.current === identity) {
          registrationRef.current = stored;
          setRegistration(stored);
        }

        const status = await Notifications.getPermissionsAsync();
        if (cancelled || authIdentityRef.current !== identity) return;
        setPermissionStatus(status.status);
        if (!autoRegistrationBlockedRef.current && hasNotificationPermission(status)) {
          void register(false).catch(() => undefined);
        } else if (stored && !hasNotificationPermission(status)) {
          try {
            await deactivateNativePushSubscription(accessToken, stored.id);
          } catch (error) {
            if (!isTerminalDeactivationError(error)) return;
          }
          registrationRef.current = null;
          setRegistration(null);
          await AsyncStorage.removeItem(storedRegistrationKey(userId)).catch(() => undefined);
        }
      });
      return () => {
        cancelled = true;
      };
    }
  }, [accessToken, isAuthLoading, register, userId]);

  const enableCurrentDevice = useCallback(async () => {
    setIsBusy(true);
    setError(null);
    try {
      if (userId) {
        await AsyncStorage.removeItem(autoRegistrationDisabledKey(userId));
      }
      autoRegistrationBlockedRef.current = false;
      const saved = await register(true);
      const status = await Notifications.getPermissionsAsync();
      setPermissionStatus(status.status);
      return saved;
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Não foi possível ativar notificações.";
      setError(message);
      throw caught;
    } finally {
      setIsBusy(false);
    }
  }, [register, userId]);

  const disableCurrentDevice = useCallback(async () => {
    if (!registration) return;
    setIsBusy(true);
    try {
      await deactivateNativePushSubscription(accessTokenRef.current, registration.id);
      autoRegistrationBlockedRef.current = true;
      if (userId) {
        await AsyncStorage.setItem(autoRegistrationDisabledKey(userId), "true");
        await AsyncStorage.removeItem(storedRegistrationKey(userId)).catch(() => undefined);
      }
      registrationRef.current = null;
      setRegistration(null);
      await clearDeviceNotificationArtifacts();
      setError(null);
    } finally {
      setIsBusy(false);
    }
  }, [registration, userId]);

  const sendTest = useCallback(async () => {
    if (!registration) throw new Error("Este dispositivo ainda não está registrado.");
    const result = await sendNativePushTest(accessTokenRef.current, registration.id);
    if (result.subscription_invalidated) {
      registrationRef.current = null;
      setRegistration(null);
    }
    return result;
  }, [registration]);

  const value = useMemo<NotificationsContextValue>(
    () => ({
      disableCurrentDevice,
      enableCurrentDevice,
      error,
      isBusy,
      permissionStatus,
      registration,
      sendTest,
    }),
    [disableCurrentDevice, enableCurrentDevice, error, isBusy, permissionStatus, registration, sendTest],
  );

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}
