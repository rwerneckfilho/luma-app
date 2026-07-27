import { useEffect, useState } from "react";
import { Alert, Linking, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useTranslation } from "react-i18next";
import {
  useCompleteOnboarding,
  useResendWhatsAppVerification,
  useSendSampleReminder,
  useStartWhatsAppVerification,
  useUpdateNotificationPreferences,
  useUserProfile,
  useVerifyWhatsAppVerification,
  useWhatsAppVerificationStatus,
} from "../../me/hooks";
import { useNotifications } from "../../notifications/useNotifications";
import { useMedications } from "../../medications/hooks";
import { useRoutines } from "../../routines/hooks";
import {
  useCreateCareRelationship,
  useLookupCareUserByLumaId,
} from "../../care/hooks";
import type { CarePublicUser } from "../../care/types";
import type { WhatsAppVerificationStartResponse } from "../../me/types";
import {
  getWhatsAppOtpDeliveryFeedback,
  getWhatsAppVerificationDecision,
} from "../../me/whatsappVerification";
import { env } from "../../config/env";
import { colors, spacing } from "../../design/theme";
import { Body, Button, Card, Choice, Field, Screen, StateMessage, nativeStyles } from "../shared/native";
import { useVerificationCountdown } from "../shared/useVerificationCountdown";
import { MedicationEditorSheet } from "../medications/MedicationEditorSheet";

type ChannelChoice = "app_only" | "whatsapp_only" | "both";

export function OnboardingScreen() {
  const { t } = useTranslation();
  const profile = useUserProfile();
  const medications = useMedications();
  const routines = useRoutines();
  const updatePreferences = useUpdateNotificationPreferences();
  const sample = useSendSampleReminder();
  const complete = useCompleteOnboarding();
  const notifications = useNotifications();
  const [step, setStep] = useState(0);
  const [channel, setChannel] = useState<ChannelChoice>("app_only");
  const [medicationVisible, setMedicationVisible] = useState(false);
  const whatsappVerificationRequired =
    env.whatsappVerificationRequired &&
    (profile.data?.onboarding?.whatsapp_verification_required ?? true);

  if (profile.isLoading) return <Screen><StateMessage loading title={t("common.loading")} /></Screen>;
  if (profile.isError) {
    return (
      <Screen title="LUMA">
        <StateMessage
          action={<Button onPress={() => void profile.refetch()}>{t("common.tryAgain")}</Button>}
          title={t("settings.failedLoadProfile")}
        />
      </Screen>
    );
  }

  const saveChannels = async () => {
    try {
      if (channel !== "whatsapp_only" && !notifications.registration) {
        await notifications.enableCurrentDevice();
      }
      await updatePreferences.mutateAsync({
        app_notifications_enabled: channel !== "whatsapp_only",
        whatsapp_notifications_enabled: channel !== "app_only",
      });
      setStep(1);
    } catch (error) {
      Alert.alert(t("onboarding.notifications.appSetupFailed"), error instanceof Error ? error.message : t("common.somethingWentWrong"));
    }
  };

  const finish = async () => {
    try {
      await complete.mutateAsync();
      router.replace("/(app)/home");
    } catch (error) {
      Alert.alert(t("common.somethingWentWrong"), error instanceof Error ? error.message : t("common.somethingWentWrong"));
    }
  };

  return (
    <Screen title="LUMA">
      <Text style={styles.step}>{t("onboarding.progress", { current: step + 1, total: 5 })}</Text>
      {step === 0 ? (
        <Card>
          <Text style={styles.heading}>{t("onboarding.notifications.title")}</Text>
          <Body muted>{t("onboarding.notifications.description")}</Body>
          <Choice<ChannelChoice>
            label={t("settings.notificationMode.title")}
            onChange={setChannel}
            options={[
              { label: t("onboarding.notifications.options.app_only"), value: "app_only" },
              { label: t("onboarding.notifications.options.whatsapp_only"), value: "whatsapp_only" },
              { label: t("onboarding.notifications.options.both"), value: "both" },
            ]}
            value={channel}
          />
          <Button loading={updatePreferences.isPending || notifications.isBusy} onPress={() => void saveChannels()}>{t("common.continue")}</Button>
        </Card>
      ) : null}
      {step === 1 ? (
        (channel === "app_only" && !whatsappVerificationRequired) ||
        profile.data?.whatsapp_delivery_phone_verified_at ? (
          <Card>
            <Text style={styles.heading}>{t("whatsappVerification.verifiedPhone")}</Text>
            <Body muted>{channel === "app_only" ? t("onboarding.notifications.skipWhatsApp") : profile.data?.whatsapp_delivery_phone_e164}</Body>
            <Button onPress={() => setStep(2)}>{t("common.continue")}</Button>
          </Card>
        ) : (
          <OnboardingWhatsApp
            onVerified={() => {
              void profile.refetch();
              setStep(2);
            }}
            phone={profile.data?.phone_e164 ?? ""}
          />
        )
      ) : null}
      {step === 2 ? (
        <Card>
          <Text style={styles.heading}>{t("onboarding.medication.title")}</Text>
          <Body muted>{t("onboarding.medication.description")}</Body>
          <Body>{t("onboarding.medication.fullFlowDescription")}</Body>
          <Button onPress={() => setMedicationVisible(true)}>{t("medications.addCta")}</Button>
          <Button
            disabled={!medications.data?.length || !routines.data?.length}
            onPress={() => setStep(3)}
            secondary
          >
            {t("common.continue")}
          </Button>
        </Card>
      ) : null}
      {step === 3 ? (
        <Card>
          <Text style={styles.heading}>{t("onboarding.sample.title")}</Text>
          <Body muted>{t("onboarding.sample.description")}</Body>
          <Button loading={sample.isPending} onPress={() => void sample.mutateAsync().then(() => setStep(4)).catch((error) => Alert.alert(t("common.somethingWentWrong"), error instanceof Error ? error.message : t("common.somethingWentWrong")))}>{t("onboarding.sample.send")}</Button>
          <Button onPress={() => setStep(4)} secondary>{t("common.continue")}</Button>
        </Card>
      ) : null}
      {step === 4 ? <OnboardingCare onFinish={() => void finish()} finishing={complete.isPending} /> : null}
      <MedicationEditorSheet onClose={() => { setMedicationVisible(false); void medications.refetch(); void routines.refetch(); }} visible={medicationVisible} />
    </Screen>
  );
}

