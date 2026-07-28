import { useLocalSearchParams, useRouter } from "expo-router";
import { ChevronLeft, Send } from "lucide-react-native";
import { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import {
  useAiChat,
  useAiChatSession,
  useAiRuntime,
  type Message,
} from "../../ai";
import { colors, fonts, radii, spacing } from "../../design/theme";
import { Button, StateMessage } from "../shared/native";
import { ActionConfirmationCard } from "./ActionConfirmationCard";

const MESSAGE_LIMIT = 16_000;

function MessageBubble({ message }: { message: Message }) {
  const { t } = useTranslation();
  const fromUser = message.role === "user";
  const notice = message.role === "system_notice";
  return (
    <View
      accessibilityLabel={`${t(fromUser ? "ai.you" : notice ? "ai.notice" : "ai.luma")}: ${message.content}`}
      style={[
        styles.bubble,
        fromUser
          ? styles.userBubble
          : notice
            ? styles.noticeBubble
            : styles.assistantBubble,
      ]}
    >
      <Text style={[styles.messageText, fromUser && styles.userMessageText]}>
        {message.content}
      </Text>
    </View>
  );
}

export function ChatScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams<{ chatId?: string | string[] }>();
  const chatId = Array.isArray(params.chatId)
    ? (params.chatId[0] ?? "")
    : (params.chatId ?? "");
  const runtime = useAiRuntime();
  const chat = useAiChat(chatId);
  const { actionDecision, decideAction, reload, retry, send, state } =
    useAiChatSession(chatId);
  const [draft, setDraft] = useState("");
  const list = useRef<FlatList<Message>>(null);
  const composerEnabled = state.phase === "empty" || state.phase === "ready";
  const canSend =
    draft.trim().length > 0 &&
    draft.trim().length <= MESSAGE_LIMIT &&
    composerEnabled;

  const title = useMemo(
    () => chat.data?.title?.trim() || t("ai.untitledChat"),
    [chat.data?.title, t],
  );

  const submit = useCallback(async () => {
    if (!canSend) return;
    const content = draft.trim();
    setDraft("");
    const accepted = await send(content);
    if (!accepted) setDraft((current) => current || content);
  }, [canSend, draft, send]);

  if (runtime.mode === "disabled") {
    return (
      <SafeAreaView style={styles.safe}>
        <StateMessage
          body={t("ai.unavailableBody")}
          title={t("ai.unavailableTitle")}
        />
      </SafeAreaView>
    );
  }

  if (!chatId) {
    return (
      <SafeAreaView style={styles.safe}>
        <StateMessage
          body={t("ai.messageErrorBody")}
          title={t("ai.messageErrorTitle")}
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top", "bottom"]} style={styles.safe}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 72 : 0}
        style={styles.flex}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityLabel={t("common.back")}
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
          >
            <ChevronLeft color={colors.primary} size={28} />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text numberOfLines={1} style={styles.headerTitle}>
              {title}
            </Text>
            <Text numberOfLines={1} style={styles.headerSubtitle}>
              {chat.data?.patient.label ?? t("ai.patientSelf")}
            </Text>
          </View>
        </View>

        {state.phase === "loading" ? (
          <View style={styles.centerState}>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={styles.stateCopy}>{t("ai.loadingMessages")}</Text>
          </View>
        ) : state.phase === "access_changed" ? (
          <View style={styles.centerState}>
            <StateMessage
              body={t("ai.accessChangedBody")}
              title={t("ai.accessChangedTitle")}
            />
            <Button onPress={() => router.back()}>{t("common.back")}</Button>
          </View>
        ) : state.phase === "error" && state.messages.length === 0 ? (
          <View style={styles.centerState}>
            <StateMessage
              action={
                <Button onPress={() => void retry()}>
                  {t("common.tryAgain")}
                </Button>
              }
              body={t("ai.messageErrorBody")}
              title={t("ai.messageErrorTitle")}
            />
          </View>
        ) : (
          <FlatList
            contentContainerStyle={[
              styles.transcript,
              state.messages.length === 0 && styles.emptyTranscript,
            ]}
            data={state.messages}
            keyExtractor={(message) => message.id}
            keyboardDismissMode="interactive"
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              <View style={styles.emptyCopy}>
                <Text style={styles.emptyTitle}>
                  {t("ai.firstMessageTitle")}
                </Text>
                <Text style={styles.stateCopy}>{t("ai.firstMessageBody")}</Text>
              </View>
            }
            ListFooterComponent={
              <>
                {state.assistantDraft ? (
                  <View style={[styles.bubble, styles.assistantBubble]}>
                    <Text style={styles.messageText}>
                      {state.assistantDraft}
                    </Text>
                  </View>
                ) : null}
                {state.phase === "submitting" ||
                (state.phase === "streaming" && !state.assistantDraft) ? (
                  <View
                    accessibilityLabel={t("ai.lumaTyping")}
                    style={styles.typing}
                  >
                    <ActivityIndicator color={colors.primary} size="small" />
                    <Text style={styles.typingText}>{t("ai.lumaTyping")}</Text>
                  </View>
                ) : null}
                {state.phase === "reconnecting" ? (
                  <Text accessibilityRole="alert" style={styles.connectionText}>
                    {t("ai.reconnecting")}
                  </Text>
                ) : null}
                {state.phase === "waiting_confirmation" &&
                state.pendingAction ? (
                  <ActionConfirmationCard
                    action={state.pendingAction}
                    decisionState={actionDecision}
                    onDecision={decideAction}
                  />
                ) : null}
                {state.phase === "error" ? (
                  <View style={styles.inlineError}>
                    <Text accessibilityRole="alert" style={styles.errorText}>
                      {t("ai.messageErrorBody")}
                    </Text>
                    <Button onPress={() => void retry()} secondary>
                      {t("common.tryAgain")}
                    </Button>
                  </View>
                ) : null}
              </>
            }
            onContentSizeChange={() =>
              list.current?.scrollToEnd({ animated: true })
            }
            onRefresh={() => void reload()}
            ref={list}
            refreshing={false}
            renderItem={({ item }) => <MessageBubble message={item} />}
          />
        )}

        {state.phase !== "access_changed" ? (
          <View style={styles.composer}>
            <TextInput
              accessibilityLabel={t("ai.messageInput")}
              editable={composerEnabled}
              maxLength={MESSAGE_LIMIT}
              multiline
              onChangeText={setDraft}
              onSubmitEditing={() => void submit()}
              placeholder={t("ai.messagePlaceholder")}
              placeholderTextColor={colors.muted}
              style={styles.input}
              value={draft}
            />
            <Pressable
              accessibilityLabel={t("ai.send")}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canSend }}
              disabled={!canSend}
              onPress={() => void submit()}
              style={({ pressed }) => [
                styles.sendButton,
                !canSend && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <Send color={colors.surface} size={21} />
            </Pressable>
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  assistantBubble: {
    alignSelf: "flex-start",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  },
  backButton: {
    alignItems: "center",
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  bubble: {
    borderRadius: radii.lg,
    maxWidth: "86%",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  centerState: {
    flex: 1,
    gap: spacing.md,
    justifyContent: "center",
    padding: spacing.lg,
  },
  composer: {
    alignItems: "flex-end",
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    padding: spacing.md,
  },
  connectionText: {
    color: colors.muted,
    fontFamily: fonts.body,
    textAlign: "center",
  },
  disabled: { opacity: 0.45 },
  emptyCopy: { alignItems: "center", gap: spacing.sm, maxWidth: 320 },
  emptyTitle: {
    color: colors.ink,
    fontFamily: fonts.heading,
    fontSize: 21,
    fontWeight: "700",
    textAlign: "center",
  },
  emptyTranscript: { alignItems: "center", justifyContent: "center" },
  errorText: {
    color: colors.danger,
    fontFamily: fonts.body,
    textAlign: "center",
  },
  flex: { flex: 1 },
  header: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    gap: spacing.sm,
    minHeight: 64,
    paddingHorizontal: spacing.sm,
  },
  headerCopy: { flex: 1, paddingRight: spacing.lg },
  headerSubtitle: { color: colors.muted, fontFamily: fonts.body, fontSize: 12 },
  headerTitle: {
    color: colors.ink,
    fontFamily: fonts.heading,
    fontSize: 17,
    fontWeight: "700",
  },
  inlineError: { alignItems: "center", gap: spacing.sm },
  input: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    color: colors.ink,
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 16,
    maxHeight: 120,
    minHeight: 48,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  messageText: {
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 23,
  },
  noticeBubble: { alignSelf: "center", backgroundColor: colors.warningSoft },
  pressed: { opacity: 0.76 },
  safe: { backgroundColor: colors.background, flex: 1 },
  sendButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  stateCopy: {
    color: colors.muted,
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
  },
  transcript: {
    flexGrow: 1,
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.xl,
  },
  typing: { alignItems: "center", flexDirection: "row", gap: spacing.sm },
  typingText: { color: colors.muted, fontFamily: fonts.body },
  userBubble: { alignSelf: "flex-end", backgroundColor: colors.primary },
  userMessageText: { color: colors.surface },
});
