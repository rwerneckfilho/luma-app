import type { WhatsAppVerificationStartResponse } from "../../me/types";
import {
  beginWhatsAppInboundVerification,
  checkWhatsAppInboundVerification,
  isWhatsAppVerificationTokenComplete,
  normalizeWhatsAppVerificationToken,
  requestWhatsAppCodeFallback,
  shouldShowWhatsAppVerificationCode,
} from "./whatsAppInboundVerification";

function challenge(
  overrides: Partial<WhatsAppVerificationStartResponse> = {},
): WhatsAppVerificationStartResponse {
  return {
    candidates_sent: [],
    cooldown_seconds: 30,
    delivery_status: "not_requested",
    expires_at: "2026-07-18T15:10:00.000Z",
    fallback_available_at: null,
    fallback_url: "https://wa.me/5511999999999?text=verify",
    resend_available_at: "2026-07-18T15:00:30.000Z",
    status: "pending",
    verification_id: "verification-1",
    ...overrides,
  };
}

describe("WhatsApp inbound verification flow", () => {
  it("opens the fallback URL on start without exposing the OTP form", async () => {
    const started = challenge();
    const onStarted = jest.fn();
    const openUrl = jest.fn(async () => undefined);
    const start = jest.fn(async () => started);

    const state = await beginWhatsAppInboundVerification({
      onStarted,
      openUrl,
      start,
    });

    expect(start).toHaveBeenCalledTimes(1);
    expect(onStarted).toHaveBeenCalledWith({
      challenge: started,
      codeRequested: false,
      token: "",
    });
    expect(openUrl).toHaveBeenCalledWith(started.fallback_url);
    expect(shouldShowWhatsAppVerificationCode(state)).toBe(false);
  });

  it("refetches the profile and advances only after verified_at exists", async () => {
    const onPending = jest.fn();
    const onVerified = jest.fn();
    const pendingRefetch = jest.fn(async () => ({
      data: { whatsapp_delivery_phone_verified_at: null },
    }));

    await expect(checkWhatsAppInboundVerification({
      onPending,
      onVerified,
      refetchProfile: pendingRefetch,
    })).resolves.toBe(false);
    expect(pendingRefetch).toHaveBeenCalledTimes(1);
    expect(onPending).toHaveBeenCalledTimes(1);
    expect(onVerified).not.toHaveBeenCalled();

    const verifiedAt = "2026-07-18T15:01:00.000Z";
    const verifiedRefetch = jest.fn(async () => ({
      data: { whatsapp_delivery_phone_verified_at: verifiedAt },
    }));
    await expect(checkWhatsAppInboundVerification({
      onPending,
      onVerified,
      refetchProfile: verifiedRefetch,
    })).resolves.toBe(true);
    expect(verifiedRefetch).toHaveBeenCalledTimes(1);
    expect(onVerified).toHaveBeenCalledTimes(1);
  });

  it("uses resend for the code fallback while preserving cooldown and token validation", async () => {
    const initial = challenge();
    const resent = challenge({
      resend_available_at: "2026-07-18T15:01:00.000Z",
      verification_id: "verification-2",
    });
    const onRequested = jest.fn();
    const resend = jest.fn(async () => resent);

    await expect(requestWhatsAppCodeFallback({
      challenge: initial,
      onRequested,
      resend,
      resendSeconds: 12,
    })).resolves.toBe(false);
    expect(resend).not.toHaveBeenCalled();
    expect(onRequested).not.toHaveBeenCalled();

    await expect(requestWhatsAppCodeFallback({
      challenge: initial,
      onRequested,
      resend,
      resendSeconds: 0,
    })).resolves.toBe(true);
    expect(resend).toHaveBeenCalledWith({ verification_id: initial.verification_id });
    expect(onRequested).toHaveBeenCalledWith({
      challenge: resent,
      codeRequested: true,
      token: "",
    });
    expect(shouldShowWhatsAppVerificationCode(onRequested.mock.calls[0][0])).toBe(true);
    expect(normalizeWhatsAppVerificationToken("1a2-345")).toBe("1234");
    expect(isWhatsAppVerificationTokenComplete("123")).toBe(false);
    expect(isWhatsAppVerificationTokenComplete("1234")).toBe(true);
  });

  it("closes a phone change only after verified_at receives a new timestamp", async () => {
    const baselineVerifiedAt = "2026-07-18T14:00:00.000Z";
    const onPending = jest.fn();
    const onVerified = jest.fn();

    await expect(checkWhatsAppInboundVerification({
      baselineVerifiedAt,
      onPending,
      onVerified,
      refetchProfile: async () => ({
        data: { whatsapp_delivery_phone_verified_at: baselineVerifiedAt },
      }),
      requireNewTimestamp: true,
    })).resolves.toBe(false);
    expect(onPending).toHaveBeenCalledTimes(1);
    expect(onVerified).not.toHaveBeenCalled();

    await expect(checkWhatsAppInboundVerification({
      baselineVerifiedAt,
      onPending,
      onVerified,
      refetchProfile: async () => ({
        data: { whatsapp_delivery_phone_verified_at: "2026-07-18T15:00:00.000Z" },
      }),
      requireNewTimestamp: true,
    })).resolves.toBe(true);
    expect(onVerified).toHaveBeenCalledTimes(1);
  });
});
