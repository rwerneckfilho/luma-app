import {
  aggregateBulkMarkDoseTakenResponses,
  buildBulkMarkDoseTakenPayload,
  chunkBulkEventIds,
  getBulkMarkableMedicationItems,
  getCommonTakenModes,
} from "./dailyMedicationUtils";
import { makeDailyMedicationFixture } from "../visualTesting/fixtures";

describe("bulk daily medication helpers", () => {
  it("selects only due or overdue scheduled doses that can be marked", () => {
    const eligibleDue = makeDailyMedicationFixture(0, { status: "due" });
    const eligibleOverdue = makeDailyMedicationFixture(1, { status: "overdue" });
    const items = [
      eligibleDue,
      eligibleOverdue,
      makeDailyMedicationFixture(2, { status: "upcoming" }),
      makeDailyMedicationFixture(3, { status: "taken" }),
      makeDailyMedicationFixture(4, { status: "skipped" }),
      makeDailyMedicationFixture(5, { treatment_type: "as_needed" }),
      makeDailyMedicationFixture(6, { can_mark_taken: false }),
    ];

    expect(getBulkMarkableMedicationItems(items)).toEqual([
      eligibleDue,
      eligibleOverdue,
    ]);
  });

  it("keeps only taken modes shared by every selected dose", () => {
    const items = [
      makeDailyMedicationFixture(0, {
        allowed_taken_options: ["on_time", "now", "manual"],
      }),
      makeDailyMedicationFixture(1, {
        allowed_taken_options: ["on_time", "now"],
      }),
    ];

    expect(getCommonTakenModes(items)).toEqual(["on_time", "now"]);
    expect(getCommonTakenModes([])).toEqual([]);
  });

  it("builds an exact unique bounded request and omits taken_at outside manual mode", () => {
    const first = makeDailyMedicationFixture(0).event_id;
    const second = makeDailyMedicationFixture(1).event_id;

    expect(buildBulkMarkDoseTakenPayload({
      eventIds: [first, second],
      mode: "now",
      takenAt: "2026-07-18T09:30:00-03:00",
    }))
      .toEqual({ event_ids: [first, second], mode: "now" });
    expect(buildBulkMarkDoseTakenPayload({
      eventIds: [first],
      mode: "manual",
      takenAt: "2026-07-18T09:30:00-03:00",
    })).toEqual({
      event_ids: [first],
      mode: "manual",
      taken_at: "2026-07-18T09:30:00-03:00",
    });
    expect(buildBulkMarkDoseTakenPayload({ eventIds: [first], mode: "manual" })).toBeNull();
    expect(buildBulkMarkDoseTakenPayload({ eventIds: [first, first], mode: "now" })).toBeNull();
    expect(buildBulkMarkDoseTakenPayload({ eventIds: [], mode: "now" })).toBeNull();
    expect(buildBulkMarkDoseTakenPayload({
      clientRequestId: second,
      eventIds: [first],
      mode: "on_time",
    })).toEqual({ client_request_id: second, event_ids: [first], mode: "on_time" });
    expect(buildBulkMarkDoseTakenPayload({
      clientRequestId: "not-a-uuid",
      eventIds: [first],
      mode: "on_time",
    })).toBeNull();
  });

  it("rejects non-UUID IDs and more than 100 doses", () => {
    const tooMany = Array.from(
      { length: 101 },
      (_, index) => makeDailyMedicationFixture(index).event_id,
    );
    expect(buildBulkMarkDoseTakenPayload({ eventIds: ["event-1"], mode: "now" })).toBeNull();
    expect(buildBulkMarkDoseTakenPayload({ eventIds: tooMany, mode: "now" })).toBeNull();
  });

  it("chunks every selected dose into sequential request-sized groups", () => {
    const eventIds = Array.from(
      { length: 205 },
      (_, index) => makeDailyMedicationFixture(index).event_id,
    );
    const chunks = chunkBulkEventIds(eventIds);

    expect(chunks.map((chunk) => chunk.length)).toEqual([100, 100, 5]);
    expect(chunks.flat()).toEqual(eventIds);
  });

  it("aggregates partial results from every request chunk", () => {
    const firstEventId = makeDailyMedicationFixture(0).event_id;
    const secondEventId = makeDailyMedicationFixture(1).event_id;
    expect(aggregateBulkMarkDoseTakenResponses([
      {
        already_taken: 0,
        marked: 1,
        not_applied: 0,
        requested: 1,
        results: [{ event_id: firstEventId, item: null, status: "marked" }],
      },
      {
        already_taken: 0,
        marked: 0,
        not_applied: 1,
        requested: 1,
        results: [{ event_id: secondEventId, item: null, status: "already_skipped" }],
      },
    ])).toEqual({
      already_taken: 0,
      marked: 1,
      not_applied: 1,
      requested: 2,
      results: [
        { event_id: firstEventId, item: null, status: "marked" },
        { event_id: secondEventId, item: null, status: "already_skipped" },
      ],
    });
  });
});
