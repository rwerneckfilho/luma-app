import { homeVisualFixtures, makeDailyMedicationFixture } from "../../visualTesting/fixtures";
import { buildBulkMarkDoseTakenPayload } from "../../dailyMedications/dailyMedicationUtils";
import {
  createInitialBulkSelection,
  createSingleFlightGate,
  formatBulkResultKey,
  toggleBulkSelection,
} from "./BulkDoseActionSheet";

describe("BulkDoseActionSheet behavior", () => {
  it("preselects every item and removing one never changes another", () => {
    const items = Array.from({ length: 11 }, (_, index) => makeDailyMedicationFixture(index));
    const initial = createInitialBulkSelection(items);
    const excluded = items[5].event_id;
    const next = toggleBulkSelection(initial, excluded, false);

    expect(initial.size).toBe(11);
    expect(next.size).toBe(10);
    expect(next.has(excluded)).toBe(false);
    expect(initial.has(excluded)).toBe(true);
    const payload = buildBulkMarkDoseTakenPayload({
      eventIds: items.filter((item) => next.has(item.event_id)).map((item) => item.event_id),
      mode: "now",
    });
    expect(payload?.event_ids).not.toContain(excluded);
    expect(payload?.event_ids).toHaveLength(10);
    expect(createInitialBulkSelection(homeVisualFixtures.bulkTwentyOne.items).size).toBe(21);
    expect(createInitialBulkSelection(homeVisualFixtures.bulkTwoHundredFive.items).size).toBe(205);
  });

  it("allows only one submit operation while a double tap is in flight", async () => {
    const gate = createSingleFlightGate();
    let resolve!: () => void;
    const inFlight = new Promise<void>((done) => { resolve = done; });
    const mutation = jest.fn(() => inFlight);

    const first = gate.run(mutation);
    const second = gate.run(mutation);
    expect(mutation).toHaveBeenCalledTimes(1);
    expect(await second).toBeUndefined();

    resolve();
    await first;
    await gate.run(mutation);
    expect(mutation).toHaveBeenCalledTimes(2);
  });

  it("uses a partial-result summary whenever one or more rows were not applied", () => {
    expect(formatBulkResultKey({
      already_taken: 1,
      marked: 8,
      not_applied: 2,
      requested: 11,
      results: [],
    })).toBe("home.bulkPartialResult");
    expect(formatBulkResultKey({
      already_taken: 1,
      marked: 10,
      not_applied: 0,
      requested: 11,
      results: [],
    })).toBe("home.bulkSuccessResult");
  });
});
