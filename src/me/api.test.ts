import { getWhatsAppVerificationStatus } from "./api";

describe("getWhatsAppVerificationStatus", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("requests the status scoped to the selected purpose", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () =>
        JSON.stringify({
          attempts_remaining: 5,
          expires_at: "2026-07-27T03:00:00Z",
          fallback_available_at: null,
          resends_remaining: 3,
          status: "pending",
          verification_id: "verification-1",
        }),
    } as Response);

    const result = await getWhatsAppVerificationStatus(
      "access-token",
      "phone_change",
      "verification-1",
    );

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining(
        "/v1/me/whatsapp-verification/status?purpose=phone_change&verification_id=verification-1",
      ),
      expect.objectContaining({ method: "GET" }),
    );
    expect(result.verification_id).toBe("verification-1");
  });
});
