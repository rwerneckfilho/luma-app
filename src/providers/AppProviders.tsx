import { QueryClientProvider } from "@tanstack/react-query";
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts as useInterFonts,
} from "@expo-google-fonts/inter";
import {
  Manrope_600SemiBold,
  Manrope_700Bold,
  useFonts as useManropeFonts,
} from "@expo-google-fonts/manrope";
import * as SplashScreen from "expo-splash-screen";
import { type PropsWithChildren, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../auth/AuthProvider";
import { missingRequiredEnvironment } from "../config/env";
import { colors, spacing } from "../design/theme";
import "../i18n";
import { LocaleSynchronizer } from "../i18n/LocaleSynchronizer";
import { configureQueryAppState, queryClient } from "../lib/queryClient";
import { NotificationsProvider } from "../notifications/NotificationsProvider";
import { getActiveVisualScenario, subscribeVisualScenario } from "../visualTesting/runtime";
import { VisualProviders } from "../visualTesting/providers";

function QueryLifecycle() {
  useEffect(() => configureQueryAppState(), []);
  return null;
}

void SplashScreen.preventAutoHideAsync();

export function AppProviders({ children }: PropsWithChildren) {
  const [visualScenario, setVisualScenario] = useState(getActiveVisualScenario);
  const [interLoaded, interError] = useInterFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const [manropeLoaded, manropeError] = useManropeFonts({ Manrope_600SemiBold, Manrope_700Bold });
  const fontsReady = (interLoaded && manropeLoaded) || interError || manropeError;

  useEffect(() => {
    if (fontsReady) void SplashScreen.hideAsync();
  }, [fontsReady]);
  useEffect(() => subscribeVisualScenario(setVisualScenario), []);

  if (!fontsReady) return null;

  const missing = visualScenario ? [] : missingRequiredEnvironment();
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
          {visualScenario ? (
            <VisualProviders scenario={visualScenario}>
              <LocaleSynchronizer />
              {children}
            </VisualProviders>
          ) : (
            <AuthProvider>
              <LocaleSynchronizer />
              <NotificationsProvider>{children}</NotificationsProvider>
            </AuthProvider>
          )}
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  body: { color: colors.muted, fontSize: 15, textAlign: "center" },
  configurationError: { alignItems: "center", backgroundColor: colors.background, flex: 1, gap: spacing.md, justifyContent: "center", padding: spacing.xl },
  flex: { flex: 1 },
  title: { color: colors.ink, fontSize: 22, fontWeight: "800" },
});
