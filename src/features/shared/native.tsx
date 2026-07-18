import type { PropsWithChildren, ReactNode } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  type TextInputProps,
  View,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fonts, radii, spacing } from "../../design/theme";

export function Screen({
  children,
  onRefresh,
  refreshing = false,
  title,
}: PropsWithChildren<{ onRefresh?: () => void; refreshing?: boolean; title?: string }>) {
  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.screen}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? <RefreshControl onRefresh={onRefresh} refreshing={refreshing} /> : undefined
        }
      >
        {title ? <Text style={styles.title}>{title}</Text> : null}
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function Section({ children, title }: PropsWithChildren<{ title?: string }>) {
  return (
    <View style={styles.section}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      {children}
    </View>
  );
}

export function Card({ children, style }: PropsWithChildren<{ style?: ViewStyle }>) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Body({ children, muted = false }: PropsWithChildren<{ muted?: boolean }>) {
  return <Text style={[styles.body, muted && styles.muted]}>{children}</Text>;
}

export function Label({ children }: PropsWithChildren) {
  return <Text style={styles.label}>{children}</Text>;
}

export function Field({ error, label, ...props }: TextInputProps & { error?: string; label: string }) {
  return (
    <View style={styles.fieldWrap}>
      <Label>{label}</Label>
      <TextInput
        placeholderTextColor={colors.muted}
        {...props}
        style={[styles.input, props.multiline && styles.textarea, props.style]}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

type ButtonProps = PropsWithChildren<{
  accessibilityLabel?: string;
  danger?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onPress?: () => void;
  secondary?: boolean;
  testID?: string;
}>;

export function Button({
  accessibilityLabel,
  children,
  danger,
  disabled,
  loading,
  onPress,
  secondary,
  testID,
}: ButtonProps) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: disabled || loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        secondary && styles.buttonSecondary,
        danger && styles.buttonDanger,
        (disabled || loading) && styles.buttonDisabled,
        pressed && styles.buttonPressed,
      ]}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator color={secondary ? colors.primary : colors.surface} />
      ) : (
        <Text style={[styles.buttonText, secondary && styles.buttonTextSecondary]}>{children}</Text>
      )}
    </Pressable>
  );
}

export function IconButton({
  disabled,
  label,
  onPress,
  testID,
}: {
  disabled?: boolean;
  label: string;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={[styles.iconButton, disabled && styles.buttonDisabled]}
      testID={testID}
    >
      <Text style={styles.iconButtonText}>{label}</Text>
    </Pressable>
  );
}

