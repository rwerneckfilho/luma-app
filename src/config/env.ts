import { Platform } from "react-native";

const devApiBaseUrl = Platform.select({
  android: "http://10.0.2.2:8000",
  default: "http://localhost:8000",
});

function clean(value: string | undefined) {
  return value?.trim().replace(/\/+$/, "") ?? "";
}

export const env = {
  apiBaseUrl: clean(process.env.EXPO_PUBLIC_API_BASE_URL) || (__DEV__ ? devApiBaseUrl : ""),
  authRedirectUrl:
    process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL?.trim() || "luma://auth/update-password",
  easProjectId: clean(process.env.EXPO_PUBLIC_EAS_PROJECT_ID),
  supabasePublishableKey: clean(
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  ),
  supabaseUrl: clean(process.env.EXPO_PUBLIC_SUPABASE_URL),
  whatsappVerificationRequired:
    process.env.EXPO_PUBLIC_WHATSAPP_PHONE_VERIFICATION_ONBOARDING_REQUIRED === "true",
};

export const missingRequiredEnvironment = () =>
  [
    ["EXPO_PUBLIC_API_BASE_URL", env.apiBaseUrl],
    ["EXPO_PUBLIC_SUPABASE_URL", env.supabaseUrl],
    ["EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY", env.supabasePublishableKey],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);
