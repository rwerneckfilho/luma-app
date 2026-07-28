import {
  defaultOnboardingChannelChoice,
  getNotificationPreferences,
} from "./notificationChannels";

describe("onboarding notification channels", () => {
  it("defaults to App and WhatsApp", () => {
    expect(defaultOnboardingChannelChoice).toBe("both");
  });

  it.each([
    [
      "app_only",
      {
        app_notifications_enabled: true,
        whatsapp_notifications_enabled: false,
      },
    ],
    [
      "whatsapp_only",
      {
        app_notifications_enabled: false,
        whatsapp_notifications_enabled: true,
      },
    ],
    [
      "both",
      {
        app_notifications_enabled: true,
        whatsapp_notifications_enabled: true,
      },
    ],
  ] as const)("maps %s to the selected channels", (channel, expected) => {
    expect(getNotificationPreferences(channel)).toEqual(expected);
  });
});
