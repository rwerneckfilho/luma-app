/* eslint-disable import/first -- Jest action/API mocks must be registered before the subject import. */
import type { NotificationResponse } from "expo-notifications";

const MARK_TAKEN_ACTION = "MARK_TAKEN";
const SKIP_DOSE_ACTION = "SKIP_DOSE";

const mockStorage = new Map<string, string>();
const mockSubmitTakenPushAction = jest.fn();
const mockSubmitSkippedPushAction = jest.fn();

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(async (key: string) => mockStorage.get(key) ?? null),
  setItem: jest.fn(async (key: string, value: string) => {
    mockStorage.set(key, value);
  }),
}));

jest.mock("./api", () => ({
  submitSkippedPushAction: (...args: unknown[]) => mockSubmitSkippedPushAction(...args),
  submitTakenPushAction: (...args: unknown[]) => mockSubmitTakenPushAction(...args),
}));

jest.mock("./registration", () => ({
  MARK_TAKEN_ACTION: "MARK_TAKEN",
  SKIP_DOSE_ACTION: "SKIP_DOSE",
}));

import { processNotificationResponse } from "./responseProcessor";

function response(
  identifier: string,
  data: Record<string, unknown>,
  actionIdentifier = MARK_TAKEN_ACTION,
) {
  return {
    actionIdentifier,
    notification: {
      request: {
        content: { data },
        identifier,
      },
    },
  } as unknown as NotificationResponse;
}

describe("processNotificationResponse", () => {
  beforeEach(() => {
    mockStorage.clear();
    mockSubmitTakenPushAction.mockReset();
    mockSubmitSkippedPushAction.mockReset();
  });

  it("submits a one-time action once and never persists its token", async () => {
    mockSubmitTakenPushAction.mockResolvedValue({ status: "ok" });
    const notification = response("notification-1", {
      taken_action_token: "one-time-secret",
      url: "/history",
    });

    await expect(processNotificationResponse(notification)).resolves.toEqual({
      route: "/history",
      terminal: true,
    });
    await expect(processNotificationResponse(notification)).resolves.toEqual({
      route: null,
      terminal: true,
    });

    expect(mockSubmitTakenPushAction).toHaveBeenCalledTimes(1);
    expect([...mockStorage.values()].join(" ")).not.toContain("one-time-secret");
  });

  it("keeps transient failures retryable", async () => {
    mockSubmitTakenPushAction.mockRejectedValueOnce(new Error("offline"));
    mockSubmitTakenPushAction.mockResolvedValueOnce({ status: "ok" });
    const notification = response("notification-2", {
      taken_action_token: "retry-token",
      url: "/",
    });

    await expect(processNotificationResponse(notification)).resolves.toEqual({
      route: null,
      terminal: false,
    });
    await expect(processNotificationResponse(notification)).resolves.toEqual({
      route: "/",
      terminal: true,
    });
    expect(mockSubmitTakenPushAction).toHaveBeenCalledTimes(2);
  });

  it("uses the native deep link and submits the skip action", async () => {
    mockSubmitSkippedPushAction.mockResolvedValue({ status: "skipped" });
    const notification = response(
      "notification-3",
      {
        deep_link: "luma://home?event=event-1",
        skipped_action_token: "skip-one-time-secret",
      },
      SKIP_DOSE_ACTION,
    );

    await expect(processNotificationResponse(notification)).resolves.toEqual({
      route: "/home?event=event-1",
      terminal: true,
    });
    expect(mockSubmitSkippedPushAction).toHaveBeenCalledWith("skip-one-time-secret");
    expect([...mockStorage.values()].join(" ")).not.toContain("skip-one-time-secret");
  });
});
