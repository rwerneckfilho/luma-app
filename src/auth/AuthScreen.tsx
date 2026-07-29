import type { ComponentType, PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  type TextInputProps,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { colors, fonts, layout, radii, shadows, spacing } from "../design/theme";
import { LumaLogo } from "../features/shared/LumaLogo";

export function AuthScreen({ children, footer }: PropsWithChildren<{ footer?: ReactNode }>) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <View style={styles.brandWrap}><LumaLogo /></View>
            {children}
            {footer ? <View style={styles.footer}>{footer}</View> : null}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function AuthHeading({ title, subtitle }: { subtitle?: string; title: string }) {
  return (
    <View style={styles.heading}>
      <Text accessibilityRole="header" style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

export function AuthField({ error, icon: Icon, label, ...props }: TextInputProps & { error?: string; icon?: ComponentType<{ color?: string; size?: number }>; label: string }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.inputWrap, error ? styles.inputError : null]}>
        {Icon ? <Icon color={colors.muted} size={20} /> : null}
        <TextInput accessibilityLabel={label} placeholderTextColor={colors.muted} style={styles.input} {...props} />
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

export function AuthAccessOptions({ activeMode, onChange }: { activeMode: "account" | "code"; onChange: (mode: "account" | "code") => void }) {
  const { t } = useTranslation();
  return (
    <View accessibilityLabel={t("auth.accessOptions")} accessibilityRole="tablist" style={styles.accessOptions}>
      {(["account", "code"] as const).map((mode) => (
        <Pressable accessibilityRole="tab" accessibilityState={{ selected: activeMode === mode }} key={mode} onPress={() => onChange(mode)} style={[styles.accessOption, activeMode === mode && styles.accessOptionActive]}>
          <Text style={[styles.accessOptionText, activeMode === mode && styles.accessOptionTextActive]}>{t(mode === "account" ? "auth.alreadyHaveAccountOption" : "auth.haveAccessCodeOption")}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function AuthButton({
  disabled,
  loading,
  onPress,
  title,
  variant = "primary",
}: {
  disabled?: boolean;
  loading?: boolean;
  onPress: () => void;
  title: string;
  variant?: "primary" | "secondary";
}) {
  const blocked = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={blocked}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === "secondary" ? styles.buttonSecondary : styles.buttonPrimary,
        pressed && !blocked ? styles.buttonPressed : null,
        blocked ? styles.buttonDisabled : null,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? "#FFFFFF" : colors.primary} />
      ) : (
        <Text style={variant === "primary" ? styles.buttonTextPrimary : styles.buttonTextSecondary}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function AuthFeedback({ message, tone = "error" }: { message?: string | null; tone?: "error" | "success" }) {
  if (!message) return null;
  return (
    <View accessibilityLiveRegion="polite" style={[styles.feedback, tone === "success" ? styles.success : styles.error]}>
      <Text style={tone === "success" ? styles.successText : styles.errorText}>{message}</Text>
    </View>
  );
}

export const authStyles = StyleSheet.create({
  link: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: 15, paddingVertical: spacing.sm },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, justifyContent: "center" },
  stack: { gap: spacing.lg },
  text: { color: colors.muted, fontFamily: fonts.body, fontSize: 15, lineHeight: 22, textAlign: "center" },
});

const styles = StyleSheet.create({
  brandWrap: { alignItems: "flex-start", marginBottom: spacing.sm },
  accessOption: { alignItems: "center", borderRadius: radii.sm, flex: 1, justifyContent: "center", minHeight: 44, paddingHorizontal: spacing.md },
  accessOptionActive: { backgroundColor: colors.primary },
  accessOptionText: { color: colors.primary, fontFamily: fonts.bodySemibold, fontSize: 14 },
  accessOptionTextActive: { color: colors.surface },
  accessOptions: { backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, flexDirection: "row", gap: spacing.xs, padding: spacing.xs },
  button: { alignItems: "center", borderRadius: radii.pill, justifyContent: "center", minHeight: 50, paddingHorizontal: spacing.lg },
  buttonDisabled: { opacity: 0.55 },
  buttonPressed: { transform: [{ scale: 0.99 }] },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonSecondary: { backgroundColor: colors.surface, borderColor: colors.primary, borderWidth: 1 },
  buttonTextPrimary: { color: "#FFFFFF", fontFamily: fonts.bodyBold, fontSize: 16 },
  buttonTextSecondary: { color: colors.primary, fontFamily: fonts.bodyBold, fontSize: 16 },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, gap: spacing.xl, padding: spacing.xl, ...shadows.card },
  error: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  errorText: { color: colors.danger, fontSize: 13, lineHeight: 18 },
  feedback: { borderRadius: radii.sm, borderWidth: 1, padding: spacing.md },
  fieldWrap: { gap: spacing.sm },
  flex: { flex: 1 },
  footer: { alignItems: "center", borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.lg },
  heading: { gap: spacing.sm },
  input: { color: colors.ink, flex: 1, fontSize: 16, minHeight: 48, paddingVertical: 0 },
  inputError: { borderColor: colors.danger },
  inputWrap: { alignItems: "center", backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, flexDirection: "row", gap: spacing.md, minHeight: 50, paddingHorizontal: spacing.lg },
  label: { color: colors.ink, fontFamily: fonts.bodySemibold, fontSize: 14 },
  safeArea: { backgroundColor: colors.background, flex: 1 },
  scrollContent: { alignSelf: "center", flexGrow: 1, justifyContent: "center", maxWidth: layout.tabletBreakpoint, padding: spacing.xl, width: "100%" },
  subtitle: { color: colors.muted, fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  success: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  successText: { color: colors.primary, fontSize: 13, lineHeight: 18 },
  title: { color: colors.ink, fontFamily: fonts.headingBold, fontSize: 28, lineHeight: 34 },
});
