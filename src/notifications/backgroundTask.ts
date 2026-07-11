import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import { savePendingNotificationRoute } from "./pendingRoute";
import { processNotificationResponse } from "./responseProcessor";

export const MEDICATION_NOTIFICATION_TASK = "luma-medication-notification-actions-v1";

type MedicationNotificationTaskBody = {
  data: Notifications.NotificationTaskPayload;
  error: unknown;
};

if (Platform.OS === "android") {
  if (!TaskManager.isTaskDefined(MEDICATION_NOTIFICATION_TASK)) {
    TaskManager.defineTask<Notifications.NotificationTaskPayload>(
      MEDICATION_NOTIFICATION_TASK,
      async ({ data, error }: MedicationNotificationTaskBody) => {
        if (error || !("actionIdentifier" in data)) {
          return Notifications.BackgroundNotificationTaskResult.NoData;
        }

        const result = await processNotificationResponse(data);
        if (result.route) await savePendingNotificationRoute(result.route);
        return result.terminal
          ? Notifications.BackgroundNotificationTaskResult.NewData
          : Notifications.BackgroundNotificationTaskResult.Failed;
      },
    );
  }

  void Notifications.registerTaskAsync(MEDICATION_NOTIFICATION_TASK).catch(() => undefined);
}
