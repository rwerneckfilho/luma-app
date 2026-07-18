import type {
  ActionDecisionRequest,
  AiPublicClient,
  AuthContext,
  ChannelLink,
  ChannelLinkPage,
  Chat,
  ChatAction,
  ChatExport,
  ChatPage,
  ChatStatus,
  LinkChallenge,
  Message,
  MessagePage,
  MutationContext,
  PendingAction,
  Run,
  RunEvent,
} from "./contracts";

type FakeScenario = {
  assistantText: string;
  confirmation?: {
    capabilityId: string;
    preview: Record<string, unknown>;
  };
};

type StoredChat = Chat & { owner: string };
type StoredAction = ChatAction & { runId: string; owner: string };
type StoredChallenge = LinkChallenge & { owner: string };
type StoredLink = ChannelLink & { owner: string };

export class FakeAiError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
  ) {
    super(code);
    this.name = "FakeAiError";
  }
}

export class FakeAiClient implements AiPublicClient {
  private sequence = 0;
  private readonly chats = new Map<string, StoredChat>();
  private readonly messages = new Map<string, Message[]>();
  private readonly runs = new Map<string, Run>();
  private readonly events = new Map<string, RunEvent[]>();
  private readonly actions = new Map<string, StoredAction>();
  private readonly challenges = new Map<string, StoredChallenge>();
  private readonly links = new Map<string, StoredLink>();
  private readonly chatIdempotency = new Map<string, string>();
  private readonly messageIdempotency = new Map<
    string,
    { content: string; messageId: string; runId: string }
  >();
  private nextScenario: FakeScenario | null = null;

  queueScenario(scenario: FakeScenario) {
    this.nextScenario = scenario;
  }

  async createChat(
    context: MutationContext,
    request: { patient_selection_ref: string; title?: string },
  ): Promise<Chat> {
    const owner = this.actor(context);
    const replayKey = `${owner}:${context.idempotencyKey}`;
    const replayId = this.chatIdempotency.get(replayKey);
    if (replayId) return this.publicChat(this.requireChat(owner, replayId));

    const id = this.uuid();
    const timestamp = this.timestamp();
    const chat: StoredChat = {
      id,
      owner,
      title: request.title ?? null,
      patient: {
        kind: request.patient_selection_ref === "self" ? "self" : "care",
        label: request.patient_selection_ref === "self" ? "Você" : "Pessoa assistida",
      },
      status: "active",
      created_at: timestamp,
      updated_at: timestamp,
      delete_after: null,
    };
    this.chats.set(id, chat);
    this.messages.set(id, []);
    this.chatIdempotency.set(replayKey, id);
    return this.publicChat(chat);
  }

  async listChats(
    context: AuthContext,
    status?: ChatStatus,
  ): Promise<ChatPage> {
    const owner = this.actor(context);
    return {
      items: [...this.chats.values()]
        .filter(
          (chat) => chat.owner === owner && (!status || chat.status === status),
        )
        .map((chat) => this.publicChat(chat)),
      next_cursor: null,
    };
  }

  async getChat(context: AuthContext, chatId: string): Promise<Chat> {
    return this.publicChat(this.requireChat(this.actor(context), chatId));
  }

  async listMessages(
    context: AuthContext,
    chatId: string,
  ): Promise<MessagePage> {
    const owner = this.actor(context);
    this.requireChat(owner, chatId);
    return { items: [...(this.messages.get(chatId) ?? [])], next_cursor: null };
  }

