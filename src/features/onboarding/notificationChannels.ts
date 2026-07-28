export type OnboardingChannelChoice =
  | "app_only"
  | "whatsapp_only"
  | "both";

export const defaultOnboardingChannelChoice: OnboardingChannelChoice = "both";

export function getNotificationPreferences(
  channel: OnboardingChannelChoice,
) {
  return {
    app_notifications_enabled: channel !== "whatsapp_only",
    whatsapp_notifications_enabled: channel !== "app_only",
  };
}
