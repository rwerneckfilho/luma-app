import type { PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator,
  Image,
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
import { colors, radii, spacing } from "../design/theme";

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
          <View style={styles.brandWrap}>
            <Image
              accessibilityLabel="Luma"
              resizeMode="contain"
              source={require("../../assets/images/luma-logo.png")}
              style={styles.brand}
            />
          </View>
          <View style={styles.card}>{children}</View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
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

export function AuthField({ error, label, ...props }: TextInputProps & { error?: string; label: string }) {
  return (
    <View style={styles.fieldWrap}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.muted}
        style={[styles.input, error ? styles.inputError : null]}
        {...props}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
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
  link: { color: colors.primary, fontSize: 15, fontWeight: "700", paddingVertical: spacing.sm },
  row: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, justifyContent: "center" },
  stack: { gap: spacing.lg },
  text: { color: colors.muted, fontSize: 15, lineHeight: 22, textAlign: "center" },
});

const styles = StyleSheet.create({
  brand: { height: 74, width: 240 },
  brandWrap: { alignItems: "center", marginBottom: spacing.xl },
  button: { alignItems: "center", borderRadius: radii.md, justifyContent: "center", minHeight: 52, paddingHorizontal: spacing.lg },
  buttonDisabled: { opacity: 0.55 },
  buttonPressed: { transform: [{ scale: 0.99 }] },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonSecondary: { backgroundColor: colors.surface, borderColor: colors.primary, borderWidth: 1 },
  buttonTextPrimary: { color: "#FFFFFF", fontSize: 16, fontWeight: "700" },
  buttonTextSecondary: { color: colors.primary, fontSize: 16, fontWeight: "700" },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.lg, borderWidth: 1, gap: spacing.lg, padding: spacing.xl },
  error: { backgroundColor: colors.dangerSoft, borderColor: colors.danger },
  errorText: { color: colors.danger, fontSize: 13, lineHeight: 18 },
  feedback: { borderRadius: radii.sm, borderWidth: 1, padding: spacing.md },
  fieldWrap: { gap: spacing.sm },
  flex: { flex: 1 },
  footer: { alignItems: "center", marginTop: spacing.lg },
  heading: { gap: spacing.sm },
  input: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, color: colors.ink, fontSize: 16, minHeight: 50, paddingHorizontal: spacing.lg },
  inputError: { borderColor: colors.danger },
  label: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  safeArea: { backgroundColor: colors.background, flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: "center", padding: spacing.xl },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 22 },
  success: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  successText: { color: colors.primary, fontSize: 13, lineHeight: 18 },
  title: { color: colors.ink, fontSize: 28, fontWeight: "800", lineHeight: 34 },
});
