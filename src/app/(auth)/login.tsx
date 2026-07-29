import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { Pressable, Text, View } from "react-native";
import { Lock, Mail } from "lucide-react-native";
import * as WebBrowser from "expo-web-browser";
import { useTranslation } from "react-i18next";
import {
  AuthButton,
  AuthAccessOptions,
  AuthFeedback,
  AuthField,
  AuthHeading,
  AuthScreen,
  authStyles,
} from "../../auth/AuthScreen";
import { createLoginSchema, type LoginFormValues } from "../../auth/authSchemas";
import { useAuth } from "../../auth/useAuth";

function signInMessage(error: unknown, fallback: string, invalidCredentials: string) {
  const message = error instanceof Error ? error.message : "";
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials") || normalized.includes("email not confirmed")) {
    return invalidCredentials;
  }
  return message || fallback;
}

export default function LoginScreen() {
  const { t } = useTranslation();
  const { signIn } = useAuth();
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    setError,
  } = useForm<LoginFormValues>({
    defaultValues: { email: "", password: "" },
    resolver: zodResolver(createLoginSchema(t)),
  });

  const submit = handleSubmit(async ({ email, password }) => {
    try {
      await signIn(email, password);
      router.replace("/");
    } catch (error) {
      setError("root", {
        message: signInMessage(
          error,
          t("auth.unableSignInTitle"),
          t("auth.incorrectCredentials"),
        ),
      });
    }
  });

  return (
    <AuthScreen
      footer={(
        <Pressable onPress={() => void WebBrowser.openBrowserAsync("https://myluma.life")}><Text style={authStyles.link}>{t("auth.joinWaitlist")}</Text></Pressable>
      )}
    >
      <View style={authStyles.stack}>
        <AuthHeading subtitle={t("auth.closedTestingSubtitle")} title={t("auth.accessTitle")} />
        <AuthAccessOptions activeMode="account" onChange={(mode) => { if (mode === "code") router.replace("/(auth)/register"); }} />
        <AuthFeedback message={errors.root?.message} />
        <Controller
          control={control}
          name="email"
          render={({ field: { onBlur, onChange, value } }) => (
            <AuthField
              autoCapitalize="none"
              autoComplete="email"
              error={errors.email?.message}
              icon={Mail}
              inputMode="email"
              label={t("auth.emailAddress")}
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
            />
          )}
        />
        <Controller
          control={control}
          name="password"
          render={({ field: { onBlur, onChange, value } }) => (
            <AuthField
              autoComplete="current-password"
              error={errors.password?.message}
              icon={Lock}
              label={t("auth.password")}
              onBlur={onBlur}
              onChangeText={onChange}
              secureTextEntry
              value={value}
            />
          )}
        />
        <Pressable onPress={() => router.push("/(auth)/forgot-password")}>
          <Text style={authStyles.link}>{t("auth.forgotPassword")}</Text>
        </Pressable>
        <AuthButton loading={isSubmitting} onPress={() => void submit()} title={t("common.continue")} />
      </View>
    </AuthScreen>
  );
}