  async createMessage(
    context: AuthContext,
    chatId: string,
    request: {
      client_message_id: string;
      content: string;
      attachment_refs?: string[];
    },
  ) {
    const owner = this.actor(context);
    const chat = this.requireChat(owner, chatId);
    const replayKey = `${owner}:${chatId}:${request.client_message_id}`;
    const replay = this.messageIdempotency.get(replayKey);
    if (replay) {
      if (replay.content !== request.content)
        throw new FakeAiError("idempotency_conflict", 409);
      return {
        message: this.findMessage(chatId, replay.messageId),
        run: this.requireRun(owner, replay.runId),
      };
    }

    const timestamp = this.timestamp();
    const message: Message = {
      id: this.uuid(),
      chat_id: chatId,
      role: "user",
      channel: "app",
      content: request.content,
      created_at: timestamp,
    };
    const runId = this.uuid();
    const scenario = this.nextScenario ?? {
      assistantText: `Echo: ${request.content}`,
    };
    this.nextScenario = null;
    const run: Run = {
      id: runId,
      chat_id: chatId,
      message_id: message.id,
      status: scenario.confirmation ? "waiting_for_action" : "succeeded",
      created_at: timestamp,
      completed_at: scenario.confirmation ? null : timestamp,
      error_code: null,
    };
    const runEvents: RunEvent[] = [
      this.runEvent(runId, 1, { type: "run.started" }),
      this.runEvent(runId, 2, {
        type: "assistant.delta",
        delta: scenario.assistantText,
      }),
    ];

    this.messages.get(chatId)?.push(message);
    if (scenario.confirmation) {
      const actionId = this.uuid();
      const pendingAction: PendingAction = {
        action_id: actionId,
        capability_id: scenario.confirmation.capabilityId,
        preview: scenario.confirmation.preview,
        expires_at: this.futureTimestamp(),
      };
      runEvents.push(
        this.runEvent(runId, 3, {
          type: "action.required",
          action: pendingAction,
        }),
      );
      this.actions.set(actionId, {
        id: actionId,
        chat_id: chatId,
        capability_id: pendingAction.capability_id,
        status: "awaiting_confirmation",
        preview: pendingAction.preview,
        expires_at: pendingAction.expires_at,
        runId,
        owner,
      });
    } else {
      runEvents.push(this.runEvent(runId, 3, { type: "run.completed" }));
      this.messages.get(chatId)?.push({
        id: this.uuid(),
        chat_id: chatId,
        role: "assistant",
        channel: "system",
        content: scenario.assistantText,
        created_at: timestamp,
      });
    }

    this.runs.set(runId, run);
    this.events.set(runId, runEvents);
    this.messageIdempotency.set(replayKey, {
      content: request.content,
      messageId: message.id,
      runId,
    });
    chat.updated_at = timestamp;
    return { message, run: { ...run } };
  }

  async getRun(context: AuthContext, runId: string): Promise<Run> {
    return { ...this.requireRun(this.actor(context), runId) };
  }

  async *streamRunEvents(context: AuthContext, runId: string, lastEventId = 0) {
    const owner = this.actor(context);
    this.requireRun(owner, runId);
    for (const event of this.events.get(runId) ?? []) {
      if (context.signal?.aborted) return;
      if (event.sequence > lastEventId) yield event;
    }
  }

  async decideAction(
    context: MutationContext,
    chatId: string,
    actionId: string,
    decision: "confirm" | "cancel",
    request: ActionDecisionRequest,
  ): Promise<ChatAction> {
    void request;
    const owner = this.actor(context);
    this.requireChat(owner, chatId);
    const action = this.actions.get(actionId);
    if (!action || action.owner !== owner || action.chat_id !== chatId) {
      throw new FakeAiError("not_found", 404);
    }
    if (action.status === "succeeded" || action.status === "cancelled")
      return this.publicAction(action);

    action.status = decision === "confirm" ? "succeeded" : "cancelled";
    const run = this.requireRun(owner, action.runId);
    run.status = "succeeded";
    run.completed_at = this.timestamp();
    const runEvents = this.events.get(run.id) ?? [];
    const text =
      decision === "confirm"
        ? "Ação sintética confirmada."
        : "Ação sintética cancelada.";
    runEvents.push(
      this.runEvent(run.id, runEvents.length + 1, {
        type: "assistant.delta",
        delta: text,
      }),
      this.runEvent(run.id, runEvents.length + 2, { type: "run.completed" }),
    );
    this.messages.get(chatId)?.push({
      id: this.uuid(),
      chat_id: chatId,
      role: "assistant",
      channel: "system",
      content: text,
      created_at: run.completed_at,
    });
    return this.publicAction(action);
  }

  async createWhatsAppLinkChallenge(
    context: MutationContext,
    request: {
      locale: "pt-BR" | "en" | "es";
      relink_policy?: "reject" | "replace_after_confirmation";
    },
  ): Promise<LinkChallenge> {
    void request;
    const challenge: StoredChallenge = {
      challenge_id: this.uuid(),
      link_code: `fake-link-${this.uuid()}`,
      expires_at: this.futureTimestamp(),
      owner: this.actor(context),
    };
    this.challenges.set(challenge.challenge_id, challenge);
    return this.publicChallenge(challenge);
  }

