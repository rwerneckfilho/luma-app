import { homeVisualFixtures } from "../../visualTesting/fixtures";
import { getHomeBulkMarkableItems, shouldShowBulkMarkTaken } from "./homeUtils";

describe("Home bulk action visibility", () => {
  it("requires at least two markable due or overdue doses", () => {
    expect(shouldShowBulkMarkTaken(homeVisualFixtures.bulkOne.items)).toBe(false);
    expect(shouldShowBulkMarkTaken(homeVisualFixtures.bulkEleven.items)).toBe(true);
  });

  it("excludes upcoming, terminal, PRN, and disabled rows", () => {
    const items = getHomeBulkMarkableItems(homeVisualFixtures.mixed.items);
    expect(items.map((item) => item.event_id)).toEqual([
      homeVisualFixtures.mixed.items[0].event_id,
      homeVisualFixtures.mixed.items[1].event_id,
    ]);
  });
});