function OnboardingWhatsApp({ onVerified, phone }: { onVerified: () => void; phone: string }) {
  const { t } = useTranslation();
  const start = useStartWhatsAppVerification();
  const verify = useVerifyWhatsAppVerification();
  const resend = useResendWhatsAppVerification();
  const profile = useUserProfile();
  const [challenge, setChallenge] = useState<WhatsAppVerificationStartResponse | null>(null);
  const [token, setToken] = useState("");
  const [codeRequested, setCodeRequested] = useState(false);
  const { resendSeconds } = useVerificationCountdown(challenge);
  const verificationStatus = useWhatsAppVerificationStatus(
    challenge ? "onboarding" : undefined,
    challenge?.verification_id,
  );
  const verificationDecision = getWhatsAppVerificationDecision(
    verificationStatus.data,
    challenge?.verification_id,
  );

  useEffect(() => {
    if (verificationDecision === "waiting") return;
    setChallenge(null);
    setToken("");
    setCodeRequested(false);
    if (verificationDecision === "verified") {
      onVerified();
      return;
    }
    Alert.alert(
      t("whatsappVerification.challengeEndedTitle"),
      t("whatsappVerification.challengeEndedMessage"),
    );
  }, [onVerified, t, verificationDecision]);

  const begin = async () => {
    try {
      const started = await start.mutateAsync({ phone_e164: phone, purpose: "onboarding" });
      setChallenge(started);
      await Linking.openURL(started.fallback_url);
    } catch (error) {
      Alert.alert(t("common.somethingWentWrong"), error instanceof Error ? error.message : "");
    }
  };
  const confirm = async () => {
    if (!challenge) return;
    try {
      await verify.mutateAsync({ token, verification_id: challenge.verification_id });
      onVerified();
    } catch (error) {
      Alert.alert(t("common.somethingWentWrong"), error instanceof Error ? error.message : "");
    }
  };
  const resendCode = async () => {
    if (!challenge || resendSeconds > 0) return;
    try {
      setChallenge(await resend.mutateAsync({ verification_id: challenge.verification_id }));
      setToken("");
      setCodeRequested(true);
    } catch (error) {
      Alert.alert(t("common.somethingWentWrong"), error instanceof Error ? error.message : "");
    }
  };
  const checkInbound = async () => {
    const result = await profile.refetch();
    if (result.data?.whatsapp_delivery_phone_verified_at) onVerified();
    else Alert.alert(t("whatsappVerification.pendingTitle"), t("whatsappVerification.pendingMessage"));
  };
  return (
    <Card>
      <Text style={styles.heading}>{t("whatsappVerification.title")}</Text>
      <Body>{phone}</Body>
      {!challenge ? <Button loading={start.isPending} onPress={() => void begin()}>{t("whatsappVerification.sendMessage")}</Button> : (
        <>
          <Body muted>{t("whatsappVerification.sendMessageInstructions")}</Body>
          <Button onPress={() => void Linking.openURL(challenge.fallback_url)}>{t("whatsappVerification.openWhatsApp")}</Button>
          <Button loading={profile.isRefetching} onPress={() => void checkInbound()} secondary>{t("whatsappVerification.messageSent")}</Button>
          {codeRequested ? (
            <>
              <Body muted>
                {t(
                  getWhatsAppOtpDeliveryFeedback(challenge.delivery_status) === "sent"
                    ? "whatsappVerification.sent"
                    : "whatsappVerification.deliveryUnknown",
                )}
              </Body>
              <Field keyboardType="number-pad" label={t("whatsappVerification.codeLabel")} maxLength={4} onChangeText={(value) => setToken(value.replace(/\D/g, "").slice(0, 4))} value={token} />
              <View style={nativeStyles.actionRow}>
                <Button disabled={token.length !== 4} loading={verify.isPending} onPress={() => void confirm()}>{t("whatsappVerification.confirm")}</Button>
                <Button disabled={resendSeconds > 0} loading={resend.isPending} onPress={() => void resendCode()} secondary>
                  {resendSeconds > 0 ? t("whatsappVerification.resendIn", { seconds: resendSeconds }) : t("whatsappVerification.resend")}
                </Button>
              </View>
            </>
          ) : (
            <Button
              disabled={resendSeconds > 0}
              loading={resend.isPending}
              onPress={() => void resendCode()}
              secondary
            >
              {resendSeconds > 0
                ? t("whatsappVerification.resendIn", { seconds: resendSeconds })
                : t("whatsappVerification.receiveCode")}
            </Button>
          )}
        </>
      )}
    </Card>
  );
}

