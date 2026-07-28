import { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  actionIsExpired,
  medicationActionPreview,
  type PendingAction,
} from "../../ai";
import { colors, fonts, radii, spacing } from "../../design/theme";
import { Button } from "../shared/native";

type DecisionState = {
  decision: "confirm" | "cancel" | null;
  errorCode: string | null;
  status: "idle" | "submitting" | "accepted" | "failed";
};

function useExpiry(action: PendingAction) {
  const expiresAt = Date.parse(action.expires_at);
  const [expired, setExpired] = useState(true);
  useEffect(() => {
    const now = Date.now();
    const remaining = expiresAt - now;
    if (!Number.isFinite(remaining) || remaining <= 0) {
      setExpired(true);
      return;
    }
    setExpired(actionIsExpired(action, now));
    const timeout = setTimeout(
      () => setExpired(true),
      Math.min(remaining + 25, 2_147_000_000),
    );
    return () => clearTimeout(timeout);
  }, [action, expiresAt]);
  return expired;
}

export function ActionConfirmationCard({
  action,
  decisionState,
  onDecision,
}: {
  action: PendingAction;
  decisionState: DecisionState;
  onDecision: (decision: "confirm" | "cancel") => Promise<boolean>;
}) {
  const { i18n, t } = useTranslation();
  const preview = useMemo(() => medicationActionPreview(action), [action]);
  const expired = useExpiry(action);
  const busy =
    decisionState.status === "submitting" ||
    decisionState.status === "accepted";
  const expiration = useMemo(() => {
    const date = new Date(action.expires_at);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat(i18n.resolvedLanguage ?? "pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(date);
  }, [action.expires_at, i18n.resolvedLanguage]);

  return (
    <View accessibilityLabel={t("ai.confirmationPendingTitle")} style={styles.card}>
      <Text style={styles.title}>
        {preview?.title ?? t("ai.confirmationUnsupportedTitle")}
      </Text>
      {preview ? (
        <>
          <Text selectable style={styles.previewBody}>
            {preview.body}
          </Text>
          {preview.warnings.map((warning) => (
            <Text key={warning.code} style={styles.warning}>
              {warning.message}
            </Text>
          ))}
        </>
      ) : (
        <Text style={styles.copy}>{t("ai.confirmationUnsupportedBody")}</Text>
      )}
      {expiration ? (
        <Text style={styles.metadata}>
          {t("ai.confirmationExpiresAt", { value: expiration })}
        </Text>
      ) : null}
      {expired ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {t("ai.confirmationExpired")}
        </Text>
      ) : null}
      {decisionState.status === "accepted" ? (
        <Text accessibilityRole="alert" style={styles.processing}>
          {t("ai.confirmationProcessing")}
        </Text>
      ) : null}
      {decisionState.status === "failed" ? (
        <Text accessibilityRole="alert" style={styles.error}>
          {t("ai.confirmationDecisionError")}
        </Text>
      ) : null}
      <View style={styles.actions}>
        <View style={styles.actionButton}>
          <Button
            disabled={busy}
            loading={
              decisionState.status === "submitting" &&
              decisionState.decision === "cancel"
            }
            onPress={() => void onDecision("cancel")}
            secondary
          >
            {t("ai.cancelAction")}
          </Button>
        </View>
        <View style={styles.actionButton}>
          <Button
            disabled={!preview || expired || busy}
            loading={
              decisionState.status === "submitting" &&
              decisionState.decision === "confirm"
            }
            onPress={() => void onDecision("confirm")}
          >
            {t("ai.confirmAction")}
          </Button>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  actionButton: { flex: 1 },
  actions: { flexDirection: "row", gap: spacing.sm },
  card: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warning,
    borderRadius: radii.md,
    borderWidth: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  copy: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
  },
  error: { color: colors.danger, fontFamily: fonts.body, fontWeight: "600" },
  metadata: { color: colors.muted, fontFamily: fonts.body, fontSize: 12 },
  previewBody: {
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 21,
  },
  processing: { color: colors.primary, fontFamily: fonts.body, fontWeight: "600" },
  title: {
    color: colors.ink,
    fontFamily: fonts.heading,
    fontSize: 17,
    fontWeight: "700",
  },
  warning: {
    color: colors.warning,
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 19,
  },
});
