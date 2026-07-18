import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Text, View } from "react-native";
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
  createUpdatePasswordSchema,
  type UpdatePasswordFormValues,
} from "../../auth/authSchemas";
import { useAuth } from "../../auth/useAuth";

export default function UpdatePasswordScreen() {
  const { t } = useTranslation();
  const {
    clearPasswordRecovery,
    isLoading,
    isPasswordRecovery,
    recoveryError,
    session,
    updatePassword,
  } = useAuth();
  const [passwordUpdated, setPasswordUpdated] = useState(false);
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    setError,
  } = useForm<UpdatePasswordFormValues>({
    defaultValues: { confirmPassword: "", password: "" },
    resolver: zodResolver(createUpdatePasswordSchema(t)),
  });

  const submit = handleSubmit(async ({ password }) => {
    setPasswordUpdated(false);
    try {
      await updatePassword(password);
      setPasswordUpdated(true);
    } catch (error) {
      setError("root", {
        message: error instanceof Error ? error.message : t("auth.unableUpdatePassword"),
      });
    }
  });

  if (isLoading) return null;

  if (recoveryError || !session || !isPasswordRecovery) {
    return (
      <AuthScreen>
        <View style={authStyles.stack}>
          <AuthHeading title={t("auth.recoveryLinkInvalidTitle")} />
          <AuthFeedback message={recoveryError || t("auth.recoveryLinkInvalid")} />
          <AuthButton
            onPress={() => router.replace("/(auth)/forgot-password")}
            title={t("auth.requestNewLink")}
          />
        </View>
      </AuthScreen>
    );
  }

  if (passwordUpdated) {
    return (
      <AuthScreen>
        <View style={authStyles.stack}>
          <AuthHeading title={t("auth.passwordUpdatedTitle")} />
          <Text style={authStyles.text}>{t("auth.passwordUpdatedInstruction")}</Text>
          <AuthButton
            onPress={() => {
              void clearPasswordRecovery()
                .catch(() => undefined)
                .finally(() => router.replace("/"));
            }}
            title={t("auth.continueToApp")}
          />
        </View>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen>
      <View style={authStyles.stack}>
        <AuthHeading
          subtitle={t("auth.updatePasswordSubtitle")}
          title={t("auth.updatePasswordTitle")}
        />
        <AuthFeedback message={errors.root?.message} />
        <Controller
          control={control}
          name="password"
          render={({ field: { onBlur, onChange, value } }) => (
            <AuthField
              autoComplete="new-password"
              error={errors.password?.message}
              label={t("auth.newPassword")}
              onBlur={onBlur}
              onChangeText={onChange}
              secureTextEntry
              value={value}
            />
          )}
        />
        <Controller
          control={control}
          name="confirmPassword"
          render={({ field: { onBlur, onChange, value } }) => (
            <AuthField
              autoComplete="new-password"
              error={errors.confirmPassword?.message}
              label={t("auth.confirmNewPassword")}
              onBlur={onBlur}
              onChangeText={onChange}
              secureTextEntry
              value={value}
            />
          )}
        />
        <AuthButton
          loading={isSubmitting}
          onPress={() => void submit()}
          title={t("auth.saveNewPassword")}
        />
      </View>
    </AuthScreen>
  );
}