  completeWhatsAppLinkForTest(
    challengeId: string,
    displayHint = "•••• 0000",
  ): ChannelLink {
    const challenge = this.challenges.get(challengeId);
    if (!challenge) throw new FakeAiError("not_found", 404);
    const link: StoredLink = {
      id: this.uuid(),
      owner: challenge.owner,
      channel: "whatsapp",
      status: "active",
      display_hint: displayHint,
      created_at: this.timestamp(),
    };
    this.links.set(link.id, link);
    this.challenges.delete(challengeId);
    return this.publicLink(link);
  }

  async listChannelLinks(context: AuthContext): Promise<ChannelLinkPage> {
    const owner = this.actor(context);
    return {
      items: [...this.links.values()]
        .filter((link) => link.owner === owner)
        .map((link) => this.publicLink(link)),
    };
  }

  async revokeChannelLink(
    context: MutationContext,
    linkId: string,
  ): Promise<ChannelLink> {
    const owner = this.actor(context);
    const link = this.links.get(linkId);
    if (!link || link.owner !== owner) throw new FakeAiError("not_found", 404);
    link.status = "revoked";
    return this.publicLink(link);
  }

  async exportChat(context: AuthContext, chatId: string): Promise<ChatExport> {
    const owner = this.actor(context);
    const chat = this.publicChat(this.requireChat(owner, chatId));
    const messages = [...(this.messages.get(chatId) ?? [])];
    return {
      mediaType: "application/x-ndjson",
      chunks: (async function* () {
        yield `${JSON.stringify({ type: "chat", data: chat })}\n`;
        for (const message of messages) {
          yield `${JSON.stringify({ type: "message", data: message })}\n`;
        }
      })(),
    };
  }

  private actor(context: AuthContext): string {
    if (context.signal?.aborted)
      throw new FakeAiError("request_cancelled", 499);
    const match = /^fake-user-([A-Za-z0-9_-]{1,64})$/.exec(context.accessToken);
    if (!match) throw new FakeAiError("invalid_fake_identity", 401);
    return match[1];
  }

  private requireChat(owner: string, chatId: string): StoredChat {
    const chat = this.chats.get(chatId);
    if (!chat || chat.owner !== owner) throw new FakeAiError("not_found", 404);
    if (chat.status === "access_changed")
      throw new FakeAiError("access_changed", 410);
    return chat;
  }

  private requireRun(owner: string, runId: string): Run {
    const run = this.runs.get(runId);
    if (!run) throw new FakeAiError("not_found", 404);
    this.requireChat(owner, run.chat_id);
    return run;
  }

  private findMessage(chatId: string, messageId: string): Message {
    const message = this.messages
      .get(chatId)
      ?.find((item) => item.id === messageId);
    if (!message) throw new FakeAiError("not_found", 404);
    return message;
  }

  private publicChat(stored: StoredChat): Chat {
    const { owner, ...chat } = stored;
    void owner;
    return { ...chat };
  }

  private publicAction(stored: StoredAction): ChatAction {
    const { owner, runId, ...action } = stored;
    void owner;
    void runId;
    return { ...action };
  }

  private publicChallenge(stored: StoredChallenge): LinkChallenge {
    const { owner, ...challenge } = stored;
    void owner;
    return { ...challenge };
  }

  private publicLink(stored: StoredLink): ChannelLink {
    const { owner, ...link } = stored;
    void owner;
    return { ...link };
  }

  private runEvent(
    runId: string,
    sequence: number,
    event:
      | { type: "run.started" }
      | { type: "assistant.delta"; delta: string }
      | { type: "action.required"; action: PendingAction }
      | { type: "run.completed" }
      | { type: "run.failed"; error_code: string },
  ): RunEvent {
    return {
      version: "0.1.0",
      event_id: this.uuid(),
      run_id: runId,
      sequence,
      created_at: this.timestamp(),
      ...event,
    } as RunEvent;
  }

  private uuid() {
    this.sequence += 1;
    return `00000000-0000-4000-8000-${this.sequence.toString().padStart(12, "0")}`;
  }

  private timestamp() {
    return new Date(Date.UTC(2026, 6, 17, 12, 0, this.sequence)).toISOString();
  }

  private futureTimestamp() {
    return new Date(Date.UTC(2026, 6, 17, 12, 10, this.sequence)).toISOString();
  }
}
