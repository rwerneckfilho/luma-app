import { ChevronDown, X } from "lucide-react-native";
import type { ComponentType, PropsWithChildren, ReactNode } from "react";
import { useState } from "react";
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
  useWindowDimensions,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors, fonts, layout, radii, shadows, spacing } from "../../design/theme";

export function Screen({
  children,
  edges = [],
  maxWidth = layout.contentMaxWidth,
  onRefresh,
  refreshing = false,
  title,
}: PropsWithChildren<{
  edges?: ("top" | "right" | "bottom" | "left")[];
  maxWidth?: number;
  onRefresh?: () => void;
  refreshing?: boolean;
  title?: string;
}>) {
  const { width } = useWindowDimensions();
  return (
    <SafeAreaView edges={edges} style={styles.safe}>
      <ScrollView
        contentContainerStyle={[
          styles.screen,
          { maxWidth },
          width >= layout.tabletBreakpoint && styles.screenWide,
        ]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          onRefresh ? <RefreshControl onRefresh={onRefresh} refreshing={refreshing} /> : undefined
        }
      >
        {title ? <Text accessibilityRole="header" style={[styles.title, width >= layout.tabletBreakpoint && styles.titleWide]}>{title}</Text> : null}
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
        accessibilityLabel={props.accessibilityLabel ?? label}
        placeholderTextColor={colors.muted}
        {...props}
        style={[styles.input, props.multiline && styles.textarea, props.style]}
      />
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

type ButtonProps = PropsWithChildren<{
  danger?: boolean;
  disabled?: boolean;
  loading?: boolean;
  onPress?: () => void;
  secondary?: boolean;
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  icon?: ComponentType<{ color?: string; size?: number }>;
}>;

export function Button({ children, danger, disabled, icon: Icon, loading, onPress, secondary, variant }: ButtonProps) {
  const resolvedVariant = danger ? "danger" : secondary ? "secondary" : variant ?? "primary";
  const foreground = resolvedVariant === "primary" || resolvedVariant === "danger" ? colors.surface : colors.primary;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        resolvedVariant === "secondary" && styles.buttonSecondary,
        resolvedVariant === "outline" && styles.buttonOutline,
        resolvedVariant === "ghost" && styles.buttonGhost,
        resolvedVariant === "danger" && styles.buttonDanger,
        (disabled || loading) && styles.buttonDisabled,
        pressed && styles.buttonPressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <View style={styles.buttonContent}>
          {Icon ? <Icon color={foreground} size={18} /> : null}
          <Text style={[styles.buttonText, resolvedVariant !== "primary" && resolvedVariant !== "danger" && styles.buttonTextSecondary]}>{children}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function IconButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.iconButton}>
      <Text style={styles.iconButtonText}>{label}</Text>
    </Pressable>
  );
}

export function Accordion({
  children,
  defaultExpanded = false,
  expanded,
  icon: Icon,
  onExpandedChange,
  subtitle,
  title,
}: PropsWithChildren<{
  defaultExpanded?: boolean;
  expanded?: boolean;
  icon?: ComponentType<{ color?: string; size?: number }>;
  onExpandedChange?: (expanded: boolean) => void;
  subtitle?: string;
  title: string;
}>) {
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isExpanded = expanded ?? internalExpanded;
  const toggle = () => {
    const next = !isExpanded;
    if (expanded === undefined) setInternalExpanded(next);
    onExpandedChange?.(next);
  };

  return (
    <View style={styles.accordion}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: isExpanded }}
        onPress={toggle}
        style={({ pressed }) => [styles.accordionHeader, pressed && styles.pressedSoft]}
      >
        {Icon ? <View style={styles.accordionIcon}><Icon color={colors.primary} size={20} /></View> : null}
        <View style={styles.accordionCopy}>
          <Text style={styles.accordionTitle}>{title}</Text>
          {subtitle ? <Text style={styles.accordionSubtitle}>{subtitle}</Text> : null}
        </View>
        <ChevronDown color={colors.muted} size={20} style={{ transform: [{ rotate: isExpanded ? "180deg" : "0deg" }] }} />
      </Pressable>
      {isExpanded ? <View style={styles.accordionContent}>{children}</View> : null}
    </View>
  );
}

export function Badge({ children, tone = "primary" }: PropsWithChildren<{ tone?: "primary" | "success" | "warning" | "danger" | "neutral" }>) {
  return <Text style={[styles.badge, styles[`badge_${tone}`]]}>{children}</Text>;
}

export function PageHeading({ children, subtitle }: PropsWithChildren<{ subtitle?: string }>) {
  const { width } = useWindowDimensions();
  return <View style={styles.pageHeading}><Text accessibilityRole="header" style={[styles.title, width >= layout.tabletBreakpoint && styles.titleWide]}>{children}</Text>{subtitle ? <Text style={styles.pageSubtitle}>{subtitle}</Text> : null}</View>;
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
  description,
  label,
  onValueChange,
  value,
}: {
  description?: string;
  label: string;
  onValueChange: (value: boolean) => void;
  value: boolean;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleCopy}>
        <Text style={styles.label}>{label}</Text>
        {description ? <Text style={styles.muted}>{description}</Text> : null}
      </View>
      <Switch
        accessibilityLabel={label}
        onValueChange={onValueChange}
        thumbColor={colors.surface}
        trackColor={{ false: colors.border, true: colors.primary }}
        value={value}
      />
    </View>
  );
}

