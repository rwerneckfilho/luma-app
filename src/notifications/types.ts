export type NativePushPlatform = "ios" | "android";

export type NativePushRegistrationPayload = {
  app_version?: string | null;
  device_id: string;
  device_label?: string | null;
  expo_push_token: string;
  platform: NativePushPlatform;
};

export type NativePushSubscription = {
  app_version: string | null;
  created_at: string;
  device_id: string;
  device_label: string | null;
  failure_count: number;
  id: string;
  invalidated_at: string | null;
  is_active: boolean;
  last_failure_at: string | null;
  last_success_at: string | null;
  platform: NativePushPlatform;
  updated_at: string;
};

export type NativePushSubscriptionList = {
  active_count: number;
  items: NativePushSubscription[];
};

export type NativePushTestResult = {
  dry_run: boolean;
  status: "sent" | "failed";
  subscription_invalidated: boolean;
};
