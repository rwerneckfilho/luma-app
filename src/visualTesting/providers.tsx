import type { Session, User } from "@supabase/supabase-js";
import type { PropsWithChildren } from "react";
import { AuthContext, type AuthContextValue } from "../auth/authContext";
import { NotificationsContext, type NotificationsContextValue } from "../notifications/notificationContext";
import type { VisualScenario } from "./types";

const noop = async () => undefined;

function authValue(scenario: VisualScenario): AuthContextValue {
  const fixture = scenario.fixture;
  const visualSession = fixture.session;
  if (!visualSession) {
    return {
      accessToken: null,
      clearPasswordRecovery: noop,
      isLoading: false,
      isPasswordRecovery: false,
      recoveryError: null,
      registerBeforeSignOutCleanup: () => () => undefined,
      resetPassword: noop,
      session: null,
      signIn: noop,
      signOut: noop,
      signUp: noop,
      updatePassword: noop,
      user: null,
    };
  }

  const user = {
    app_metadata: {},
    aud: "authenticated",
    created_at: "2026-01-01T12:00:00-03:00",
    email: fixture.profile?.email ?? "visual@example.test",
    id: visualSession.userId,
    user_metadata: { full_name: fixture.profile?.full_name },
  } as User;
  const session = {
    access_token: visualSession.accessToken,
    expires_at: visualSession.expiresAt,
    expires_in: 3600,
    refresh_token: visualSession.refreshToken,
    token_type: "bearer",
    user,
  } as Session;

  return {
    accessToken: visualSession.accessToken,
    clearPasswordRecovery: noop,
    isLoading: false,
    isPasswordRecovery: false,
    recoveryError: null,
    registerBeforeSignOutCleanup: () => () => undefined,
    resetPassword: noop,
    session,
    signIn: noop,
    signOut: noop,
    signUp: noop,
    updatePassword: noop,
    user,
  };
}

const registration = {
  app_version: "1.0.0",
  created_at: "2026-01-01T12:00:00-03:00",
  device_id: "visual-device",
  device_label: "Visual Test Device",
  failure_count: 0,
  id: "visual-push-subscription",
  invalidated_at: null,
  is_active: true,
  last_failure_at: null,
  last_success_at: "2026-06-18T12:00:00-03:00",
  platform: "ios" as const,
  updated_at: "2026-06-18T12:00:00-03:00",
};

const notificationsValue: NotificationsContextValue = {
  disableCurrentDevice: noop,
  enableCurrentDevice: async () => registration,
  error: null,
  isBusy: false,
  permissionStatus: "granted" as NotificationsContextValue["permissionStatus"],
  registration,
  sendTest: async () => ({ dry_run: true, status: "sent", subscription_invalidated: false }),
};

export function VisualProviders({ children, scenario }: PropsWithChildren<{ scenario: VisualScenario }>) {
  return (
    <AuthContext.Provider value={authValue(scenario)}>
      <NotificationsContext.Provider value={notificationsValue}>{children}</NotificationsContext.Provider>
    </AuthContext.Provider>
  );
}
