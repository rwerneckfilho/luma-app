import {
  isPasswordRecoveryCallback,
  isTrustedPasswordRecoveryUrl,
  normalizeInternalRoute,
  parseSupabaseAuthCallback,
} from "./deepLinks";

describe("Supabase auth deep links", () => {
  it("parses PKCE recovery callbacks", () => {
    const callback = parseSupabaseAuthCallback(
      "luma://auth/update-password?code=pkce-code&type=recovery",
    );

    expect(callback).toEqual({
      code: "pkce-code",
      tokenHash: undefined,
      type: "recovery",
    });
    expect(isPasswordRecoveryCallback(callback)).toBe(true);
  });

  it("ignores legacy implicit credentials", () => {
    const callback = parseSupabaseAuthCallback(
      "luma://auth/update-password#access_token=access&refresh_token=refresh&type=recovery",
    );

    expect(callback).toEqual({
      code: undefined,
      tokenHash: undefined,
      type: "recovery",
    });
  });

  it("recognizes code-only PKCE callbacks only on the configured recovery route", () => {
    expect(
      isTrustedPasswordRecoveryUrl(
        "luma://auth/update-password?code=pkce-code",
        "luma://auth/update-password",
      ),
    ).toBe(true);
    expect(
      isTrustedPasswordRecoveryUrl(
        "https://app.example/auth/update-password?code=pkce-code",
        "https://app.example/auth/update-password",
      ),
    ).toBe(true);
    expect(
      isTrustedPasswordRecoveryUrl(
        "https://evil.example/auth/update-password?code=pkce-code",
        "https://app.example/auth/update-password",
      ),
    ).toBe(false);
    expect(
      isTrustedPasswordRecoveryUrl(
        "luma://auth/callback?code=sign-in-code",
        "luma://auth/update-password",
      ),
    ).toBe(false);
  });
});

describe("notification route normalization", () => {
  it("accepts app-local paths and luma scheme routes", () => {
    expect(normalizeInternalRoute("/history?date=2026-07-11")).toBe(
      "/history?date=2026-07-11",
    );
    expect(normalizeInternalRoute("luma://medications/123?source=push")).toBe(
      "/medications/123?source=push",
    );
  });

  it("rejects protocol-relative and external routes", () => {
    expect(normalizeInternalRoute("//evil.example/path", "/safe")).toBe("/safe");
    expect(normalizeInternalRoute("https://evil.example/path", "/safe")).toBe("/safe");
  });
});
