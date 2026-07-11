/**
 * AI_CONTEXT
 * repo: luma-front-webapp
 * layer: util
 * domain: notifications
 * purpose: Shared derivation of notification mode, readiness, and onboarding setup state.
 * entrypoints:
 *   - deriveNotificationMode
 *   - isNotificationSetupComplete
 *   - applyWhatsAppSkip
 * reads:
 *   - NotificationPreferences status payload
 * mutates:
 *   - nothing (pure functions)
 * used_by:
 *   - onboarding notification setup step
 *   - settings notification section
 * read_first_when:
 *   - Changing mode derivation or step-completion rules.
 * avoid_reading_when:
 *   - Only changing visual layout.
 * invariants:
 *   - Mirrors luma-core services/notification_status.py; the backend recomputes
 *     eligibility and never trusts this client-side derivation.
 */
import type {
  NotificationMode,
  NotificationPreferences,
  UpdateNotificationPreferencesPayload,
} from "./types";

export function deriveNotificationMode(
  appEnabled: boolean,
  whatsappEnabled: boolean,
): NotificationMode {
  if (appEnabled && whatsappEnabled) {
    return "both";
  }
  if (appEnabled) {
    return "app_only";
  }
  if (whatsappEnabled) {
    return "whatsapp_only";
  }
  return "none";
}

/**
 * Whether the onboarding notification setup step is complete for a selected mode:
 * app_only needs app_ready, whatsapp_only needs whatsapp_ready, both needs both.
 * "none" is only a temporary unconfigured state and never counts as complete.
 */
export function isNotificationSetupComplete(
  mode: NotificationMode,
  status: Pick<NotificationPreferences, "app_ready" | "whatsapp_ready">,
): boolean {
  switch (mode) {
    case "app_only":
      return status.app_ready;
    case "whatsapp_only":
      return status.whatsapp_ready;
    case "both":
      return status.app_ready && status.whatsapp_ready;
    default:
      return false;
  }
}

export type WhatsAppSkipResult = {
  /** Preference payload to persist immediately (never leaves whatsapp enabled). */
  preferences: UpdateNotificationPreferencesPayload;
  /** Where the wizard goes next after skipping WhatsApp verification. */
  next: "app_setup" | "continue";
};

/**
 * Skip-for-now semantics on WhatsApp verification:
 * - selected `both`  -> effective mode becomes app_only, keep going.
 * - selected `whatsapp_only` -> redirect into App notification setup.
 * A verified phone is never discarded here; only the preference flag changes.
 */
export function applyWhatsAppSkip(
  selectedMode: NotificationMode,
  status: Pick<NotificationPreferences, "app_notifications_enabled">,
): WhatsAppSkipResult {
  if (selectedMode === "both") {
    return {
      preferences: {
        app_notifications_enabled: true,
        whatsapp_notifications_enabled: false,
      },
      next: "continue",
    };
  }
  return {
    preferences: {
      app_notifications_enabled: status.app_notifications_enabled,
      whatsapp_notifications_enabled: false,
    },
    next: "app_setup",
  };
}

/** True when at least one channel is operational (onboarding may complete). */
export function hasOperationalChannel(
  status: Pick<NotificationPreferences, "app_ready" | "whatsapp_ready">,
): boolean {
  return status.app_ready || status.whatsapp_ready;
}