export function Sheet({
  children,
  onClose,
  title,
  visible,
}: PropsWithChildren<{ onClose: () => void; title: string; visible: boolean }>) {
  return (
    <Modal animationType="slide" onRequestClose={onClose} presentationStyle="pageSheet" visible={visible}>
      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.sheet}
        >
          <View style={styles.sheetHeader}>
            <Text style={styles.sheetTitle}>{title}</Text>
            <Pressable accessibilityLabel="Fechar" accessibilityRole="button" onPress={onClose} style={styles.sheetClose}>
              <X color={colors.ink} size={22} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.sheetContent} keyboardShouldPersistTaps="handled">
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
    fontFamily: fonts.bodyBold,
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
  body: { color: colors.ink, fontFamily: fonts.body, fontSize: 16, lineHeight: 24 },
  button: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  buttonDanger: { backgroundColor: colors.danger },
  buttonContent: { alignItems: "center", flexDirection: "row", gap: spacing.sm, justifyContent: "center" },
  buttonDisabled: { opacity: 0.5 },
  buttonPressed: { opacity: 0.82 },
  buttonSecondary: { backgroundColor: colors.primarySoft, borderColor: colors.primary, borderWidth: 1 },
  buttonOutline: { backgroundColor: colors.surface, borderColor: colors.primary, borderWidth: 1 },
  buttonGhost: { backgroundColor: "transparent" },
  buttonText: { color: colors.surface, fontFamily: fonts.bodyBold, fontSize: 15 },
  buttonTextSecondary: { color: colors.primary },
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.borderSoft,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
    ...shadows.card,
  },
  accordion: { backgroundColor: colors.surface, borderColor: colors.borderSoft, borderRadius: radii.lg, borderWidth: 1, overflow: "hidden", ...shadows.card },
  accordionContent: { borderTopColor: colors.border, borderTopWidth: 1, gap: spacing.md, padding: spacing.lg },
  accordionCopy: { flex: 1, gap: 2 },
  accordionHeader: { alignItems: "center", flexDirection: "row", gap: spacing.md, minHeight: 64, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  accordionIcon: { alignItems: "center", backgroundColor: colors.primarySoft, borderRadius: radii.pill, height: 36, justifyContent: "center", width: 36 },
  accordionSubtitle: { color: colors.muted, fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  accordionTitle: { color: colors.ink, fontFamily: fonts.bodySemibold, fontSize: 16, lineHeight: 22 },
  badge: { alignSelf: "flex-start", borderRadius: radii.pill, fontFamily: fonts.bodyBold, fontSize: 12, overflow: "hidden", paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  badge_primary: { backgroundColor: colors.primarySoft, color: colors.primary },
  badge_success: { backgroundColor: colors.successSoft, color: colors.success },
  badge_warning: { backgroundColor: colors.warningSoft, color: colors.warning },
  badge_danger: { backgroundColor: colors.dangerSoft, color: colors.danger },
  badge_neutral: { backgroundColor: colors.surfaceMuted, color: colors.muted },
  chip: {
    borderColor: colors.border,
    borderRadius: radii.pill,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  chipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipText: { color: colors.ink, fontFamily: fonts.body, fontSize: 14 },
  chipTextSelected: { color: colors.surface, fontWeight: "700" },
  choiceRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  errorText: { color: colors.danger, fontFamily: fonts.body, fontSize: 13 },
  fieldWrap: { gap: spacing.sm },
  iconButton: { paddingHorizontal: spacing.sm, paddingVertical: spacing.md },
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
  label: { color: colors.ink, fontFamily: fonts.bodySemibold, fontSize: 14 },
  muted: { color: colors.muted },
  safe: { backgroundColor: colors.background, flex: 1 },
  screen: { alignSelf: "center", gap: spacing.xl, paddingHorizontal: 20, paddingTop: spacing.lg, paddingBottom: 120, width: "100%" },
  screenWide: { paddingHorizontal: spacing.xxl, paddingTop: spacing.xxl },
  section: { gap: spacing.md },
  sectionTitle: { color: colors.ink, fontFamily: fonts.headingBold, fontSize: 19 },
  sheet: { flex: 1 },
  sheetContent: { gap: spacing.lg, padding: spacing.lg, paddingBottom: 80 },
  sheetHeader: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 64,
    paddingHorizontal: spacing.lg,
  },
  sheetClose: { alignItems: "center", borderRadius: radii.pill, height: 44, justifyContent: "center", width: 44 },
  sheetTitle: { color: colors.ink, fontFamily: fonts.headingBold, fontSize: 20 },
  stateCard: { alignItems: "center" },
  stateTitle: { color: colors.ink, fontFamily: fonts.headingBold, fontSize: 18 },
  textarea: { minHeight: 96, textAlignVertical: "top" },
  pageHeading: { gap: spacing.xs },
  pageSubtitle: { color: colors.muted, fontFamily: fonts.body, fontSize: 15, lineHeight: 22 },
  pressedSoft: { backgroundColor: colors.surfaceMuted },
  title: { color: colors.ink, fontFamily: fonts.headingBold, fontSize: 30, lineHeight: 38 },
  titleWide: { fontSize: 40, lineHeight: 48 },
  toggleCopy: { flex: 1, gap: spacing.xs },
  toggleRow: { alignItems: "center", flexDirection: "row", gap: spacing.lg },
});
