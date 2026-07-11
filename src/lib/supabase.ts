import "react-native-url-polyfill/auto";
import { createClient, processLock, type SupportedStorage } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import { AppState, Platform } from "react-native";
import { env } from "../config/env";

const CHUNK_SIZE = 1800;

const secureStorage: SupportedStorage = {
  async getItem(key) {
    const countValue = await SecureStore.getItemAsync(`${key}.chunks`);
    const count = Number(countValue ?? "0");
    if (!Number.isInteger(count) || count < 1) return null;
    const chunks = await Promise.all(
      Array.from({ length: count }, (_, index) => SecureStore.getItemAsync(`${key}.${index}`)),
    );
    return chunks.every((chunk): chunk is string => chunk !== null) ? chunks.join("") : null;
  },
  async removeItem(key) {
    const count = Number((await SecureStore.getItemAsync(`${key}.chunks`)) ?? "0");
    await Promise.all([
      ...Array.from({ length: Math.max(0, count) }, (_, index) =>
        SecureStore.deleteItemAsync(`${key}.${index}`),
      ),
      SecureStore.deleteItemAsync(`${key}.chunks`),
    ]);
  },
  async setItem(key, value) {
    const previousCount = Number((await SecureStore.getItemAsync(`${key}.chunks`)) ?? "0");
    const chunks = value.match(new RegExp(`.{1,${CHUNK_SIZE}}`, "gs")) ?? [""];
    await Promise.all(
      chunks.map((chunk, index) =>
        SecureStore.setItemAsync(`${key}.${index}`, chunk, {
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        }),
      ),
    );
    await SecureStore.setItemAsync(`${key}.chunks`, String(chunks.length), {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
    await Promise.all(
      Array.from({ length: Math.max(0, previousCount - chunks.length) }, (_, offset) =>
        SecureStore.deleteItemAsync(`${key}.${chunks.length + offset}`),
      ),
    );
  },
};

export const supabase = createClient(
  env.supabaseUrl || "https://example.supabase.co",
  env.supabasePublishableKey || "missing-publishable-key",
  {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: "pkce",
      lock: processLock,
      persistSession: true,
      ...(Platform.OS === "web" ? {} : { storage: secureStorage }),
    },
  },
);

let appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

/** Keep token refresh active only while the native application is foregrounded. */
export function configureSupabaseAppState() {
  if (Platform.OS === "web" || appStateSubscription) {
    return () => undefined;
  }

  if (AppState.currentState === "active") {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }

  appStateSubscription = AppState.addEventListener("change", (state) => {
    if (state === "active") {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });

  return () => {
    appStateSubscription?.remove();
    appStateSubscription = null;
    supabase.auth.stopAutoRefresh();
  };
}