function OnboardingCare({ finishing, onFinish }: { finishing: boolean; onFinish: () => void }) {
  const { t } = useTranslation();
  const lookup = useLookupCareUserByLumaId();
  const create = useCreateCareRelationship();
  const [lumaId, setLumaId] = useState("");
  const [found, setFound] = useState<CarePublicUser | null>(null);
  const find = async () => {
    setFound(null);
    const normalizedLumaId = lumaId.trim();
    if (!normalizedLumaId) {
      Alert.alert(t("settings.careLumaIdRequired"));
      return;
    }
    try { setFound(await lookup.mutateAsync(normalizedLumaId)); }
    catch (error) {
      setFound(null);
      Alert.alert(t("settings.careLookupFailed"), error instanceof Error ? error.message : "");
    }
  };
  const invite = async () => {
    if (!found || found.invite_block_reason) return;
    try {
      await create.mutateAsync({
        caregiver_luma_id: found.luma_id,
        duration_type: "indefinite",
        permissions: {
          allow_manage_routines: false,
          allow_mark_patient_taken: false,
          allow_receive_overdue: false,
          allow_receive_together: false,
          allow_skip_patient_dose: false,
          allow_view_timeline: false,
        },
        relationship_type: "family",
        scope: { medication_ids: [], medication_scope: "all_medications" },
      });
      onFinish();
    } catch (error) {
      Alert.alert(t("settings.careInviteFailed"), error instanceof Error ? error.message : "");
    }
  };
  return (
    <Card>
      <Text style={styles.heading}>{t("onboarding.caregiver.title")}</Text>
      <Body muted>{t("onboarding.caregiver.description")}</Body>
      <Field
        label={t("settings.caregiverLumaId")}
        onChangeText={(value) => {
          setLumaId(value);
          setFound(null);
        }}
        value={lumaId}
      />
      <Button loading={lookup.isPending} onPress={() => void find()} secondary>{t("settings.verifyLumaId")}</Button>
      {found ? (
        <Card>
          <Text style={styles.heading}>{found.display_name}</Text>
          <Body muted>{found.luma_id}</Body>
          {found.invite_block_reason ? (
            <Body>{t(onboardingCareBlockKey(found.invite_block_reason))}</Body>
          ) : (
            <Button loading={create.isPending} onPress={() => void invite()}>{t("settings.sendCareInvite")}</Button>
          )}
        </Card>
      ) : null}
      <Button loading={finishing} onPress={onFinish}>{t("onboarding.finish")}</Button>
    </Card>
  );
}

function onboardingCareBlockKey(reason: NonNullable<CarePublicUser["invite_block_reason"]>) {
  return {
    active_caregiver: "settings.careInviteBlockedActiveCaregiver",
    pending_invite: "settings.careInviteBlockedPendingInvite",
    self: "settings.careInviteBlockedSelf",
  }[reason];
}

const styles = StyleSheet.create({
  heading: { color: colors.ink, fontSize: 22, fontWeight: "800" },
  step: { color: colors.primary, fontSize: 14, fontWeight: "800", marginBottom: spacing.sm },
});
