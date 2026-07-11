import * as Application from "expo-application";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { env } from "../config/env";
import { i18n } from "../i18n";
import { registerNativePushSubscription } from "./api";

export const MEDICATION_NOTIFICATION_CHANNEL = "medication_reminders";
export const MEDICATION_REMINDER_CATEGORY = "luma_medication_actions";
export const MARK_TAKEN_ACTION = "MARK_TAKEN";
export const SKIP_DOSE_ACTION = "SKIP_DOSE";

export class NativePushError extends Error {
  constructor(
    public readonly code:
      | "unsupported"
      | "permission_denied"
      | "missing_project_id"
      | "missing_device_id",
    message: string,
  ) {
    super(message);
    this.name = "NativePushError";
  }
}

export function hasNotificationPermission(status: Notifications.NotificationPermissionsStatus) {
  if (Platform.OS === "ios") {
    return [
      Notifications.IosAuthorizationStatus.AUTHORIZED,
      Notifications.IosAuthorizationStatus.PROVISIONAL,
      Notifications.IosAuthorizationStatus.EPHEMERAL,
    ].includes(status.ios?.status ?? Notifications.IosAuthorizationStatus.NOT_DETERMINED);
  }
  return status.granted || status.status === "granted";
}

export async function configureMedicationNotifications() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync(MEDICATION_NOTIFICATION_CHANNEL, {
      description: i18n.t("settings.appNotificationsDescription"),
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: "#007680",
      name: i18n.t("settings.appNotifications"),
      vibrationPattern: [0, 250, 150, 250],
    });
  }

  await Notifications.setNotificationCategoryAsync(MEDICATION_REMINDER_CATEGORY, [
    {
      buttonTitle: i18n.t("home.markAsTaken"),
      identifier: MARK_TAKEN_ACTION,
      // Android can process action taps headlessly. Expo only exposes this path on Android.
      options: { opensAppToForeground: Platform.OS !== "android" },
    },
    {
      buttonTitle: i18n.t("home.skipDose"),
      identifier: SKIP_DOSE_ACTION,
      options: {
        isDestructive: true,
        opensAppToForeground: Platform.OS !== "android",
      },
    },
  ]);
}

function getProjectId() {
  const extra = Constants.expoConfig?.extra as
    | { eas?: { projectId?: string } }
    | undefined;
  return env.easProjectId || extra?.eas?.projectId || Constants.easConfig?.projectId || "";
}

async function getDeviceId() {
  if (Platform.OS === "android") return Application.getAndroidId();
  if (Platform.OS === "ios") return Application.getIosIdForVendorAsync();
  return null;
}

export async function registerCurrentDeviceForPush(
  accessToken: string | null | undefined,
  requestPermission: boolean,
) {
  if (Platform.OS !== "ios" && Platform.OS !== "android") {
    throw new NativePushError("unsupported", "Notificações nativas não estão disponíveis aqui.");
  }

  await configureMedicationNotifications();
  let permission = await Notifications.getPermissionsAsync();
  if (!hasNotificationPermission(permission) && requestPermission) {
    permission = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
  }
  if (!hasNotificationPermission(permission)) {
    throw new NativePushError("permission_denied", "Permissão para notificações não concedida.");
  }

  const projectId = getProjectId();
  if (!projectId) {
    throw new NativePushError("missing_project_id", "EXPO_PUBLIC_EAS_PROJECT_ID não configurado.");
  }
  const deviceId = await getDeviceId();
  if (!deviceId) {
    throw new NativePushError("missing_device_id", "Não foi possível identificar este dispositivo.");
  }

  const expoPushToken = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
  return registerNativePushSubscription(accessToken, {
    app_version: Application.nativeApplicationVersion,
    device_id: deviceId,
    device_label: Device.modelName ?? Device.deviceName ?? null,
    expo_push_token: expoPushToken,
    platform: Platform.OS,
  });
}
