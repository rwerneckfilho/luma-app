import { createClientRequestId } from "./requestIds";

describe("createClientRequestId", () => {
  it("creates a non-zero RFC 4122 version 4 identifier", () => {
    const id = createClientRequestId(() => 0);

    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(id).not.toBe("00000000-0000-0000-0000-000000000000");
  });

  it("does not allow an out-of-range random source to corrupt the identifier", () => {
    const values = [-1, 2, Number.POSITIVE_INFINITY, Number.NaN];
    let index = 0;

    expect(createClientRequestId(() => values[index++ % values.length])).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
