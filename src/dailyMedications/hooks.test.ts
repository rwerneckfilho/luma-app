import { dailyMedicationsQueryKey, refetchDailyMedicationsAfterBatch } from "./hooks";

describe("bulk medication query reconciliation", () => {
  it("awaits an active Home refetch after a partial batch response", async () => {
    const refetchQueries = jest.fn().mockResolvedValue(undefined);
    await refetchDailyMedicationsAfterBatch({ refetchQueries } as never);
    expect(refetchQueries).toHaveBeenCalledWith({
      queryKey: dailyMedicationsQueryKey,
      type: "active",
    });
  });
});
