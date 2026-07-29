import { useState } from "react";
import { Alert, Linking, Text, StyleSheet, View } from "react-native";
import { router } from "expo-router";
import { MessageCircle, ShieldCheck } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { useResendWhatsAppVerification, useStartWhatsAppVerification, useUserProfile, useVerifyWhatsAppVerification } from "../me/hooks";
import type { WhatsAppVerificationStartResponse } from "../me/types";
import { colors } from "../design/theme";
import { Body, Button, Card, Field, Screen, StateMessage } from "../features/shared/native";
import { useVerificationCountdown } from "../features/shared/useVerificationCountdown";

export default function WhatsAppVerificationRoute() {
  const { t } = useTranslation();
  const profile = useUserProfile();
  const start = useStartWhatsAppVerification();
  const verify = useVerifyWhatsAppVerification();
  const resend = useResendWhatsAppVerification();
  const [challenge, setChallenge] = useState<WhatsAppVerificationStartResponse | null>(null);
  const [token, setToken] = useState("");
  const [codeRequested, setCodeRequested] = useState(false);
  const { resendSeconds } = useVerificationCountdown(challenge);

  if (profile.isLoading) return <Screen><StateMessage loading title={t("common.loading")} /></Screen>;
  if (!profile.data) return <Screen><StateMessage action={<Button onPress={() => void profile.refetch()}>{t("common.tryAgain")}</Button>} title={t("settings.failedLoadProfile")} /></Screen>;

  const phone = profile.data.phone_e164;
  const begin = async () => {
    try {
      const started = await start.mutateAsync({ phone_e164: phone, purpose: "onboarding" });
      setChallenge(started);
      await Linking.openURL(started.fallback_url);
    }
    catch (error) { Alert.alert(t("common.somethingWentWrong"), error instanceof Error ? error.message : ""); }
  };
  const confirm = async () => {
    if (!challenge) return;
    try {
      await verify.mutateAsync({ token, verification_id: challenge.verification_id });
      await profile.refetch();
      router.replace("/(app)/home");
    } catch (error) { Alert.alert(t("common.somethingWentWrong"), error instanceof Error ? error.message : ""); }
  };
  const resendCode = async () => {
    if (!challenge || resendSeconds > 0) return;
    try {
      setChallenge(await resend.mutateAsync({ verification_id: challenge.verification_id }));
      setToken("");
      setCodeRequested(true);
    }
    catch (error) { Alert.alert(t("common.somethingWentWrong"), error instanceof Error ? error.message : ""); }
  };
  const checkInbound = async () => {
    const result = await profile.refetch();
    if (result.data?.whatsapp_delivery_phone_verified_at) router.replace("/(app)/home");
    else Alert.alert(t("whatsappVerification.pendingTitle"), t("whatsappVerification.pendingMessage"));
  };

  return (
    <Screen title="LUMA">
      <Card>
        <View style={styles.icon}><ShieldCheck color={colors.primary} size={28} /></View>
        <Text style={styles.heading}>{t("whatsappVerification.title")}</Text>
        <Body muted>{challenge ? t("whatsappVerification.sendMessageInstructions") : t("whatsappVerification.onboardingDescription")}</Body>
        <Body>{phone}</Body>
        {!challenge ? <Button icon={MessageCircle} loading={start.isPending} onPress={() => void begin()}>{t("whatsappVerification.sendMessage")}</Button> : (
          <>
            <Button onPress={() => void Linking.openURL(challenge.fallback_url)}>{t("whatsappVerification.openWhatsApp")}</Button>
            <Button loading={profile.isRefetching} onPress={() => void checkInbound()} secondary>{t("whatsappVerification.messageSent")}</Button>
            {codeRequested ? (
              <>
                <Body muted>{t("whatsappVerification.sent")}</Body>
                <Field keyboardType="number-pad" label={t("whatsappVerification.codeLabel")} maxLength={4} onChangeText={(value) => setToken(value.replace(/\D/g, "").slice(0, 4))} value={token} />
                <Button disabled={token.length !== 4} loading={verify.isPending} onPress={() => void confirm()}>{t("whatsappVerification.confirm")}</Button>
                <Button disabled={resendSeconds > 0} loading={resend.isPending} onPress={() => void resendCode()} secondary>{resendSeconds > 0 ? t("whatsappVerification.resendIn", { seconds: resendSeconds }) : t("whatsappVerification.resend")}</Button>
              </>
            ) : <Button loading={resend.isPending} onPress={() => void resendCode()} secondary>{t("whatsappVerification.receiveCode")}</Button>}
          </>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: { color: colors.ink, fontSize: 24, fontWeight: "800" },
  icon: { alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 24, height: 48, justifyContent: "center", width: 48 },
});