export function Choice<T extends string>({
  label,
  onChange,
  options,
  value,
}: {
  label: string;
  onChange: (value: T) => void;
  options: { label: string; value: T }[];
  value: T;
}) {
  return (
    <View style={styles.fieldWrap}>
      <Label>{label}</Label>
      <View style={styles.choiceRow}>
        {options.map((option) => (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: value === option.value }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.chip, value === option.value && styles.chipSelected]}
          >
            <Text style={[styles.chipText, value === option.value && styles.chipTextSelected]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export function ToggleRow({
  accessibilityLabel,
  description,
  disabled,
  label,
  onValueChange,
  testID,
  value,
}: {
  accessibilityLabel?: string;
  description?: string;
  disabled?: boolean;
  label: string;
  onValueChange: (value: boolean) => void;
  testID?: string;
  value: boolean;
}) {
  return (
    <View style={[styles.toggleRow, disabled && styles.buttonDisabled]}>
      <View style={styles.toggleCopy}>
        <Text style={styles.label}>{label}</Text>
        {description ? <Text style={styles.muted}>{description}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={accessibilityLabel ?? label}
        accessibilityState={{ disabled }}
        disabled={disabled}
        hitSlop={8}
        onValueChange={onValueChange}
        testID={testID}
        thumbColor={colors.surface}
        trackColor={{ false: colors.border, true: colors.primary }}
        value={value}
      />
    </View>
  );
}

export function Sheet({
  children,
  closeDisabled,
  closeLabel = "Fechar",
  onClose,
  testID,
  title,
  visible,
}: PropsWithChildren<{
  closeDisabled?: boolean;
  closeLabel?: string;
  onClose: () => void;
  testID?: string;
  title: string;
  visible: boolean;
}>) {
  return (
    <Modal
      animationType="slide"
      onRequestClose={closeDisabled ? () => undefined : onClose}
      presentationStyle="pageSheet"
      visible={visible}
    >
      <SafeAreaView accessibilityViewIsModal style={styles.safe} testID={testID}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.sheet}
        >
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <IconButton
              disabled={closeDisabled}
              label={closeLabel}
              onPress={onClose}
              testID={testID ? `${testID}-close` : undefined}
            />
          </View>
          <ScrollView
            contentContainerStyle={styles.sheetContent}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

export function StateMessage({
  action,
  body,
  loading,
  title,
}: {
  action?: ReactNode;
  body?: string;
  loading?: boolean;
  title: string;
}) {
  return (
    <Card style={styles.stateCard}>
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      <Text style={styles.stateTitle}>{title}</Text>
      {body ? <Body muted>{body}</Body> : null}
      {action}
    </Card>
  );
}

export const nativeStyles = StyleSheet.create({
  actionRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  badge: {
    alignSelf: "flex-start",
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    color: colors.primary,
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: "700",
    overflow: "hidden",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  divider: { backgroundColor: colors.border, height: StyleSheet.hairlineWidth },
  row: { alignItems: "center", flexDirection: "row", gap: spacing.md },
  rowBetween: { alignItems: "center", flexDirection: "row", justifyContent: "space-between" },
  subtitle: { color: colors.muted, fontFamily: fonts.body, fontSize: 14, lineHeight: 20 },
});

const styles = StyleSheet.create({
  body: { color: colors.ink, fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  button: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  buttonDanger: { backgroundColor: colors.danger },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.82 },
  buttonSecondary: { backgroundColor: colors.primarySoft, borderColor: colors.primary, borderWidth: 1 },
  buttonText: { color: colors.surface, fontFamily: fonts.body, fontSize: 15, fontWeight: "700" },
  buttonTextSecondary: { color: colors.primary },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  chip: {
    alignItems: "center",
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    justifyContent: "center",
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.ink, fontFamily: fonts.body, fontSize: 14 },
  chipTextSelected: { color: colors.surface, fontWeight: "700" },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  errorText: { color: colors.danger, fontFamily: fonts.body, fontSize: 13 },
  fieldWrap: { gap: spacing.sm },
  iconButton: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
  },
  iconButtonText: { color: colors.primary, fontFamily: fonts.body, fontWeight: "700" },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.md,
    borderWidth: 1,
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 16,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  label: { color: colors.ink, fontFamily: fonts.body, fontSize: 14, fontWeight: "700" },
  muted: { color: colors.muted },
  safe: { backgroundColor: colors.background, flex: 1 },
  screen: { gap: spacing.xl, padding: spacing.lg, paddingBottom: 120 },
  section: { gap: spacing.md },
  sectionTitle: { color: colors.ink, fontFamily: fonts.heading, fontSize: 19, fontWeight: "700" },
  sheet: { flex: 1 },
  sheetContent: { gap: spacing.lg, padding: spacing.lg, paddingBottom: 80 },
  sheetHeader: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
  },
  sheetTitle: { color: colors.ink, fontFamily: fonts.heading, fontSize: 20, fontWeight: "700" },
  stateCard: { alignItems: "center" },
  stateTitle: { color: colors.ink, fontFamily: fonts.heading, fontSize: 18, fontWeight: "700" },
  textarea: { minHeight: 96, textAlignVertical: "top" },
  title: { color: colors.ink, fontFamily: fonts.heading, fontSize: 30, fontWeight: "800" },
  toggleCopy: { flex: 1, gap: spacing.xs },
  toggleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: spacing.lg,
    minHeight: 56,
  },
});
