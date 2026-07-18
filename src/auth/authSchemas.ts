import type { TFunction } from "i18next";
import { z } from "zod";
import { isSupportedPhoneCountry, isValidNationalPhone } from "./phoneCountries";

export const passwordMinLength = 8;

export const createLoginSchema = (t: TFunction) => z.object({
  email: z.string().trim().email(t("validation.invalidEmail")),
  password: z.string().min(1, t("validation.passwordRequired")),
});

export const createRegisterSchema = (t: TFunction) =>
  z
    .object({
      full_name: z.string().trim().min(1, t("validation.fullNameRequired")),
      email: z.string().trim().email(t("validation.invalidEmail")),
      phone_country: z.string().refine(isSupportedPhoneCountry, t("validation.phoneCountryRequired")),
      phone_national: z.string().trim().min(1, t("validation.phoneNumberRequired")),
      password: z.string().min(passwordMinLength, t("validation.passwordMin")),
    })
    .superRefine((values, context) => {
      if (!isValidNationalPhone(values.phone_country, values.phone_national)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("validation.invalidInternationalPhone"),
          path: ["phone_national"],
        });
      }
    });

export const createForgotPasswordSchema = (t: TFunction) => z.object({
  email: z.string().trim().email(t("validation.invalidEmail")),
});

export const createUpdatePasswordSchema = (t: TFunction) =>
  z
    .object({
      password: z
        .string()
        .min(1, t("validation.passwordRequired"))
        .min(passwordMinLength, t("validation.passwordMin")),
      confirmPassword: z.string().min(1, t("validation.passwordConfirmationRequired")),
    })
    .superRefine((values, context) => {
      if (values.password && values.confirmPassword && values.password !== values.confirmPassword) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("validation.passwordsDoNotMatch"),
          path: ["confirmPassword"],
        });
      }
    });

export type LoginFormValues = z.infer<ReturnType<typeof createLoginSchema>>;
export type RegisterFormValues = z.infer<ReturnType<typeof createRegisterSchema>>;
export type ForgotPasswordFormValues = z.infer<ReturnType<typeof createForgotPasswordSchema>>;
export type UpdatePasswordFormValues = z.infer<ReturnType<typeof createUpdatePasswordSchema>>;
