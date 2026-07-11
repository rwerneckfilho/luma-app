import { validateHistoryDateRange } from "./historyUtils";

describe("validateHistoryDateRange", () => {
  it("rejects malformed calendar dates and reversed ranges", () => {
    expect(validateHistoryDateRange("", "2026-07-11")).toBe("invalid_start");
    expect(validateHistoryDateRange("2026-07-01", "2026-02-30")).toBe("invalid_end");
    expect(validateHistoryDateRange("2026-07-12", "2026-07-11")).toBe("end_before_start");
    expect(validateHistoryDateRange("2026-07-01", "2026-07-11")).toBeNull();
  });
});
