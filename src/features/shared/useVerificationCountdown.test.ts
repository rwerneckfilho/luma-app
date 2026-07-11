import { secondsUntil } from "./useVerificationCountdown";

describe("secondsUntil", () => {
  it("rounds up future availability and treats missing or expired values as ready", () => {
    const now = Date.parse("2026-07-11T15:00:00.000Z");
    expect(secondsUntil("2026-07-11T15:00:01.100Z", now)).toBe(2);
    expect(secondsUntil("2026-07-11T14:59:59.000Z", now)).toBe(0);
    expect(secondsUntil(null, now)).toBe(0);
    expect(secondsUntil("invalid", now)).toBe(0);
  });
});
