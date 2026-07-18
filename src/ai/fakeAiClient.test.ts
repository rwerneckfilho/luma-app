import {
  FakeAiClient,
  initialEphemeralChatState,
  reduceEphemeralChatState,
  type EphemeralChatState,
  type RunEvent,
} from ".";

const auth = { accessToken: "fake-user-alice" };
const mutation = (idempotencyKey: string) => ({ ...auth, idempotencyKey });

async function collect<T>(iterable: AsyncIterable<T>) {
  const values: T[] = [];
  for await (const value of iterable) values.push(value);
  return values;
}

function applyRunEvents(state: EphemeralChatState, events: RunEvent[]) {
  return events.reduce(
    (current, event) => reduceEphemeralChatState(current, { type: "stream.event", event }),
    state,
  );
}

describe("FakeAiClient and ephemeral chat states", () => {
  it("models 202 acceptance, replayable run events, and transcript refresh", async () => {
    const fake = new FakeAiClient();
    const chat = await fake.createChat(mutation("chat-1"), {
      patient_selection_ref: "self",
      title: "Novo chat",
    });
    let state = reduceEphemeralChatState(initialEphemeralChatState, {
      type: "load.succeeded",
      chatId: chat.id,
      messages: [],
    });
    expect(state.phase).toBe("empty");

    state = reduceEphemeralChatState(state, { type: "message.submitting" });
    const accepted = await fake.createMessage(auth, chat.id, {
      client_message_id: "00000000-0000-4000-8000-000000000101",
      content: "Quais rotinas estão ativas?",
    });
    expect(accepted.run.status).toBe("succeeded");
    state = reduceEphemeralChatState(state, { type: "message.accepted", accepted });

    const events = await collect(fake.streamRunEvents(auth, accepted.run.id));
    expect(events.map((event) => event.sequence)).toEqual([1, 2, 3]);
    state = applyRunEvents(state, events);
    expect(state).toMatchObject({
      phase: "ready",
      activeRunId: null,
      lastEventId: 3,
      needsTranscriptRefresh: true,
    });

    const replay = await collect(fake.streamRunEvents(auth, accepted.run.id, 1));
    expect(replay.map((event) => event.sequence)).toEqual([2, 3]);
    expect((await fake.listMessages(auth, chat.id)).items.map((message) => message.role)).toEqual([
      "user",
      "assistant",
    ]);
  });

  it("models confirmation and reconnect states without letting replay duplicate deltas", async () => {
    const fake = new FakeAiClient();
    const chat = await fake.createChat(mutation("chat-confirm"), {
      patient_selection_ref: "self",
    });
    fake.queueScenario({
      assistantText: "Revise a proposta antes de confirmar.",
      confirmation: {
        capabilityId: "medications.create-with-routines",
        preview: { medication_name: "Medicamento sintético" },
      },
    });
    const accepted = await fake.createMessage(auth, chat.id, {
      client_message_id: "00000000-0000-4000-8000-000000000102",
      content: "Crie meu medicamento.",
    });
    let state = reduceEphemeralChatState(initialEphemeralChatState, {
      type: "load.succeeded",
      chatId: chat.id,
      messages: [],
    });
    state = reduceEphemeralChatState(state, { type: "message.accepted", accepted });
    const initialEvents = await collect(fake.streamRunEvents(auth, accepted.run.id));
    state = applyRunEvents(state, initialEvents);
    expect(state.phase).toBe("waiting_confirmation");
    expect(state.pendingAction?.capability_id).toBe("medications.create-with-routines");

    const disconnected = reduceEphemeralChatState(state, { type: "stream.disconnected" });
    expect(disconnected.phase).toBe("reconnecting");
    const replayed = applyRunEvents(disconnected, initialEvents);
    expect(replayed.assistantDraft).toBe(state.assistantDraft);

    await fake.decideAction(
      mutation("confirm-1"),
      chat.id,
      state.pendingAction!.action_id,
      "confirm",
      {
        confirmation_ref: "synthetic-confirmation-reference",
        presented_preview_hash: "0".repeat(64),
      },
    );
    const completion = await collect(
      fake.streamRunEvents(auth, accepted.run.id, state.lastEventId),
    );
    state = applyRunEvents(state, completion);
    expect(state.phase).toBe("ready");
    expect(state.pendingAction).toBeNull();
  });

  it("models linking, authenticated export, and secure handoff lifecycle in memory", async () => {
    const fake = new FakeAiClient();
    const chat = await fake.createChat(mutation("chat-export"), {
      patient_selection_ref: "self",
    });
    await fake.createMessage(auth, chat.id, {
      client_message_id: "00000000-0000-4000-8000-000000000103",
      content: "Mensagem sintética",
    });
    const challenge = await fake.createWhatsAppLinkChallenge(mutation("link-1"), {
      locale: "pt-BR",
    });
    const link = fake.completeWhatsAppLinkForTest(challenge.challenge_id);
    expect((await fake.listChannelLinks(auth)).items).toEqual([link]);

    const exported = await fake.exportChat(auth, chat.id);
    const exportText = (await collect(exported.chunks)).join("");
    expect(exported.mediaType).toBe("application/x-ndjson");
    expect(exportText).toContain('"type":"chat"');
    expect(exportText).toContain('"type":"message"');
    expect(exportText).not.toContain(auth.accessToken);

    let state = reduceEphemeralChatState(initialEphemeralChatState, {
      type: "handoff.started",
      capabilityId: "profile.upload-photo",
    });
    state = reduceEphemeralChatState(state, { type: "handoff.awaiting_return" });
    expect(state).toMatchObject({
      phase: "handoff",
      handoff: { status: "awaiting_return", capabilityId: "profile.upload-photo" },
    });
    state = reduceEphemeralChatState(state, { type: "handoff.completed" });
    expect(state.handoff.status).toBe("completed");

    expect((await fake.revokeChannelLink(mutation("revoke-1"), link.id)).status).toBe("revoked");
  });

  it("keeps fake resources owner-scoped", async () => {
    const fake = new FakeAiClient();
    const chat = await fake.createChat(mutation("chat-private"), {
      patient_selection_ref: "self",
    });

    await expect(fake.getChat({ accessToken: "fake-user-bob" }, chat.id)).rejects.toMatchObject({
      code: "not_found",
      status: 404,
    });
  });
});
