import type {
  WhatsAppVerificationDeliveryStatus,
  WhatsAppVerificationStatus,
} from "./types";

export const whatsappVerificationPollingIntervalMs = 2_500;
export const whatsappVerificationMaxBackoffMs = 60_000;
export const whatsappVerificationTtlMs = 10 * 60_000;
export const whatsappVerificationExpiryToleranceMs = 15_000;
export const whatsappVerificationMaxFailureCount = 10;

const whatsappVerificationMinJitterFactor = 0.8;

export type WhatsAppVerificationDecision = "restart" | "verified" | "waiting";
export type WhatsAppOtpDeliveryFeedback = "sent" | "unknown";

export type WhatsAppVerificationPollingState = {
  status: WhatsAppVerificationStatus["status"] | undefined;
  expiresAt: string | null | undefined;
  consecutiveFailures: number;
  nowMs: number;
  fallbackExpiresAtMs: number;
  jitterSample: number;
};

export function getWhatsAppOtpDeliveryFeedback(
  status: WhatsAppVerificationDeliveryStatus | undefined,
): WhatsAppOtpDeliveryFeedback {
  return status === "sent" ? "sent" : "unknown";
}

export function getWhatsAppVerificationDecision(
  status: WhatsAppVerificationStatus | undefined,
  verificationId: string | undefined,
): WhatsAppVerificationDecision {
  if (!status || !verificationId) return "waiting";
  if (status.verification_id !== verificationId) return "restart";
  if (status.status === "verified") return "verified";
  return status.status === "pending" ? "waiting" : "restart";
}

export function getWhatsAppVerificationPollingKey(
  userId: string | undefined,
  purpose: "onboarding" | "phone_change" | undefined,
  verificationId: string | undefined,
) {
  return userId && purpose && verificationId
    ? JSON.stringify([userId, purpose, verificationId])
    : null;
}

export function getWhatsAppVerificationPollingInterval({
  consecutiveFailures,
  expiresAt,
  fallbackExpiresAtMs,
  jitterSample,
  nowMs,
  status,
}: WhatsAppVerificationPollingState) {
  if (status !== undefined && status !== "pending") {
    return false;
  }

  const parsedExpiresAtMs = expiresAt ? Date.parse(expiresAt) : Number.NaN;
  const expiresAtMs = Number.isFinite(parsedExpiresAtMs)
    ? parsedExpiresAtMs
    : fallbackExpiresAtMs;
  const pollingDeadlineMs =
    expiresAtMs + whatsappVerificationExpiryToleranceMs;

  if (nowMs >= pollingDeadlineMs) {
    return false;
  }

  let intervalMs = whatsappVerificationPollingIntervalMs;
  if (consecutiveFailures > 0) {
    const failureCount = Math.min(
      Math.max(1, consecutiveFailures),
      whatsappVerificationMaxFailureCount,
    );
    const backoffCeilingMs = Math.min(
      whatsappVerificationMaxBackoffMs,
      whatsappVerificationPollingIntervalMs * 2 ** failureCount,
    );
    const boundedJitterSample = Math.min(1, Math.max(0, jitterSample));
    const jitterFactor =
      whatsappVerificationMinJitterFactor +
      (1 - whatsappVerificationMinJitterFactor) * boundedJitterSample;
    intervalMs = Math.round(backoffCeilingMs * jitterFactor);
  }

  return Math.max(1, Math.min(intervalMs, pollingDeadlineMs - nowMs));
}
