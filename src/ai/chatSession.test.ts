import type {
  AiPublicClient,
  AuthContext,
  Chat,
  ChatPage,
  MessagePage,
} from "./contracts";
import {
  consumeRunEvents,
  listCompleteChats,
  listCompleteTranscript,
} from "./chatSession";
import {
  initialEphemeralChatState,
  reduceEphemeralChatState,
  type ChatStateEvent,
} from "./chatState";
import { FakeAiClient } from "./fakeAiClient";

const auth = { accessToken: "fake-user-alice" };

class DisconnectOnceClient extends FakeAiClient {
  readonly cursors: number[] = [];
  private disconnected = false;

  override async *streamRunEvents(
    context: AuthContext,
    runId: string,
    lastEventId = 0,
  ) {
    this.cursors.push(lastEventId);
    for await (const event of super.streamRunEvents(context, runId, lastEventId)) {
      yield event;
      if (!this.disconnected && event.sequence === 2) {
        this.disconnected = true;
        throw Object.assign(new Error("socket_closed"), { status: 503 });
      }
    }
  }
}

describe("native chat session orchestration", () => {
  it("reconnects to the same run from the last event without duplicating deltas", async () => {
    const client = new DisconnectOnceClient();
    const chat = await client.createChat(
      { ...auth, idempotencyKey: "chat-reconnect" },
      { patient_selection_ref: "self" },
    );
    const accepted = await client.createMessage(auth, chat.id, {
      client_message_id: "00000000-0000-4000-8000-000000000901",
      content: "Mensagem sintética",
    });
    let state = reduceEphemeralChatState(initialEphemeralChatState, {
      type: "load.succeeded",
      chatId: chat.id,
      messages: [],
    });
    state = reduceEphemeralChatState(state, { type: "message.accepted", accepted });
    const dispatched: ChatStateEvent[] = [];

    const result = await consumeRunEvents({
      client,
      context: auth,
      dispatch: (event) => {
        dispatched.push(event);
        state = reduceEphemeralChatState(state, event);
      },
      runId: accepted.run.id,
    });

    expect(result).toEqual({ lastEventId: 3, outcome: "completed" });
    expect(client.cursors).toEqual([0, 2]);
    expect(dispatched.filter((event) => event.type === "stream.disconnected")).toHaveLength(1);
    expect(
      dispatched.filter(
        (event) => event.type === "stream.event" && event.event.type === "assistant.delta",
      ),
    ).toHaveLength(1);
    expect(state).toMatchObject({ phase: "ready", lastEventId: 3 });
  });

  it("fails closed when canonical authorization reports access changed", async () => {
    const client = {
      async *streamRunEvents() {
        throw Object.assign(new Error("access_changed"), { code: "access_changed", status: 410 });
      },
    } as unknown as AiPublicClient;
    const dispatched: ChatStateEvent[] = [];

    const result = await consumeRunEvents({
      client,
      context: auth,
      dispatch: (event) => dispatched.push(event),
      runId: "00000000-0000-4000-8000-000000000902",
    });

    expect(result.outcome).toBe("failed");
    expect(dispatched).toEqual([{ type: "access.changed" }]);
  });

  it("loads every transcript page and rejects a cursor cycle", async () => {
    const pages = new Map<string, MessagePage>([
      ["first", { items: [], next_cursor: "second" }],
      ["second", { items: [], next_cursor: null }],
    ]);
    const listMessages = jest.fn(
      async (_context: AuthContext, _chatId: string, cursor?: string) =>
        pages.get(cursor ?? "first")!,
    );
    const client = { listMessages } as unknown as AiPublicClient;

    await expect(listCompleteTranscript(client, auth, "chat-1")).resolves.toEqual([]);
    expect(listMessages.mock.calls.map((call) => call[2])).toEqual([undefined, "second"]);

    pages.set("second", { items: [], next_cursor: "second" });
    await expect(listCompleteTranscript(client, auth, "chat-1")).rejects.toThrow(
      "message_cursor_cycle",
    );
  });

  it("loads every chat page, de-duplicates moving rows and rejects a cursor cycle", async () => {
    const chat: Chat = {
      id: "00000000-0000-4000-8000-000000000903",
      title: null,
      patient: { kind: "self", label: "Você" },
      status: "active",
      created_at: "2026-07-18T12:00:00.000Z",
      updated_at: "2026-07-18T12:00:00.000Z",
    };
    const pages = new Map<string, ChatPage>([
      ["first", { items: [chat], next_cursor: "second" }],
      ["second", { items: [chat], next_cursor: null }],
    ]);
    const listChats = jest.fn(
      async (
        _context: AuthContext,
        _status?: string,
        cursor?: string,
      ) => pages.get(cursor ?? "first")!,
    );
    const client = { listChats } as unknown as AiPublicClient;

    await expect(listCompleteChats(client, auth, "active")).resolves.toEqual([
      chat,
    ]);
    expect(listChats.mock.calls.map((call) => call[2])).toEqual([
      undefined,
      "second",
    ]);

    pages.set("second", { items: [], next_cursor: "second" });
    await expect(listCompleteChats(client, auth, "active")).rejects.toThrow(
      "chat_cursor_cycle",
    );
  });
});
