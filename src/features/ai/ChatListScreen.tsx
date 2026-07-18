import { useRouter } from "expo-router";
import { MessageCircle, Plus } from "lucide-react-native";
import { useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useAiChats, useAiRuntime, useCreateAiChat, type Chat } from "../../ai";
import { colors, fonts, radii, spacing } from "../../design/theme";
import { Body, Button, StateMessage } from "../shared/native";

function chatTitle(chat: Chat, fallback: string) {
  return chat.title?.trim() || fallback;
}

function formatUpdatedAt(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function ChatListScreen() {
  const { i18n, t } = useTranslation();
  const router = useRouter();
  const runtime = useAiRuntime();
  const chats = useAiChats();
  const createChat = useCreateAiChat();

  const openChat = useCallback(
    (chatId: string) => {
      router.push({
        pathname: "/(app)/assistant/[chatId]",
        params: { chatId },
      });
    },
    [router],
  );

  const startChat = useCallback(async () => {
    try {
      const chat = await createChat.mutateAsync({});
      openChat(chat.id);
    } catch {
      // Mutation state renders localized, non-sensitive feedback.
    }
  }, [createChat, openChat]);

  if (runtime.mode === "disabled") {
    return (
      <SafeAreaView edges={["top"]} style={styles.safe}>
        <View style={styles.staticContent}>
          <Text style={styles.screenTitle}>{t("ai.title")}</Text>
          <StateMessage
            body={t("ai.unavailableBody")}
            title={t("ai.unavailableTitle")}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["top"]} style={styles.safe}>
      <FlatList
        contentContainerStyle={styles.content}
        data={chats.data ?? []}
        keyExtractor={(chat) => chat.id}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          chats.isLoading ? (
            <StateMessage loading title={t("ai.loadingChats")} />
          ) : chats.isError ? (
            <StateMessage
              action={
                <Button onPress={() => void chats.refetch()}>
                  {t("common.tryAgain")}
                </Button>
              }
              body={t("ai.loadChatsErrorBody")}
              title={t("ai.loadChatsErrorTitle")}
            />
          ) : (
            <StateMessage body={t("ai.emptyBody")} title={t("ai.emptyTitle")} />
          )
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.screenTitle}>{t("ai.title")}</Text>
              <Body muted>{t("ai.subtitle")}</Body>
            </View>
            <Pressable
              accessibilityLabel={t("ai.newChat")}
              accessibilityRole="button"
              disabled={createChat.isPending}
              onPress={() => void startChat()}
              style={({ pressed }) => [
                styles.createButton,
                createChat.isPending && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              {createChat.isPending ? (
                <ActivityIndicator color={colors.surface} />
              ) : (
                <Plus color={colors.surface} size={22} strokeWidth={2.5} />
              )}
            </Pressable>
            {createChat.isError ? (
              <Text accessibilityRole="alert" style={styles.errorText}>
                {t("ai.createError")}
              </Text>
            ) : null}
          </View>
        }
        refreshControl={
          <RefreshControl
            onRefresh={() => void chats.refetch()}
            refreshing={chats.isRefetching}
            tintColor={colors.primary}
          />
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityHint={t("ai.openChatHint")}
            accessibilityRole="button"
            onPress={() => openChat(item.id)}
            style={({ pressed }) => [
              styles.chatCard,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.chatIcon}>
              <MessageCircle color={colors.primary} size={22} />
            </View>
            <View style={styles.chatCopy}>
              <Text numberOfLines={1} style={styles.chatTitle}>
                {chatTitle(item, t("ai.untitledChat"))}
              </Text>
              <Text numberOfLines={1} style={styles.metadata}>
                {item.patient.label} ·{" "}
                {formatUpdatedAt(
                  item.updated_at,
                  i18n.resolvedLanguage ?? "pt-BR",
                )}
              </Text>
            </View>
          </Pressable>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  chatCard: {
    alignItems: "center",
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: radii.lg,
    borderWidth: 1,
    flexDirection: "row",
    gap: spacing.md,
    minHeight: 78,
    padding: spacing.lg,
  },
  chatCopy: { flex: 1, gap: spacing.xs },
  chatIcon: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: radii.pill,
    height: 44,
    justifyContent: "center",
    width: 44,
  },
  chatTitle: {
    color: colors.ink,
    fontFamily: fonts.heading,
    fontSize: 17,
    fontWeight: "700",
  },
  content: {
    flexGrow: 1,
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: 120,
  },
  createButton: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  disabled: { opacity: 0.5 },
  errorText: { color: colors.danger, fontFamily: fonts.body, width: "100%" },
  header: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  headerCopy: { flex: 1, gap: spacing.xs },
  metadata: { color: colors.muted, fontFamily: fonts.body, fontSize: 13 },
  pressed: { opacity: 0.78 },
  safe: { backgroundColor: colors.background, flex: 1 },
  screenTitle: {
    color: colors.ink,
    fontFamily: fonts.heading,
    fontSize: 30,
    fontWeight: "800",
  },
  staticContent: { flex: 1, gap: spacing.xl, padding: spacing.lg },
});
