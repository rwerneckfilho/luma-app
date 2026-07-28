import { useEffect, useState } from "react";
import { Alert, Linking, Share, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { useTranslation } from "react-i18next";
import { useAuth } from "../../auth/useAuth";
import {
  useNotificationPreferences,
  useResendWhatsAppVerification,
  useStartWhatsAppPhoneChange,
  useStartWhatsAppVerification,
  useUpdateNotificationPreferences,
  useUpdateUserProfile,
  useUserProfile,
  useVerifyWhatsAppPhoneChange,
  useVerifyWhatsAppVerification,
  useWhatsAppVerificationStatus,
} from "../../me/hooks";
import type { UserProfile, WhatsAppVerificationStartResponse } from "../../me/types";
import {
  getWhatsAppOtpDeliveryFeedback,
  getWhatsAppVerificationDecision,
} from "../../me/whatsappVerification";
import { createProfilePhotoSignedUrl, pickAndUploadProfilePhoto } from "../../profilePhotos/native";
import { useNotifications } from "../../notifications/useNotifications";
import { colors, spacing } from "../../design/theme";
import { Body, Button, Card, Choice, Field, Screen, Section, Sheet, StateMessage, ToggleRow, nativeStyles } from "../shared/native";
import { useVerificationCountdown } from "../shared/useVerificationCountdown";
import {
  beginWhatsAppInboundVerification,
  checkWhatsAppInboundVerification,
  isWhatsAppVerificationTokenComplete,
  normalizeWhatsAppVerificationToken,
  requestWhatsAppCodeFallback,
  shouldShowWhatsAppVerificationCode,
} from "../shared/whatsAppInboundVerification";

export function ProfileScreen() {
  const { t } = useTranslation();
  const { signOut, updatePassword, user } = useAuth();
  const profile = useUserProfile();
  const preferences = useNotificationPreferences();
  const updatePreferences = useUpdateNotificationPreferences();
  const notifications = useNotifications();
  const [editVisible, setEditVisible] = useState(false);
  const [whatsappVisible, setWhatsappVisible] = useState(false);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);

  useEffect(() => {
    if (!profile.data?.profile_photo_path) return;
    void createProfilePhotoSignedUrl(profile.data.profile_photo_path)
      .then(setPhotoUrl)
      .catch(() => setPhotoUrl(null));
  }, [profile.data?.profile_photo_path]);

  const refresh = () => {
    void profile.refetch();
    void preferences.refetch();
  };

  const changePhoto = async () => {
    if (!profile.data?.profile_photo_path) return;
    setPhotoBusy(true);
    try {
      const next = await pickAndUploadProfilePhoto(profile.data.profile_photo_path);
      if (next) setPhotoUrl(next);
    } catch (error) {
      Alert.alert(t("settings.profilePhotoUploadFailed"), error instanceof Error ? error.message : t("common.somethingWentWrong"));
    } finally {
      setPhotoBusy(false);
    }
  };

  const toggleNotifications = async (kind: "app" | "whatsapp", enabled: boolean) => {
    if (!preferences.data) return;
    try {
      if (kind === "app" && enabled && !notifications.registration) {
        await notifications.enableCurrentDevice();
      }
      await updatePreferences.mutateAsync({
        app_notifications_enabled: kind === "app" ? enabled : preferences.data.app_notifications_enabled,
        whatsapp_notifications_enabled: kind === "whatsapp" ? enabled : preferences.data.whatsapp_notifications_enabled,
      });
    } catch (error) {
      Alert.alert(t("settings.failedSaveNotifications"), error instanceof Error ? error.message : t("common.somethingWentWrong"));
    }
  };

  const shareLumaId = async () => {
    if (!profile.data) return;
    await Share.share({ message: t("settings.lumaIdShareText", { lumaId: profile.data.luma_id }) });
  };

  const logout = async () => {
    setLogoutBusy(true);
    try {
      await signOut();
    } catch {
      Alert.alert(t("settings.logout"), t("settings.logoutFailed"));
    } finally {
      setLogoutBusy(false);
    }
  };

  return (
    <Screen onRefresh={refresh} refreshing={profile.isRefetching || preferences.isRefetching} title={t("nav.profile")}>
      {profile.isLoading ? <StateMessage loading title={t("settings.loadingSettings")} /> : null}
      {profile.isError ? <StateMessage action={<Button onPress={refresh}>{t("common.tryAgain")}</Button>} title={t("settings.failedLoadProfile")} /> : null}
      {profile.data ? (
        <>
          <Card>
            <View style={styles.profileHeader}>
              <View style={styles.avatar}>
                {photoUrl ? <Image contentFit="cover" source={{ uri: photoUrl }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{initials(profile.data.full_name)}</Text>}
              </View>
              <View style={styles.flex}>
                <Text style={styles.name}>{profile.data.full_name || t("home.personFallback")}</Text>
                <Body muted>{profile.data.email || user?.email}</Body>
              </View>
            </View>
            <View style={nativeStyles.actionRow}>
              <Button loading={photoBusy} onPress={() => void changePhoto()} secondary>{t(photoUrl ? "settings.changeProfilePhoto" : "settings.addProfilePhoto")}</Button>
              <Button onPress={() => setEditVisible(true)} secondary>{t("settings.editProfile")}</Button>
            </View>
          </Card>

          <Section title={t("settings.myLumaId")}>
            <Card>
              <Text style={styles.lumaId}>{profile.data.luma_id}</Text>
              <Body muted>{t("settings.lumaIdDescription")}</Body>
              <View style={nativeStyles.actionRow}>
                <Button onPress={() => void Clipboard.setStringAsync(profile.data!.luma_id)} secondary>{t("settings.copyLumaId")}</Button>
                <Button onPress={() => void shareLumaId()} secondary>{t("settings.shareLumaId")}</Button>
              </View>
            </Card>
          </Section>

          <Section title={t("settings.notifications")}>
            {preferences.isLoading ? <StateMessage loading title={t("settings.loadingNotifications")} /> : null}
            {preferences.data ? (
              <Card>
                <ToggleRow
                  description={t("settings.appNotificationsDescription")}
                  label={t("settings.appNotifications")}
                  onValueChange={(value) => void toggleNotifications("app", value)}
                  value={preferences.data.app_notifications_enabled}
                />
                <ToggleRow
                  description={t("settings.whatsappRemindersDescription")}
                  label={t("settings.whatsappReminders")}
                  onValueChange={(value) => void toggleNotifications("whatsapp", value)}
                  value={preferences.data.whatsapp_notifications_enabled}
                />
                <Body muted>
                  {t("settings.notificationMode.title")}: {t(`settings.notificationMode.${preferences.data.notification_mode}`)}
                </Body>
                <Body muted>{preferences.data.app_ready ? t("home.appNotificationsStatus", { status: t("common.on") }) : t("home.appNotificationsStatus", { status: t("common.off") })}</Body>
                {!notifications.registration ? (
                  <Button loading={notifications.isBusy} onPress={() => void notifications.enableCurrentDevice()}>{t("settings.push.enableThisDevice")}</Button>
                ) : (
                  <>
                    <Body>{t("settings.push.thisDeviceRegistered")}</Body>
                    <View style={nativeStyles.actionRow}>
                      <Button onPress={() => void notifications.sendTest().catch((error) => Alert.alert(t("common.somethingWentWrong"), error instanceof Error ? error.message : ""))} secondary>{t("settings.push.sendTest")}</Button>
                      <Button danger loading={notifications.isBusy} onPress={() => void notifications.disableCurrentDevice()}>{t("settings.push.removeThisDevice")}</Button>
                    </View>
                  </>
                )}
                {notifications.error ? <Body>{notifications.error}</Body> : null}
              </Card>
            ) : null}
          </Section>

          <Section title={t("settings.currentWhatsapp")}>
            <Card>
              <Body>{profile.data.whatsapp_delivery_phone_e164 || profile.data.phone_e164}</Body>
              <Body muted>{profile.data.whatsapp_delivery_phone_verified_at ? t("settings.identityVerified") : t("whatsappVerification.unverifiedPhone")}</Body>
              <Button onPress={() => setWhatsappVisible(true)} secondary>{t(profile.data.whatsapp_delivery_phone_verified_at ? "settings.changeWhatsapp" : "whatsappVerification.verifyNow")}</Button>
            </Card>
          </Section>

          <Section title={t("settings.security")}>
            <Card>
              <Button onPress={() => setPasswordVisible(true)} secondary>{t("settings.changePassword")}</Button>
              <Button danger loading={logoutBusy} onPress={() => void logout()}>{t("settings.logout")}</Button>
            </Card>
          </Section>
          <Section title={t("settings.about")}>
            <Card><Body muted>{t("settings.privacyPolicy")} • {t("settings.termsOfService")} — {t("common.comingSoon")}</Body></Card>
          </Section>
        </>
      ) : null}
      <ProfileEditSheet onClose={() => setEditVisible(false)} profile={profile.data ?? null} visible={editVisible} />
      <WhatsAppSheet onClose={() => setWhatsappVisible(false)} profile={profile.data ?? null} visible={whatsappVisible} />
      <PasswordSheet onClose={() => setPasswordVisible(false)} onSave={updatePassword} visible={passwordVisible} />
    </Screen>
  );
}

function ProfileEditSheet({ onClose, profile, visible }: { onClose: () => void; profile: UserProfile | null; visible: boolean }) {
  const { t } = useTranslation();
  const mutation = useUpdateUserProfile();
  const [name, setName] = useState("");
  const [locale, setLocale] = useState("pt-BR");
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  useEffect(() => {
    if (!profile || !visible) return;
    setName(profile.full_name ?? "");
    setLocale(profile.locale);
    setTimezone(profile.timezone);
  }, [profile, visible]);
  const save = async () => {
    if (!profile) return;
    try {
      await mutation.mutateAsync({ full_name: name.trim(), locale, phone_e164: profile.phone_e164, timezone });
      onClose();
    } catch (error) {
      Alert.alert(t("settings.failedUpdateProfile"), error instanceof Error ? error.message : t("common.somethingWentWrong"));
    }
  };
  return (
    <Sheet onClose={onClose} title={t("settings.editProfile")} visible={visible}>
      <Field label={t("settings.fullName")} onChangeText={setName} value={name} />
      <Choice label={t("settings.language")} onChange={setLocale} options={[
        { label: "Português (Brasil)", value: "pt-BR" },
        { label: "English", value: "en" },
        { label: "Español", value: "es" },
      ]} value={locale} />
      <Field label={t("settings.timezone")} onChangeText={setTimezone} value={timezone} />
      <Button loading={mutation.isPending} onPress={() => void save()}>{t("common.saveChanges")}</Button>
    </Sheet>
  );
}

function WhatsAppSheet({ onClose, profile, visible }: { onClose: () => void; profile: UserProfile | null; visible: boolean }) {
  const { t } = useTranslation();
  const startVerify = useStartWhatsAppVerification();
  const verify = useVerifyWhatsAppVerification();
  const resend = useResendWhatsAppVerification();
  const startChange = useStartWhatsAppPhoneChange();
  const verifyChange = useVerifyWhatsAppPhoneChange();
  const currentProfile = useUserProfile();
  const [phone, setPhone] = useState("");
  const [token, setToken] = useState("");
  const [challenge, setChallenge] = useState<WhatsAppVerificationStartResponse | null>(null);
  const [changing, setChanging] = useState(false);
  const [codeRequested, setCodeRequested] = useState(false);
  const { resendSeconds } = useVerificationCountdown(challenge);
  const applyVerificationState = (state: {
    challenge: WhatsAppVerificationStartResponse;
    codeRequested: boolean;
    token: string;
  }) => {
    setChallenge(state.challenge);
    setCodeRequested(state.codeRequested);
    setToken(state.token);
  };
  const verificationStatus = useWhatsAppVerificationStatus(
    challenge ? (changing ? "phone_change" : "onboarding") : undefined,
    challenge?.verification_id,
  );
  const verificationDecision = getWhatsAppVerificationDecision(
    verificationStatus.data,
    challenge?.verification_id,
  );

  useEffect(() => {
    if (!profile || !visible) return;
    setPhone(profile.whatsapp_delivery_phone_e164 ?? profile.phone_e164);
    setToken("");
    setChallenge(null);
    setCodeRequested(false);
    setChanging(Boolean(profile.whatsapp_delivery_phone_verified_at));
  }, [profile, visible]);

  useEffect(() => {
    if (!visible || verificationDecision === "waiting") return;
    setToken("");
    setChallenge(null);
    setCodeRequested(false);
    if (verificationDecision === "verified") {
      void currentProfile.refetch();
      onClose();
      return;
    }
    Alert.alert(
      t("whatsappVerification.challengeEndedTitle"),
      t("whatsappVerification.challengeEndedMessage"),
    );
  }, [
    currentProfile,
    onClose,
    t,
    verificationDecision,
    visible,
  ]);

  const close = () => {
    setToken("");
    setChallenge(null);
    onClose();
  };

  const start = async () => {
    try {
      await beginWhatsAppInboundVerification({
        onStarted: applyVerificationState,
        openUrl: (url) => Linking.openURL(url),
        start: () => changing
          ? startChange.mutateAsync({ new_phone_e164: phone.replace(/\D/g, "") })
          : startVerify.mutateAsync({ phone_e164: phone.replace(/\D/g, ""), purpose: "onboarding" }),
      });
    } catch (error) {
      Alert.alert(t("common.somethingWentWrong"), error instanceof Error ? error.message : t("common.somethingWentWrong"));
    }
  };

  const submit = async () => {
    if (!challenge) return;
    try {
      if (changing) await verifyChange.mutateAsync({ token, verification_id: challenge.verification_id });
      else await verify.mutateAsync({ token, verification_id: challenge.verification_id });
      close();
    } catch (error) {
      Alert.alert(t("common.somethingWentWrong"), error instanceof Error ? error.message : t("common.somethingWentWrong"));
    }
  };

  const resendCode = async () => {
    try {
      await requestWhatsAppCodeFallback({
        challenge,
        onRequested: applyVerificationState,
        resend: (payload) => resend.mutateAsync(payload),
        resendSeconds,
      });
    } catch (error) {
      Alert.alert(t("common.somethingWentWrong"), error instanceof Error ? error.message : "");
    }
  };

  const checkInbound = async () => {
    await checkWhatsAppInboundVerification({
      baselineVerifiedAt: profile?.whatsapp_delivery_phone_verified_at,
      onPending: () => Alert.alert(t("whatsappVerification.pendingTitle"), t("whatsappVerification.pendingMessage")),
      onVerified: close,
      refetchProfile: () => currentProfile.refetch(),
      requireNewTimestamp: changing,
    });
  };

  return (
    <Sheet onClose={close} title={t("settings.changeWhatsapp")} visible={visible}>
      <ToggleRow
        label={t("whatsappVerification.changeNumber")}
        onValueChange={(value) => {
          setChanging(value);
          setChallenge(null);
          setToken("");
          setCodeRequested(false);
          setPhone(value
            ? profile?.whatsapp_delivery_phone_e164 ?? profile?.phone_e164 ?? ""
            : profile?.phone_e164 ?? "");
        }}
        value={changing}
      />
      <Field keyboardType="phone-pad" label={t("settings.phoneNumber")} onChangeText={setPhone} value={phone} />
      {!challenge ? <Button loading={startVerify.isPending || startChange.isPending} onPress={() => void start()}>{t("whatsappVerification.sendMessage")}</Button> : (
        <>
          <Body muted>{t("whatsappVerification.sendMessageInstructions")}</Body>
          <Button onPress={() => void Linking.openURL(challenge.fallback_url)}>{t("whatsappVerification.openWhatsApp")}</Button>
          <Button loading={currentProfile.isRefetching} onPress={() => void checkInbound()} secondary>{t("whatsappVerification.messageSent")}</Button>
          {shouldShowWhatsAppVerificationCode({ codeRequested }) ? (
            <>
              <Body muted>
                {t(
                  getWhatsAppOtpDeliveryFeedback(challenge.delivery_status) === "sent"
                    ? "whatsappVerification.sent"
                    : "whatsappVerification.deliveryUnknown",
                )}
              </Body>
              <Field keyboardType="number-pad" label={t("whatsappVerification.codeLabel")} maxLength={4} onChangeText={(value) => setToken(normalizeWhatsAppVerificationToken(value))} value={token} />
              <Button disabled={!isWhatsAppVerificationTokenComplete(token)} loading={verify.isPending || verifyChange.isPending} onPress={() => void submit()}>{t("whatsappVerification.confirm")}</Button>
              <Button disabled={resendSeconds > 0} loading={resend.isPending} onPress={() => void resendCode()} secondary>
                {resendSeconds > 0 ? t("whatsappVerification.resendIn", { seconds: resendSeconds }) : t("whatsappVerification.resend")}
              </Button>
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
    </Sheet>
  );
}

function PasswordSheet({ onClose, onSave, visible }: { onClose: () => void; onSave: (password: string) => Promise<void>; visible: boolean }) {
  const { t } = useTranslation();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!visible) return;
    setPassword("");
    setConfirm("");
    setBusy(false);
  }, [visible]);
  const close = () => {
    setPassword("");
    setConfirm("");
    onClose();
  };
  const save = async () => {
    if (password.length < 8 || password !== confirm) {
      Alert.alert(t(password !== confirm ? "validation.passwordsDoNotMatch" : "validation.passwordMin"));
      return;
    }
    setBusy(true);
    try {
      await onSave(password);
      setPassword("");
      setConfirm("");
      close();
    } catch (error) {
      Alert.alert(t("common.somethingWentWrong"), error instanceof Error ? error.message : "");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Sheet onClose={close} title={t("settings.changePassword")} visible={visible}>
      <Field label={t("auth.password")} onChangeText={setPassword} secureTextEntry value={password} />
      <Field label={t("auth.confirmNewPassword")} onChangeText={setConfirm} secureTextEntry value={confirm} />
      <Button loading={busy} onPress={() => void save()}>{t("common.save")}</Button>
    </Sheet>
  );
}

function initials(name?: string | null) {
  return (name ?? "LUMA").split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("");
}

const styles = StyleSheet.create({
  avatar: { alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 42, height: 84, justifyContent: "center", overflow: "hidden", width: 84 },
  avatarImage: { height: 84, width: 84 },
  avatarText: { color: colors.primary, fontSize: 26, fontWeight: "800" },
  flex: { flex: 1 },
  lumaId: { color: colors.primary, fontSize: 28, fontWeight: "900", letterSpacing: 2 },
  name: { color: colors.ink, fontSize: 22, fontWeight: "800" },
  profileHeader: { alignItems: "center", flexDirection: "row", gap: spacing.lg },
});
