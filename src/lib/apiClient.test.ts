import { apiRequest, onAuthSessionInvalid } from "./apiClient";

function unauthorizedResponse() {
  return {
    ok: false,
    status: 401,
    text: async () => JSON.stringify({ detail: "Token expirado." }),
  } as Response;
}

describe("apiRequest 401 handling", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("does not invalidate the session for a public one-time-token request", async () => {
    global.fetch = jest.fn().mockResolvedValue(unauthorizedResponse());
    const listener = jest.fn();
    const removeListener = onAuthSessionInvalid(listener);

    try {
      await expect(
        apiRequest("/v1/push-actions/taken", {
          body: { token: "expired-action-token" },
          method: "POST",
        }),
      ).rejects.toMatchObject({ status: 401 });
      expect(listener).not.toHaveBeenCalled();
    } finally {
      removeListener();
    }
  });

  it("invalidates the session for an authenticated 401 response", async () => {
    global.fetch = jest.fn().mockResolvedValue(unauthorizedResponse());
    const listener = jest.fn();
    const removeListener = onAuthSessionInvalid(listener);

    try {
      await expect(
        apiRequest("/v1/me/profile", {
          accessToken: "expired-session-token",
          method: "GET",
        }),
      ).rejects.toMatchObject({ status: 401 });
      expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      removeListener();
    }
  });
});
