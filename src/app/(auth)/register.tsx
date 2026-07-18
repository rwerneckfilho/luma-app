import { zodResolver } from "@hookform/resolvers/zod";
import { router } from "expo-router";
import { useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useTranslation } from "react-i18next";
import {
  AuthButton,
  AuthFeedback,
  AuthField,
  AuthHeading,
  AuthScreen,
  authStyles,
} from "../../auth/AuthScreen";
import { createRegisterSchema, type RegisterFormValues } from "../../auth/authSchemas";
import {
  defaultPhoneCountry,
  formatNationalPhone,
  getLocalizedPhoneCountries,
  getLocalizedPhoneCountryName,
  getNationalPhoneExample,
  getPhoneCountry,
  normalizePhoneForSubmit,
  type PhoneCountry,
} from "../../auth/phoneCountries";
import { formatSignupError } from "../../auth/signupErrors";
import { useAuth } from "../../auth/useAuth";
import { colors, radii, spacing } from "../../design/theme";

export default function RegisterScreen() {
  "use no memo";

  const { i18n, t } = useTranslation();
  const { signUp } = useAuth();
  const [countryPickerOpen, setCountryPickerOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const locale = i18n.resolvedLanguage ?? "pt-BR";
  const countries = useMemo(() => getLocalizedPhoneCountries(locale), [locale]);
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    setError,
    setValue,
    watch,
  } = useForm<RegisterFormValues>({
    defaultValues: {
      email: "",
      full_name: "",
      password: "",
      phone_country: defaultPhoneCountry,
      phone_national: "",
    },
    resolver: zodResolver(createRegisterSchema(t)),
  });
  // React Hook Form intentionally exposes a non-memoizable subscription API.
  // eslint-disable-next-line react-hooks/incompatible-library
  const selectedIso = watch("phone_country");
  const selectedCountry = getPhoneCountry(selectedIso);

  const filteredCountries = useMemo(() => {
    const query = countrySearch.trim().toLocaleLowerCase(locale);
    if (!query) return countries;
    return countries.filter((country) => {
      const name = getLocalizedPhoneCountryName(country.iso2, locale, country.fallbackName);
      return `${name} ${country.iso2} +${country.callingCode}`
        .toLocaleLowerCase(locale)
        .includes(query);
    });
  }, [countries, countrySearch, locale]);

  const chooseCountry = (country: PhoneCountry) => {
    setValue("phone_country", country.iso2, { shouldDirty: true, shouldValidate: true });
    setValue("phone_national", "", { shouldDirty: true, shouldValidate: false });
    setCountryPickerOpen(false);
    setCountrySearch("");
  };

  const submit = handleSubmit(async (values) => {
    try {
      await signUp({
        email: values.email,
        full_name: values.full_name,
        password: values.password,
        phone_e164: normalizePhoneForSubmit(values.phone_country, values.phone_national),
      });
      router.replace({
        pathname: "/(auth)/register-confirmation",
        params: { email: values.email.trim() },
      });
    } catch (error) {
      setError("root", { message: formatSignupError(error, t) });
    }
  });

  return (
    <>
      <AuthScreen
        footer={(
          <View style={authStyles.row}>
            <Text style={authStyles.text}>{t("auth.alreadyHaveAccount")}</Text>
            <Pressable onPress={() => router.replace("/(auth)/login")}>
              <Text style={authStyles.link}>{t("auth.signIn")}</Text>
            </Pressable>
          </View>
        )}
      >
        <View style={authStyles.stack}>
          <AuthHeading subtitle={t("auth.registerSubtitle")} title={t("auth.registerTitle")} />
          <AuthFeedback message={errors.root?.message} />
          <Controller
            control={control}
            name="full_name"
            render={({ field: { onBlur, onChange, value } }) => (
              <AuthField
                autoCapitalize="words"
                autoComplete="name"
                error={errors.full_name?.message}
                label={t("auth.fullName")}
                onBlur={onBlur}
                onChangeText={onChange}
                placeholder={t("auth.yourNamePlaceholder")}
                value={value}
              />
            )}
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
          <View style={styles.fieldWrap}>
            <Text style={styles.label}>{t("auth.phoneCountry")}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setCountryPickerOpen(true)}
              style={styles.countryButton}
            >
              <Text style={styles.countryButtonText}>
                {selectedCountry.flag} {getLocalizedPhoneCountryName(
                  selectedCountry.iso2,
                  locale,
                  selectedCountry.fallbackName,
                )} (+{selectedCountry.callingCode})
              </Text>
              <Text style={styles.chevron}>⌄</Text>
            </Pressable>
            {errors.phone_country?.message ? (
              <Text style={styles.errorText}>{errors.phone_country.message}</Text>
            ) : null}
          </View>
          <Controller
            control={control}
            name="phone_national"
            render={({ field: { onBlur, onChange, value } }) => (
              <AuthField
                autoComplete="tel"
                error={errors.phone_national?.message}
                inputMode="tel"
                label={t("auth.nationalPhoneNumber")}
                onBlur={onBlur}
                onChangeText={(next) => onChange(formatNationalPhone(selectedIso, next))}
                placeholder={getNationalPhoneExample(selectedIso)}
                value={value}
              />
            )}
          />
          <Controller
            control={control}
            name="password"
            render={({ field: { onBlur, onChange, value } }) => (
              <AuthField
                autoComplete="new-password"
                error={errors.password?.message}
                label={t("auth.password")}
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
            title={t("auth.createAccount")}
          />
          <Text style={authStyles.text}>{t("auth.safetyNote")}</Text>
        </View>
      </AuthScreen>

      <Modal
        animationType="slide"
        onRequestClose={() => setCountryPickerOpen(false)}
        presentationStyle="pageSheet"
        visible={countryPickerOpen}
      >
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{t("auth.phoneCountry")}</Text>
            <Pressable onPress={() => setCountryPickerOpen(false)}>
              <Text style={authStyles.link}>{t("common.close")}</Text>
            </Pressable>
          </View>
          <TextInput
            autoCapitalize="none"
            onChangeText={setCountrySearch}
            placeholder={t("common.search")}
            placeholderTextColor={colors.muted}
            style={styles.searchInput}
            value={countrySearch}
          />
          <FlatList
            data={filteredCountries}
            keyboardShouldPersistTaps="handled"
            keyExtractor={(country) => country.iso2}
            renderItem={({ item }) => (
              <Pressable onPress={() => chooseCountry(item)} style={styles.countryRow}>
                <Text style={styles.flag}>{item.flag}</Text>
                <Text style={styles.countryName}>
                  {getLocalizedPhoneCountryName(item.iso2, locale, item.fallbackName)}
                </Text>
                <Text style={styles.callingCode}>+{item.callingCode}</Text>
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  callingCode: { color: colors.muted, fontSize: 15 },
  chevron: { color: colors.muted, fontSize: 20 },
  countryButton: { alignItems: "center", borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, flexDirection: "row", justifyContent: "space-between", minHeight: 50, paddingHorizontal: spacing.lg },
  countryButtonText: { color: colors.ink, flex: 1, fontSize: 16 },
  countryName: { color: colors.ink, flex: 1, fontSize: 15 },
  countryRow: { alignItems: "center", borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", gap: spacing.md, minHeight: 54, paddingHorizontal: spacing.xl },
  errorText: { color: colors.danger, fontSize: 13 },
  fieldWrap: { gap: spacing.sm },
  flag: { fontSize: 22 },
  label: { color: colors.ink, fontSize: 14, fontWeight: "700" },
  modalHeader: { alignItems: "center", flexDirection: "row", justifyContent: "space-between", paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  modalSafe: { backgroundColor: colors.background, flex: 1 },
  modalTitle: { color: colors.ink, fontSize: 22, fontWeight: "800" },
  searchInput: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: radii.md, borderWidth: 1, color: colors.ink, fontSize: 16, marginBottom: spacing.md, marginHorizontal: spacing.xl, minHeight: 48, paddingHorizontal: spacing.lg },
});
