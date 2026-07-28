import type { WhatsAppVerificationStatus } from "./types";
import {
  getWhatsAppOtpDeliveryFeedback,
  getWhatsAppVerificationDecision,
  getWhatsAppVerificationPollingInterval,
  getWhatsAppVerificationPollingKey,
  whatsappVerificationExpiryToleranceMs,
  whatsappVerificationMaxBackoffMs,
  whatsappVerificationPollingIntervalMs,
  whatsappVerificationTtlMs,
} from "./whatsappVerification";

describe("getWhatsAppOtpDeliveryFeedback", () => {
  it("keeps the sent feedback only after confirmed provider delivery", () => {
    expect(getWhatsAppOtpDeliveryFeedback("sent")).toBe("sent");
  });

  it.each(["unknown", "not_requested", undefined] as const)(
    "uses prudent feedback when delivery is %s",
    (status) => {
      expect(getWhatsAppOtpDeliveryFeedback(status)).toBe("unknown");
    },
  );
});

const verified: WhatsAppVerificationStatus = {
  attempts_remaining: 5,
  expires_at: "2026-07-27T03:00:00Z",
  fallback_available_at: null,
  resends_remaining: 3,
  status: "verified",
  verification_id: "current-verification",
};

describe("getWhatsAppVerificationDecision", () => {
  it("waits until status exists for the active challenge", () => {
    expect(
      getWhatsAppVerificationDecision(undefined, "current-verification"),
    ).toBe("waiting");
    expect(getWhatsAppVerificationDecision(verified, undefined)).toBe("waiting");
  });

  it("verifies only the matching active challenge", () => {
    expect(
      getWhatsAppVerificationDecision(verified, "current-verification"),
    ).toBe("verified");
    expect(
      getWhatsAppVerificationDecision(verified, "older-verification"),
    ).toBe("restart");
  });

  it.each(
    ["not_started", "cancelled", "expired", "failed", "superseded"] as const,
  )(
    "restarts a matching challenge after terminal status %s",
    (status) => {
      expect(
        getWhatsAppVerificationDecision(
          { ...verified, status },
          "current-verification",
        ),
      ).toBe("restart");
    },
  );

  it("restarts when the server returns another pending verification", () => {
    expect(
      getWhatsAppVerificationDecision(
        {
          ...verified,
          status: "pending",
          verification_id: "newer-verification",
        },
        "current-verification",
      ),
    ).toBe("restart");
  });
});

