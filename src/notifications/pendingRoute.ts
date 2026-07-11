import AsyncStorage from "@react-native-async-storage/async-storage";
import { normalizeInternalRoute } from "../lib/deepLinks";

const PENDING_NOTIFICATION_ROUTE_KEY = "luma.notifications.pendingRoute.v1";

export function savePendingNotificationRoute(route: string) {
  return AsyncStorage.setItem(
    PENDING_NOTIFICATION_ROUTE_KEY,
    normalizeInternalRoute(route, "/"),
  );
}

export async function takePendingNotificationRoute() {
  const route = await AsyncStorage.getItem(PENDING_NOTIFICATION_ROUTE_KEY);
  if (!route) return null;
  await AsyncStorage.removeItem(PENDING_NOTIFICATION_ROUTE_KEY);
  return normalizeInternalRoute(route, "/");
}
