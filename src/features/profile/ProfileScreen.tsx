import { useEffect, useState } from "react";
import { Alert, Linking, Share, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Image } from "expo-image";
import { Bell, Globe2, Info, KeyRound, UserRound } from "lucide-react-native";
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
} from "../../me/hooks";
import type { UserProfile, WhatsAppVerificationStartResponse } from "../../me/types";
import { createProfilePhotoSignedUrl, pickAndUploadProfilePhoto } from "../../profilePhotos/native";
import { useNotifications } from "../../notifications/useNotifications";
import { colors, fonts, radii, spacing } from "../../design/theme";
import { Accordion, Body, Button, Card, Choice, Field, Screen, Section, Sheet, StateMessage, ToggleRow, nativeStyles } from "../shared/native";
import { useVerificationCountdown } from "../shared/useVerificationCountdown";

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
    if (kind === "whatsapp" && enabled && !preferences.data.whatsapp_verified) {
      setWhatsappVisible(true);
      return;
    }
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
          <View style={styles.profileHero}>
            <View style={styles.avatarFrame}>
              <View style={styles.avatar}>
                {photoUrl ? <Image contentFit="cover" source={{ uri: photoUrl }} style={styles.avatarImage} /> : <Text style={styles.avatarText}>{initials(profile.data.full_name)}</Text>}
              </View>
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.name}>{profile.data.full_name || t("home.personFallback")}</Text>
              <Body muted>{profile.data.email || user?.email}</Body>
            </View>
            <View style={nativeStyles.actionRow}>
              <Button loading={photoBusy} onPress={() => void changePhoto()} secondary>{t(photoUrl ? "settings.changeProfilePhoto" : "settings.addProfilePhoto")}</Button>
              <Button onPress={() => setEditVisible(true)} secondary>{t("settings.editProfile")}</Button>
            </View>
          </View>

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

          <Section title={t("settings.account")}>
            <Accordion
              defaultExpanded
              icon={UserRound}
              subtitle={profile.data.email || user?.email || undefined}
              title={t("settings.account")}
            >
              <View style={styles.detailRow}>
                <View style={styles.flex}>
                  <Text style={styles.detailLabel}>{t("settings.fullName")}</Text>
                  <Body muted>{profile.data.full_name || t("home.personFallback")}</Body>
                </View>
                <Button onPress={() => setEditVisible(true)} variant="ghost">{t("common.edit")}</Button>
              </View>
              <View style={styles.detailRow}>
                <View style={styles.flex}>
                  <Text style={styles.detailLabel}>{t("settings.email")}</Text>
                  <Body muted>{profile.data.email || user?.email}</Body>
                </View>
              </View>
              <View style={styles.divider} />
              <Text style={styles.detailLabel}>{t("settings.currentWhatsapp")}</Text>
              <Body>{profile.data.whatsapp_delivery_phone_e164 || profile.data.phone_e164}</Body>
              <Body muted>{profile.data.whatsapp_delivery_phone_verified_at ? t("settings.identityVerified") : t("whatsappVerification.unverifiedPhone")}</Body>
              <Button onPress={() => setWhatsappVisible(true)} secondary>{t(profile.data.whatsapp_delivery_phone_verified_at ? "settings.changeWhatsapp" : "whatsappVerification.verifyNow")}</Button>
            </Accordion>

            <Accordion icon={Bell} title={t("settings.notifications")}>
              {preferences.isLoading ? <StateMessage loading title={t("settings.loadingNotifications")} /> : null}
              {preferences.data ? (
                <>
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
                  value={preferences.data.whatsapp_verified && preferences.data.whatsapp_notifications_enabled}
                />
                {!preferences.data.whatsapp_verified ? <Body muted>{t("whatsappVerification.unverifiedPhone")}</Body> : null}
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
                <Body muted>{t("settings.notificationFootnote")}</Body>
                </>
              ) : null}
            </Accordion>

            <Accordion icon={Globe2} title={t("settings.regionalLanguage")}>
              <View style={styles.detailRow}>
                <View style={styles.flex}>
                  <Text style={styles.detailLabel}>{t("settings.language")}</Text>
                  <Body muted>{localeName(profile.data.locale)}</Body>
                </View>
              </View>
              <View style={styles.detailRow}>
                <View style={styles.flex}>
                  <Text style={styles.detailLabel}>{t("settings.timezone")}</Text>
                  <Body muted>{profile.data.timezone}</Body>
                </View>
                <Button onPress={() => setEditVisible(true)} variant="ghost">{t("common.edit")}</Button>
              </View>
            </Accordion>

            <Accordion icon={KeyRound} title={t("settings.security")}>
              <Button onPress={() => setPasswordVisible(true)} secondary>{t("settings.changePassword")}</Button>
              <Button danger loading={logoutBusy} onPress={() => void logout()}>{t("settings.logout")}</Button>
            </Accordion>

            <Accordion icon={Info} title={t("settings.about")}>
              <Body muted>{t("settings.privacyPolicy")} • {t("settings.termsOfService")} - {t("common.comingSoon")}</Body>
            </Accordion>
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
  const [nameError, setNameError] = useState<string | null>(null);
  const [timezoneError, setTimezoneError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  useEffect(() => {
    if (!profile || !visible) return;
    setName(profile.full_name ?? "");
    setLocale(profile.locale);
    setTimezone(profile.timezone);
    setNameError(null);
    setTimezoneError(null);
    setSaveError(null);
  }, [profile, visible]);
  const save = async () => {
    if (!profile) return;
    const trimmedName = name.trim();
    const nextNameError = trimmedName ? null : t("validation.fullNameRequired");
    const nextTimezoneError = isValidTimezone(timezone) ? null : t("validation.timezoneRequired");
    setNameError(nextNameError);
    setTimezoneError(nextTimezoneError);
    setSaveError(null);
    if (nextNameError || nextTimezoneError) return;
    try {
      await mutation.mutateAsync({ full_name: trimmedName, locale, phone_e164: profile.phone_e164, timezone: timezone.trim() });
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : t("common.somethingWentWrong"));
    }
  };
  return (
    <Sheet onClose={onClose} title={t("settings.editProfile")} visible={visible}>
      {saveError ? <Body>{saveError}</Body> : null}
      <Field error={nameError ?? undefined} label={t("settings.fullName")} onChangeText={(value) => { setName(value); setNameError(null); }} value={name} />
      <Choice label={t("settings.language")} onChange={setLocale} options={[
        { label: "Português (Brasil)", value: "pt-BR" },
        { label: "English", value: "en" },
        { label: "Español", value: "es" },
      ]} value={locale} />
      <Field autoCapitalize="none" error={timezoneError ?? undefined} label={t("settings.timezone")} onChangeText={(value) => { setTimezone(value); setTimezoneError(null); }} value={timezone} />
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

  useEffect(() => {
    if (!profile || !visible) return;
    setPhone(profile.whatsapp_delivery_phone_e164 ?? profile.phone_e164);
    setToken("");
    setChallenge(null);
    setCodeRequested(false);
    setChanging(Boolean(profile.whatsapp_delivery_phone_verified_at));
  }, [profile, visible]);

  const close = () => {
    setToken("");
    setChallenge(null);
    onClose();
  };

  const start = async () => {
    try {
      const result = changing
        ? await startChange.mutateAsync({ new_phone_e164: phone.replace(/\D/g, "") })
        : await startVerify.mutateAsync({ phone_e164: phone.replace(/\D/g, ""), purpose: "onboarding" });
      setChallenge(result);
      await Linking.openURL(result.fallback_url);
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
    const result = await currentProfile.refetch();
    const verifiedAt = result.data?.whatsapp_delivery_phone_verified_at;
    const verificationChanged = verifiedAt && verifiedAt !== profile?.whatsapp_delivery_phone_verified_at;
    if ((!changing && verifiedAt) || verificationChanged) close();
    else Alert.alert(t("whatsappVerification.pendingTitle"), t("whatsappVerification.pendingMessage"));
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
          {codeRequested ? (
            <>
              <Body muted>{t("whatsappVerification.sent")}</Body>
              <Field keyboardType="number-pad" label={t("whatsappVerification.codeLabel")} maxLength={4} onChangeText={(value) => setToken(value.replace(/\D/g, "").slice(0, 4))} value={token} />
              <Button disabled={token.length !== 4} loading={verify.isPending || verifyChange.isPending} onPress={() => void submit()}>{t("whatsappVerification.confirm")}</Button>
              <Button disabled={resendSeconds > 0} loading={resend.isPending} onPress={() => void resendCode()} secondary>
                {resendSeconds > 0 ? t("whatsappVerification.resendIn", { seconds: resendSeconds }) : t("whatsappVerification.resend")}
              </Button>
            </>
          ) : (
            <Button loading={resend.isPending} onPress={() => void resendCode()} secondary>{t("whatsappVerification.receiveCode")}</Button>
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

function localeName(locale: string) {
  if (locale === "pt-BR") return "Português (Brasil)";
  if (locale === "es") return "Español";
  return "English";
}

function isValidTimezone(value: string) {
  const timezone = value.trim();
  if (!timezone || !timezone.includes("/")) return false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}

const styles = StyleSheet.create({
  avatar: { alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: 54, height: 108, justifyContent: "center", overflow: "hidden", width: 108 },
  avatarFrame: { borderColor: colors.surface, borderRadius: 58, borderWidth: 4 },
  avatarImage: { height: 108, width: 108 },
  avatarText: { color: colors.primary, fontFamily: fonts.headingBold, fontSize: 32 },
  detailLabel: { color: colors.ink, fontFamily: fonts.bodySemibold, fontSize: 14 },
  detailRow: { alignItems: "center", flexDirection: "row", gap: spacing.md, justifyContent: "space-between" },
  divider: { backgroundColor: colors.border, height: StyleSheet.hairlineWidth },
  flex: { flex: 1 },
  heroCopy: { alignItems: "center", gap: spacing.xs },
  lumaId: { color: colors.primary, fontFamily: fonts.headingBold, fontSize: 28, letterSpacing: 2 },
  name: { color: colors.ink, fontFamily: fonts.headingBold, fontSize: 26, textAlign: "center" },
  profileHero: { alignItems: "center", backgroundColor: colors.surfaceMuted, borderRadius: radii.md, gap: spacing.md, padding: spacing.xl },
});