describe("getWhatsAppVerificationPollingInterval", () => {
  const nowMs = Date.parse("2026-07-27T12:00:00Z");
  const fallbackExpiresAtMs = nowMs + whatsappVerificationTtlMs;

  it("keeps polling every 2.5 seconds before the first response and while healthy", () => {
    expect(
      getWhatsAppVerificationPollingInterval({
        consecutiveFailures: 0,
        expiresAt: undefined,
        fallbackExpiresAtMs,
        jitterSample: 0,
        nowMs,
        status: undefined,
      }),
    ).toBe(whatsappVerificationPollingIntervalMs);
    expect(
      getWhatsAppVerificationPollingInterval({
        consecutiveFailures: 0,
        expiresAt: "2026-07-27T12:10:00Z",
        fallbackExpiresAtMs,
        jitterSample: 0,
        nowMs,
        status: "pending",
      }),
    ).toBe(whatsappVerificationPollingIntervalMs);
  });

  it.each([
    "not_started",
    "verified",
    "expired",
    "cancelled",
    "failed",
    "superseded",
  ] as const)("stops polling after the terminal %s state", (status) => {
    expect(
      getWhatsAppVerificationPollingInterval({
        consecutiveFailures: 0,
        expiresAt: "2026-07-27T12:10:00Z",
        fallbackExpiresAtMs,
        jitterSample: 0,
        nowMs,
        status,
      }),
    ).toBe(false);
  });

  it("backs off exponentially with deterministic jitter and caps prolonged outages", () => {
    const intervalForFailures = (consecutiveFailures: number) =>
      getWhatsAppVerificationPollingInterval({
        consecutiveFailures,
        expiresAt: null,
        fallbackExpiresAtMs,
        jitterSample: 0.5,
        nowMs,
        status: "pending",
      });

    expect(intervalForFailures(1)).toBe(4_500);
    expect(intervalForFailures(2)).toBe(9_000);
    expect(intervalForFailures(3)).toBe(18_000);
    expect(intervalForFailures(5)).toBe(54_000);
    expect(intervalForFailures(100)).toBe(54_000);
  });

  it("adds bounded jitter at the backoff ceiling", () => {
    const intervalForJitter = (jitterSample: number) =>
      getWhatsAppVerificationPollingInterval({
        consecutiveFailures: 10,
        expiresAt: null,
        fallbackExpiresAtMs,
        jitterSample,
        nowMs,
        status: "pending",
      });

    expect(intervalForJitter(-1)).toBe(48_000);
    expect(intervalForJitter(0)).toBe(48_000);
    expect(intervalForJitter(1)).toBe(whatsappVerificationMaxBackoffMs);
    expect(intervalForJitter(2)).toBe(whatsappVerificationMaxBackoffMs);
  });

  it("stops after the server expiry plus tolerance", () => {
    const expiresAt = "2026-07-27T12:01:00Z";

    expect(
      getWhatsAppVerificationPollingInterval({
        consecutiveFailures: 0,
        expiresAt,
        fallbackExpiresAtMs,
        jitterSample: 0,
        nowMs:
          Date.parse(expiresAt) +
          whatsappVerificationExpiryToleranceMs -
          1_000,
        status: "pending",
      }),
    ).toBe(1_000);
    expect(
      getWhatsAppVerificationPollingInterval({
        consecutiveFailures: 0,
        expiresAt,
        fallbackExpiresAtMs,
        jitterSample: 0,
        nowMs:
          Date.parse(expiresAt) + whatsappVerificationExpiryToleranceMs,
        status: "pending",
      }),
    ).toBe(false);
  });

  it("uses the local TTL when no status response ever arrives", () => {
    expect(
      getWhatsAppVerificationPollingInterval({
        consecutiveFailures: 10,
        expiresAt: undefined,
        fallbackExpiresAtMs,
        jitterSample: 1,
        nowMs:
          fallbackExpiresAtMs +
          whatsappVerificationExpiryToleranceMs -
          1,
        status: undefined,
      }),
    ).toBe(1);
    expect(
      getWhatsAppVerificationPollingInterval({
        consecutiveFailures: 10,
        expiresAt: undefined,
        fallbackExpiresAtMs,
        jitterSample: 1,
        nowMs:
          fallbackExpiresAtMs + whatsappVerificationExpiryToleranceMs,
        status: undefined,
      }),
    ).toBe(false);
  });

  it("prefers a refreshed server expiry over the original local TTL", () => {
    expect(
      getWhatsAppVerificationPollingInterval({
        consecutiveFailures: 0,
        expiresAt: "2026-07-27T12:20:00Z",
        fallbackExpiresAtMs: nowMs - 1,
        jitterSample: 0,
        nowMs,
        status: "pending",
      }),
    ).toBe(whatsappVerificationPollingIntervalMs);
  });

  it("falls back safely when the server expiry is malformed", () => {
    expect(
      getWhatsAppVerificationPollingInterval({
        consecutiveFailures: 0,
        expiresAt: "not-a-date",
        fallbackExpiresAtMs,
        jitterSample: 0,
        nowMs,
        status: "pending",
      }),
    ).toBe(whatsappVerificationPollingIntervalMs);
  });
});

describe("getWhatsAppVerificationPollingKey", () => {
  it("isolates polling state by user, purpose, and verification", () => {
    const key = getWhatsAppVerificationPollingKey(
      "user-1",
      "onboarding",
      "verification-1",
    );

    expect(key).not.toBeNull();
    expect(
      getWhatsAppVerificationPollingKey(
        "user-2",
        "onboarding",
        "verification-1",
      ),
    ).not.toBe(key);
    expect(
      getWhatsAppVerificationPollingKey(
        "user-1",
        "phone_change",
        "verification-1",
      ),
    ).not.toBe(key);
    expect(
      getWhatsAppVerificationPollingKey(
        "user-1",
        "onboarding",
        "verification-2",
      ),
    ).not.toBe(key);
  });

  it("does not create an active key for incomplete scope", () => {
    expect(
      getWhatsAppVerificationPollingKey(
        undefined,
        "onboarding",
        "verification-1",
      ),
    ).toBeNull();
    expect(
      getWhatsAppVerificationPollingKey("user-1", undefined, "verification-1"),
    ).toBeNull();
    expect(
      getWhatsAppVerificationPollingKey("user-1", "onboarding", undefined),
    ).toBeNull();
  });
});
