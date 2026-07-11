import { createContext } from "react";
import type { PermissionStatus } from "expo-notifications";
import type { NativePushSubscription, NativePushTestResult } from "./types";

export type NotificationsContextValue = {
  disableCurrentDevice: () => Promise<void>;
  enableCurrentDevice: () => Promise<NativePushSubscription>;
  error: string | null;
  isBusy: boolean;
  permissionStatus: PermissionStatus | null;
  registration: NativePushSubscription | null;
  sendTest: () => Promise<NativePushTestResult>;
};

export const NotificationsContext = createContext<NotificationsContextValue | null>(null);
