import type { TFunction } from "i18next";

export function formatSignupError(error: unknown, t: TFunction) {
  const message = error instanceof Error ? error.message : "";
  const normalized = message.toLowerCase();

  if (
    normalized.includes("user already registered") ||
    normalized.includes("already registered") ||
    normalized.includes("already exists") ||
    normalized.includes("email")
  ) {
    return t("auth.emailAlreadyRegistered");
  }

  if (
    normalized.includes("database error saving new user") ||
    normalized.includes("constraint") ||
    normalized.includes("invalid")
  ) {
    return t("auth.invalidSignupPayload");
  }

  if (normalized.includes("fetch") || normalized.includes("network")) {
    return t("auth.signupServiceUnavailable");
  }

  return message || t("auth.unableCreateAccount");
}
