import { useEffect, useState } from "react";

type VerificationAvailability = {
  fallback_available_at: string | null;
  resend_available_at: string | null;
};

export function secondsUntil(value: string | null | undefined, now: number) {
  if (!value) return 0;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return 0;
  return Math.max(0, Math.ceil((timestamp - now) / 1000));
}

export function useVerificationCountdown(
  verification: VerificationAvailability | null,
) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!verification) return undefined;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [verification]);

  return {
    fallbackSeconds: secondsUntil(verification?.fallback_available_at, now),
    resendSeconds: secondsUntil(verification?.resend_available_at, now),
  };
}
