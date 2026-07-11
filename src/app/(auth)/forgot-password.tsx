import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import {
  AuthButton,
  AuthFeedback,
  AuthField,
  AuthHeading,
  AuthScreen,
  authStyles,
} from "../../auth/AuthScreen";
import {
  createForgotPasswordSchema,
  type ForgotPasswordFormValues,
} from "../../auth/authSchemas";
import { useAuth } from "../../auth/useAuth";

export default function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const { resetPassword } = useAuth();
  const [instructionsSent, setInstructionsSent] = useState(false);
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    setError,
  } = useForm<ForgotPasswordFormValues>({
    defaultValues: { email: "" },
    resolver: zodResolver(createForgotPasswordSchema(t)),
  });

  const submit = handleSubmit(async ({ email }) => {
    setInstructionsSent(false);
    try {
      await resetPassword(email);
      setInstructionsSent(true);
    } catch (error) {
      setError("root", {
        message: error instanceof Error ? error.message : t("auth.unableSendReset"),
      });
    }
  });

  return (
    <AuthScreen
      footer={(
        <Pressable onPress={() => router.replace("/(auth)/login")}>
          <Text style={authStyles.link}>{t("auth.backToSignIn")}</Text>
        </Pressable>
      )}
    >
      <View style={authStyles.stack}>
        <AuthHeading subtitle={t("auth.forgotSubtitle")} title={t("auth.forgotTitle")} />
        <AuthFeedback message={errors.root?.message} />
        <AuthFeedback
          message={instructionsSent ? t("auth.resetInstructionsSent") : null}
          tone="success"
        />
        <Controller
          control={control}
          name="email"
          render={({ field: { onBlur, onChange, value } }) => (
            <AuthField
              autoCapitalize="none"
              autoComplete="email"
              error={errors.email?.message}
              inputMode="email"
              label={t("auth.emailAddress")}
              onBlur={onBlur}
              onChangeText={onChange}
              value={value}
            />
          )}
        />
        <AuthButton
          loading={isSubmitting}
          onPress={() => void submit()}
          title={t("auth.sendResetInstructions")}
        />
      </View>
    </AuthScreen>
  );
}
