import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect } from "react";
import { getLocales } from "expo-localization";
import { useTranslation } from "react-i18next";
import { useAuth } from "../auth/useAuth";
import { useUserProfile } from "../me/hooks";
import { normalizeLocale } from "./types";

const LOCALE_STORAGE_KEY = "luma.locale";

export function LocaleSynchronizer() {
  const { i18n } = useTranslation();
  const { session } = useAuth();
  const profileQuery = useUserProfile(Boolean(session));

  useEffect(() => {
    if (session) return;

    void AsyncStorage.getItem(LOCALE_STORAGE_KEY).then((storedLocale) => {
      const locale = normalizeLocale(storedLocale ?? getLocales()[0]?.languageTag);
      if (i18n.language !== locale) void i18n.changeLanguage(locale);
    });
  }, [i18n, session]);

  useEffect(() => {
    if (!session || !profileQuery.data) return;
    const locale = normalizeLocale(profileQuery.data.locale);
    void AsyncStorage.setItem(LOCALE_STORAGE_KEY, locale);
    if (i18n.language !== locale) void i18n.changeLanguage(locale);
  }, [i18n, profileQuery.data, session]);

  return null;
}
