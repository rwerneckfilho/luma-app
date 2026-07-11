import { Stack } from "expo-router";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../auth/useAuth";
import { env } from "../config/env";
import { colors, radii, spacing } from "../design/theme";
import { useUserProfile } from "../me/hooks";

export function RootNavigator() {
  const { session, isLoading, isPasswordRecovery, signOut } = useAuth();
  const profileQuery = useUserProfile(Boolean(session) && !isPasswordRecovery);

  if (isLoading || (session && !isPasswordRecovery && profileQuery.isLoading)) {
    return <View style={styles.center}><ActivityIndicator color={colors.primary} size="large" /></View>;
  }

  if (session && !isPasswordRecovery && profileQuery.isError) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Não foi possível carregar seu perfil.</Text>
        <View style={styles.actions}>
          <Pressable onPress={() => void profileQuery.refetch()} style={styles.button}>
            <Text style={styles.buttonText}>Tentar novamente</Text>
          </Pressable>
          <Pressable onPress={() => void signOut().catch(() => Alert.alert("Não foi possível sair", "Verifique sua conexão e tente novamente."))} style={styles.secondaryButton}>
            <Text style={styles.secondaryText}>Sair</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const profile = profileQuery.data;
  const onboardingIncomplete = profile?.onboarding?.completed === false;
  const whatsappVerified =
    profile?.onboarding?.whatsapp_verified ?? Boolean(profile?.whatsapp_delivery_phone_e164);
  const whatsappRequired =
    env.whatsappVerificationRequired &&
    (profile?.onboarding?.whatsapp_verification_required ?? true) &&
    !whatsappVerified;
  const needsOnboarding =
    Boolean(session) && !isPasswordRecovery && (onboardingIncomplete || whatsappRequired);
  const appReady =
    Boolean(session) && !isPasswordRecovery && Boolean(profile) && !needsOnboarding;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Protected guard={!session}>
        <Stack.Screen name="(auth)" />
      </Stack.Protected>
      <Stack.Screen name="auth/update-password" />
      <Stack.Protected guard={needsOnboarding}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={appReady}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  actions: { gap: spacing.md, minWidth: 220 },
  button: { alignItems: "center", backgroundColor: colors.primary, borderRadius: radii.md, padding: spacing.lg },
  buttonText: { color: "#FFFFFF", fontWeight: "700" },
  center: { alignItems: "center", backgroundColor: colors.background, flex: 1, gap: spacing.xl, justifyContent: "center", padding: spacing.xl },
  secondaryButton: { alignItems: "center", borderColor: colors.primary, borderRadius: radii.md, borderWidth: 1, padding: spacing.lg },
  secondaryText: { color: colors.primary, fontWeight: "700" },
  title: { color: colors.ink, fontSize: 20, fontWeight: "700", textAlign: "center" },
});
