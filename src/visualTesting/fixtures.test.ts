import { getVisualScenario, visualScenarios } from "./fixtures";

describe("visual fixtures", () => {
  it("covers every requested visual state", () => {
    expect(Object.keys(visualScenarios)).toEqual([
      "auth", "whatsapp", "home-full", "home-empty", "home-prn", "medications", "history", "care", "profile",
    ]);
  });

  it("keeps empty and PRN home states distinct", () => {
    expect(getVisualScenario("home-empty").fixture.medications).toHaveLength(0);
    expect(getVisualScenario("home-prn").fixture.routines[0].treatment_type).toBe("as_needed");
  });

  it("fails fast for an unsupported scenario", () => {
    expect(() => getVisualScenario("typo")).toThrow("Unknown visual scenario: typo");
  });
});
