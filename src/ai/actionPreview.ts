import type { PendingAction } from "./contracts";

const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const SUPPORTED_CAPABILITY = "medications.create-with-routines";

export type MedicationActionWarning = {
  code:
    | "confirmation_required"
    | "as_needed_limits_warn_only"
    | "inactive_routine"
    | "inactive_schedule";
  message: string;
};

export type MedicationActionPreview = {
  canonicalSha256: string;
  body: string;
  locale: "pt-BR" | "en" | "es";
  timezone: string;
  title: string;
  warnings: MedicationActionWarning[];
};

const WARNING_CODES = new Set<MedicationActionWarning["code"]>([
  "confirmation_required",
  "as_needed_limits_warn_only",
  "inactive_routine",
  "inactive_schedule",
]);

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value: Record<string, unknown>, expected: string[]) {
  const actual = Object.keys(value).sort();
  return (
    actual.length === expected.length &&
    expected
      .slice()
      .sort()
      .every((key, index) => actual[index] === key)
  );
}

function warning(value: unknown): MedicationActionWarning | null {
  if (!isObject(value) || !exactKeys(value, ["code", "message"])) return null;
  if (
    typeof value.code !== "string" ||
    !WARNING_CODES.has(value.code as MedicationActionWarning["code"]) ||
    typeof value.message !== "string" ||
    !value.message.trim() ||
    value.message.length > 500
  ) {
    return null;
  }
  return {
    code: value.code as MedicationActionWarning["code"],
    message: value.message,
  };
}

/**
 * Parse only the complete, deterministic Core preview supported by the V1 app.
 * Unknown capability previews remain cancellable but can never be confirmed by this client.
 */
export function medicationActionPreview(
  action: PendingAction,
): MedicationActionPreview | null {
  if (action.capability_id !== SUPPORTED_CAPABILITY || !isObject(action.preview)) {
    return null;
  }
  const preview = action.preview;
  if (
    !exactKeys(preview, [
      "body",
      "canonical_sha256",
      "canonical_version",
      "locale",
      "timezone",
      "title",
      "warnings",
    ]) ||
    typeof preview.title !== "string" ||
    !preview.title.trim() ||
    preview.title.length > 200 ||
    typeof preview.body !== "string" ||
    !preview.body.trim() ||
    preview.body.length > 131_072 ||
    !["pt-BR", "en", "es"].includes(String(preview.locale)) ||
    typeof preview.timezone !== "string" ||
    !preview.timezone.trim() ||
    preview.timezone.length > 128 ||
    preview.canonical_version !== "luma.medication-proposal.v1" ||
    typeof preview.canonical_sha256 !== "string" ||
    !SHA256_PATTERN.test(preview.canonical_sha256) ||
    !Array.isArray(preview.warnings) ||
    preview.warnings.length < 1 ||
    preview.warnings.length > 4
  ) {
    return null;
  }
  const warnings = preview.warnings.map(warning);
  if (warnings.some((item) => item === null)) return null;
  const parsedWarnings = warnings as MedicationActionWarning[];
  if (new Set(parsedWarnings.map((item) => item.code)).size !== parsedWarnings.length) {
    return null;
  }
  return {
    canonicalSha256: preview.canonical_sha256,
    body: preview.body,
    locale: preview.locale as MedicationActionPreview["locale"],
    timezone: preview.timezone,
    title: preview.title,
    warnings: parsedWarnings,
  };
}

export function actionIsExpired(action: PendingAction, now = Date.now()) {
  const expiresAt = Date.parse(action.expires_at);
  return !Number.isFinite(expiresAt) || expiresAt <= now;
}
