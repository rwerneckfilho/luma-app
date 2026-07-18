import { router, useLocalSearchParams } from "expo-router";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  AuthButton,
  AuthHeading,
  AuthScreen,
  authStyles,
} from "../../auth/AuthScreen";

export default function RegisterConfirmationScreen() {
  const { t } = useTranslation();
  const { email } = useLocalSearchParams<{ email?: string }>();

  return (
    <AuthScreen>
      <View style={authStyles.stack}>
        <AuthHeading title={t("auth.accountCreatedTitle")} />
        <Text style={authStyles.text}>{t("auth.accountCreatedMessage")}</Text>
        {typeof email === "string" ? <Text style={authStyles.text}>{email}</Text> : null}
        <Text style={authStyles.text}>{t("auth.checkInboxMessage")}</Text>
        <AuthButton
          onPress={() => router.replace("/(auth)/login")}
          title={t("auth.backToSignIn")}
        />
      </View>
    </AuthScreen>
  );
}
