import { createVisualClock, VISUAL_NOW_ISO, VISUAL_TIME_ZONE } from "./clock";

describe("visual clock", () => {
  it("returns a fresh Date at the same instant", () => {
    const clock = createVisualClock();
    expect(clock.nowIso()).toBe(VISUAL_NOW_ISO);
    expect(clock.now().toISOString()).toBe("2026-06-18T15:00:00.000Z");
    expect(clock.now()).not.toBe(clock.now());
    expect(clock.timeZone).toBe(VISUAL_TIME_ZONE);
  });

  it("rejects invalid timestamps", () => {
    expect(() => createVisualClock("not-a-date")).toThrow("Invalid visual clock ISO value");
  });
});

