export const supportedLocales = ["pt-BR", "en", "es"] as const;
export type SupportedLocale = (typeof supportedLocales)[number];
export const defaultLocale: SupportedLocale = "pt-BR";

export function normalizeLocale(value?: string | null): SupportedLocale {
  const locale = value?.toLowerCase() ?? "";
  if (locale.startsWith("pt")) return "pt-BR";
  if (locale.startsWith("es")) return "es";
  if (locale.startsWith("en")) return "en";
  return defaultLocale;
}
