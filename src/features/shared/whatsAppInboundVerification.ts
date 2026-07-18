import type { WhatsAppVerificationStartResponse } from "../../me/types";

export type WhatsAppInboundVerificationState = {
  challenge: WhatsAppVerificationStartResponse;
  codeRequested: boolean;
  token: string;
};

type StartInboundVerificationOptions = {
  onStarted: (state: WhatsAppInboundVerificationState) => void;
  openUrl: (url: string) => Promise<unknown>;
  start: () => Promise<WhatsAppVerificationStartResponse>;
};

type RequestCodeFallbackOptions = {
  challenge: WhatsAppVerificationStartResponse | null;
  onRequested: (state: WhatsAppInboundVerificationState) => void;
  resend: (payload: {
    verification_id: string;
  }) => Promise<WhatsAppVerificationStartResponse>;
  resendSeconds: number;
};

type ProfileRefetchResult = {
  data?: {
    whatsapp_delivery_phone_verified_at?: string | null;
  } | null;
};

type CheckInboundVerificationOptions = {
  baselineVerifiedAt?: string | null;
  onPending: () => void;
  onVerified: () => void;
  refetchProfile: () => Promise<ProfileRefetchResult>;
  requireNewTimestamp?: boolean;
};

export function shouldShowWhatsAppVerificationCode(
  state: Pick<WhatsAppInboundVerificationState, "codeRequested">,
) {
  return state.codeRequested;
}

export async function beginWhatsAppInboundVerification({
  onStarted,
  openUrl,
  start,
}: StartInboundVerificationOptions) {
  const challenge = await start();
  const state: WhatsAppInboundVerificationState = {
    challenge,
    codeRequested: false,
    token: "",
  };
  onStarted(state);
  await openUrl(challenge.fallback_url);
  return state;
}

export async function requestWhatsAppCodeFallback({
  challenge,
  onRequested,
  resend,
  resendSeconds,
}: RequestCodeFallbackOptions) {
  if (!challenge || resendSeconds > 0) return false;
  const resentChallenge = await resend({
    verification_id: challenge.verification_id,
  });
  onRequested({
    challenge: resentChallenge,
    codeRequested: true,
    token: "",
  });
  return true;
}

export function normalizeWhatsAppVerificationToken(value: string) {
  return value.replace(/\D/g, "").slice(0, 4);
}

export function isWhatsAppVerificationTokenComplete(token: string) {
  return /^\d{4}$/.test(token);
}

export function isInboundVerificationComplete({
  baselineVerifiedAt,
  currentVerifiedAt,
  requireNewTimestamp,
}: {
  baselineVerifiedAt?: string | null;
  currentVerifiedAt?: string | null;
  requireNewTimestamp: boolean;
}) {
  if (!currentVerifiedAt) return false;
  return !requireNewTimestamp || currentVerifiedAt !== baselineVerifiedAt;
}

export async function checkWhatsAppInboundVerification({
  baselineVerifiedAt,
  onPending,
  onVerified,
  refetchProfile,
  requireNewTimestamp = false,
}: CheckInboundVerificationOptions) {
  const result = await refetchProfile();
  const verified = isInboundVerificationComplete({
    baselineVerifiedAt,
    currentVerifiedAt: result.data?.whatsapp_delivery_phone_verified_at,
    requireNewTimestamp,
  });
  if (verified) onVerified();
  else onPending();
  return verified;
}
