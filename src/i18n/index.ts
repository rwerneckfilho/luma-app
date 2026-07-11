import i18n from "i18next";
import { getLocales } from "expo-localization";
import { initReactI18next } from "react-i18next";
import en from "./locales/en.json";
import es from "./locales/es.json";
import ptBR from "./locales/pt-BR.json";
import { defaultLocale, normalizeLocale } from "./types";

const deviceLocale = normalizeLocale(getLocales()[0]?.languageTag);

// eslint-disable-next-line import/no-named-as-default-member -- `use` is the instance plugin API.
void i18n.use(initReactI18next).init({
  compatibilityJSON: "v4",
  fallbackLng: defaultLocale,
  interpolation: { escapeValue: false },
  lng: deviceLocale,
  resources: {
    en: { translation: en },
    es: { translation: es },
    "pt-BR": { translation: ptBR },
  },
  supportedLngs: ["pt-BR", "en", "es"],
});

export { i18n };
