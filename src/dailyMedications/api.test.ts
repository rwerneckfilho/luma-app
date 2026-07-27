import { markDosesTakenBatch, markDosesTakenBatches } from "./api";
import { makeDailyMedicationFixture } from "../visualTesting/fixtures";

describe("daily medication batch API", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("posts the exact batch contract to the authenticated endpoint", async () => {
    const response = {
      already_taken: 0,
      marked: 1,
      not_applied: 0,
      requested: 1,
      results: [],
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify(response),
    });
    const payload = {
      event_ids: [makeDailyMedicationFixture(0).event_id],
      mode: "on_time" as const,
    };

    await expect(markDosesTakenBatch("access-token", payload)).resolves.toEqual(response);
    const [url, options] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toMatch(/\/v1\/me\/daily-medications\/taken-batch$/);
    expect(options).toMatchObject({ method: "POST" });
    expect(options.body).toBe(JSON.stringify(payload));
    expect(new Headers(options.headers).get("Authorization")).toBe("Bearer access-token");
  });

  it("sends chunks sequentially and returns one aggregate result", async () => {
    const first = makeDailyMedicationFixture(0).event_id;
    const second = makeDailyMedicationFixture(1).event_id;
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          already_taken: 0,
          marked: 1,
          not_applied: 0,
          requested: 1,
          results: [{ event_id: first, item: null, status: "marked" }],
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => JSON.stringify({
          already_taken: 1,
          marked: 0,
          not_applied: 0,
          requested: 1,
          results: [{ event_id: second, item: null, status: "already_taken" }],
        }),
      });

    await expect(markDosesTakenBatches("access-token", [
      { event_ids: [first], mode: "now" },
      { event_ids: [second], mode: "now" },
    ])).resolves.toEqual({
      already_taken: 1,
      marked: 1,
      not_applied: 0,
      requested: 2,
      results: [
        { event_id: first, item: null, status: "marked" },
        { event_id: second, item: null, status: "already_taken" },
      ],
    });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });
});
