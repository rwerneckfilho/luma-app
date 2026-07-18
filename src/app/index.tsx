import { Redirect } from "expo-router";
import { useAuth } from "../auth/useAuth";
import { env } from "../config/env";
import { useUserProfile } from "../me/hooks";

export default function EntryRoute() {
  const { isPasswordRecovery, session } = useAuth();
  const profileQuery = useUserProfile(Boolean(session) && !isPasswordRecovery);

  if (!session) return <Redirect href="/(auth)/login" />;
  if (isPasswordRecovery) return <Redirect href="/auth/update-password" />;

  const profile = profileQuery.data;
  const onboardingIncomplete = profile?.onboarding?.completed === false;
  const whatsappVerified =
    profile?.onboarding?.whatsapp_verified ?? Boolean(profile?.whatsapp_delivery_phone_e164);
  const whatsappRequired =
    env.whatsappVerificationRequired &&
    (profile?.onboarding?.whatsapp_verification_required ?? true) &&
    !whatsappVerified;

  if (!profile || onboardingIncomplete || whatsappRequired) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(app)/home" />;
}
