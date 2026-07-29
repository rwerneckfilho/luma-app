import { combineHistoryResources, historyStatusTone } from "./historyViewModel";

describe("combineHistoryResources", () => {
  it("combines active loading and error states", () => {
    expect(combineHistoryResources([
      { isError: false, isLoading: false },
      { isError: false, isLoading: true },
      { isError: true, isLoading: false },
    ])).toEqual({ isError: true, isLoading: true });
  });

  it("ignores disabled resources", () => {
    expect(combineHistoryResources([
      { isError: false, isLoading: false },
      { enabled: false, isError: true, isLoading: true },
    ])).toEqual({ isError: false, isLoading: false });
  });
});

describe("historyStatusTone", () => {
  it.each([
    ["taken", "success"],
    ["due", "warning"],
    ["overdue", "danger"],
    ["skipped", "danger"],
    ["scheduled", "neutral"],
    ["upcoming", "neutral"],
  ] as const)("maps %s to %s", (status, tone) => {
    expect(historyStatusTone(status)).toBe(tone);
  });
});
