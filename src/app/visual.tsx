import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { colors } from "../design/theme";
import { activateVisualScenario } from "../visualTesting/runtime";

export default function VisualEntryRoute() {
  const params = useLocalSearchParams<{ scenario?: string }>();
  useEffect(() => {
    if (!__DEV__ || !params.scenario) return;
    const scenario = activateVisualScenario(params.scenario);
    if (scenario) router.replace(scenario.initialRoute as never);
  }, [params.scenario]);
  return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
}

const styles = StyleSheet.create({ center: { alignItems: "center", backgroundColor: colors.background, flex: 1, justifyContent: "center" } });
