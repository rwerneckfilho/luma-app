import { QueryClientProvider } from "@tanstack/react-query";
import { type PropsWithChildren, useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AiClientProvider } from "../ai";
import { AuthProvider } from "../auth/AuthProvider";
import { missingRequiredEnvironment } from "../config/env";
import { colors, spacing } from "../design/theme";
import "../i18n";
import { LocaleSynchronizer } from "../i18n/LocaleSynchronizer";
import { configureQueryAppState, queryClient } from "../lib/queryClient";
import { NotificationsProvider } from "../notifications/NotificationsProvider";

function QueryLifecycle() {
  useEffect(() => configureQueryAppState(), []);
  return null;
}

export function AppProviders({ children }: PropsWithChildren) {
  const missing = missingRequiredEnvironment();
  if (missing.length) {
    return (
      <SafeAreaProvider>
        <View style={styles.configurationError}>
          <Text style={styles.title}>Configuração incompleta</Text>
          <Text style={styles.body}>Preencha: {missing.join(", ")}.</Text>
        </View>
      </SafeAreaProvider>
    );
  }

  return (
    <GestureHandlerRootView style={styles.flex}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <QueryLifecycle />
          <AuthProvider>
            <AiClientProvider>
              <LocaleSynchronizer />
              <NotificationsProvider>{children}</NotificationsProvider>
            </AiClientProvider>
          </AuthProvider>
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  body: { color: colors.muted, fontSize: 15, textAlign: "center" },
  configurationError: {
    alignItems: "center",
    backgroundColor: colors.background,
    flex: 1,
    gap: spacing.md,
    justifyContent: "center",
    padding: spacing.xl,
  },
  flex: { flex: 1 },
  title: { color: colors.ink, fontSize: 22, fontWeight: "800" },
});
