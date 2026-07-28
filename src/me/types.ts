export type NotificationMode = "none" | "app_only" | "whatsapp_only" | "both";

export type NotificationChannel = "web_push" | "app_push" | "whatsapp";

/**
 * Preferences plus computed channel status returned by
 * GET/PUT /v1/me/notification-preferences.
 */
export type NotificationPreferences = {
  app_notifications_enabled: boolean;
  whatsapp_notifications_enabled: boolean;
  notification_mode: NotificationMode;
  app_ready: boolean;
  whatsapp_ready: boolean;
  whatsapp_verified: boolean;
  active_push_subscriptions: number;
  active_native_push_subscriptions: number;
  effective_channels: NotificationChannel[];
  web_push_vapid_public_key?: string | null;
};

export type UpdateNotificationPreferencesPayload = {
  app_notifications_enabled: boolean;
  whatsapp_notifications_enabled: boolean;
};

/**
 * User profile returned by GET /v1/me/profile.
 * Matches backend UserProfileOut schema.
 */
export type UserProfile = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  luma_id: string;
  profile_photo_path: string;
  phone_e164: string;
  whatsapp_delivery_phone_e164?: string | null;
  whatsapp_delivery_phone_verified_at?: string | null;
  whatsapp_delivery_phone_verification_method?: string | null;
  locale: string;
  timezone: string;
  status: string;
  onboarding?: {
    whatsapp_verification_required: boolean;
    whatsapp_verified: boolean;
    /** Optional: an older backend may omit it; treat missing as completed. */
    completed?: boolean;
    sample_reminder_sent_at?: string | null;
  };
};

export type OnboardingCompleteResponse = {
  completed: boolean;
  completed_at: string;
};

export type SampleReminderChannelResult = {
  channel: NotificationChannel;
  status: "sent" | "failed";
  dry_run?: boolean;
  error?: string | null;
};

export type SampleReminderResponse = {
  status: "sent" | "partial";
  sent_at: string;
  cooldown_seconds: number;
  dry_run: boolean;
  channels: SampleReminderChannelResult[];
};

/**
 * Request body for PUT /v1/me/profile.
 * Matches backend UserProfileUpdate schema.
 */
export type UserProfileUpdate = {
  full_name: string;
  phone_e164: string;
  locale: string;
  timezone: string;
};

export type WhatsAppVerificationPurpose = "onboarding" | "phone_change";
export type WhatsAppVerificationDeliveryStatus =
  | "not_requested"
  | "sent"
  | "unknown";

export type WhatsAppVerificationStartResponse = {
  verification_id: string;
  status: "pending";
  delivery_status: WhatsAppVerificationDeliveryStatus;
  expires_at: string;
  cooldown_seconds: number;
  resend_available_at: string | null;
  fallback_available_at: string | null;
  candidates_sent: ("with_9" | "without_9" | "international")[];
  fallback_url: string;
};

export type WhatsAppVerificationVerifyResponse = {
  status: "verified";
  selected_method: string;
  selected_phone_masked: string;
  verified_at: string;
};

export type WhatsAppVerificationStatus = {
  status:
    | "not_started"
    | "pending"
    | "verified"
    | "expired"
    | "cancelled"
    | "failed"
    | "superseded";
  verification_id: string | null;
  expires_at: string | null;
  attempts_remaining: number;
  resends_remaining: number;
  fallback_available_at: string | null;
};
