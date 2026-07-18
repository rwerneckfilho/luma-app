import type {
  ActionStatus,
  AiPublicClient,
  AuthContext,
  Chat,
  ChatAction,
  ChatStatus,
  Message,
  MutationContext,
  PendingAction,
  RunEvent,
  RunStatus,
} from "./contracts";
import type { ChatStateEvent } from "./chatState";

export type AiUiErrorCode =
  | "access_changed"
  | "connection_unavailable"
  | "conflict"
  | "not_found"
  | "request_cancelled"
  | "session_expired"
  | "unexpected";

export type RunConsumptionOutcome =
  "cancelled" | "completed" | "failed" | "waiting_confirmation";

export type RunConsumptionResult = {
  lastEventId: number;
  outcome: RunConsumptionOutcome;
};

const ACCEPTED_ACTION_STATUSES: Record<"confirm" | "cancel", Set<ActionStatus>> = {
  cancel: new Set(["cancelled"]),
  confirm: new Set(["executing", "succeeded"]),
};

function invalidContractResponse() {
  return Object.assign(new Error("invalid_contract_response"), {
    code: "invalid_contract_response",
    status: 502,
  });
}

/** Submit only the opaque proof attached to the exact server-presented action. */
export async function submitActionDecision({
  action,
  chatId,
  client,
  context,
  decision,
}: {
  action: PendingAction;
  chatId: string;
  client: AiPublicClient;
  context: MutationContext;
  decision: "confirm" | "cancel";
}): Promise<ChatAction> {
  const result = await client.decideAction(
    context,
    chatId,
    action.action_id,
    decision,
    {
      confirmation_ref: action.confirmation_ref,
      presented_preview_hash: action.presented_preview_hash,
    },
  );
  if (
    result.id !== action.action_id ||
    result.chat_id !== chatId ||
    result.capability_id !== action.capability_id ||
    result.confirmation_ref !== action.confirmation_ref ||
    result.presented_preview_hash !== action.presented_preview_hash ||
    !ACCEPTED_ACTION_STATUSES[decision].has(result.status)
  ) {
    throw invalidContractResponse();
  }
  return result;
}

type ErrorShape = { code?: unknown; name?: unknown; status?: unknown };

function errorShape(error: unknown): ErrorShape {
  return error && typeof error === "object" ? (error as ErrorShape) : {};
}

export function isAbortError(error: unknown) {
  const shape = errorShape(error);
  return (
    shape.name === "AbortError" ||
    shape.code === "request_cancelled" ||
    shape.status === 499
  );
}

export function aiUiErrorCode(error: unknown): AiUiErrorCode {
  const shape = errorShape(error);
  if (isAbortError(error)) return "request_cancelled";
  if (shape.status === 401 || shape.code === "unauthenticated")
    return "session_expired";
  if (shape.status === 404 || shape.code === "not_found") return "not_found";
  if (shape.status === 409 || shape.code === "idempotency_conflict")
    return "conflict";
  if (shape.status === 410 || shape.code === "access_changed")
    return "access_changed";
  if (shape.status === 502 || shape.status === 503 || shape.status === 504) {
    return "connection_unavailable";
  }
  return "unexpected";
}

function outcomeForStatus(status: RunStatus): RunConsumptionOutcome | null {
  if (status === "succeeded") return "completed";
  if (status === "failed" || status === "cancelled") return "failed";
  if (status === "waiting_for_action") return "waiting_confirmation";
  return null;
}

function outcomeForEvent(event: RunEvent): RunConsumptionOutcome | null {
  if (event.type === "run.completed") return "completed";
  if (event.type === "run.failed") return "failed";
  if (event.type === "action.required") return "waiting_confirmation";
  return null;
}

function dispatchFailure(
  dispatch: (event: ChatStateEvent) => void,
  error: unknown,
): RunConsumptionOutcome {
  const code = aiUiErrorCode(error);
  if (code === "access_changed") {
    dispatch({ type: "access.changed" });
  } else if (code !== "request_cancelled") {
    dispatch({ type: "failed", errorCode: code });
  }
  return code === "request_cancelled" ? "cancelled" : "failed";
}

export async function consumeRunEvents({
  client,
  context,
  dispatch,
  lastEventId = 0,
  maxReconnectAttempts = 3,
  runId,
  waitBeforeReconnect = async () => undefined,
}: {
  client: AiPublicClient;
  context: AuthContext;
  dispatch: (event: ChatStateEvent) => void;
  lastEventId?: number;
  maxReconnectAttempts?: number;
  runId: string;
  waitBeforeReconnect?: (
    attempt: number,
    signal?: AbortSignal,
  ) => Promise<void>;
}): Promise<RunConsumptionResult> {
  let cursor = lastEventId;
  let reconnectAttempt = 0;

  while (!context.signal?.aborted) {
    try {
      for await (const event of client.streamRunEvents(
        context,
        runId,
        cursor,
      )) {
        if (event.sequence <= cursor) continue;
        cursor = event.sequence;
        dispatch({ type: "stream.event", event });
        const outcome = outcomeForEvent(event);
        if (outcome) return { lastEventId: cursor, outcome };
      }

      const run = await client.getRun(context, runId);
      const outcome = outcomeForStatus(run.status);
      if (outcome) return { lastEventId: cursor, outcome };
    } catch (error) {
      if (isAbortError(error) || context.signal?.aborted) {
        return { lastEventId: cursor, outcome: "cancelled" };
      }
      const code = aiUiErrorCode(error);
      if (code !== "connection_unavailable" && code !== "unexpected") {
        return {
          lastEventId: cursor,
          outcome: dispatchFailure(dispatch, error),
        };
      }
    }

    if (reconnectAttempt >= maxReconnectAttempts) {
      dispatch({ type: "failed", errorCode: "connection_unavailable" });
      return { lastEventId: cursor, outcome: "failed" };
    }

    reconnectAttempt += 1;
    dispatch({ type: "stream.disconnected" });
    try {
      await waitBeforeReconnect(reconnectAttempt, context.signal);
    } catch (error) {
      return { lastEventId: cursor, outcome: dispatchFailure(dispatch, error) };
    }
  }

  return { lastEventId: cursor, outcome: "cancelled" };
}

export async function listCompleteTranscript(
  client: AiPublicClient,
  context: AuthContext,
  chatId: string,
): Promise<Message[]> {
  const messages: Message[] = [];
  const visitedMessageIds = new Set<string>();
  const visitedCursors = new Set<string>();
  let cursor: string | undefined;

  while (!context.signal?.aborted) {
    const page = await client.listMessages(context, chatId, cursor);
    for (const message of page.items) {
      if (visitedMessageIds.has(message.id)) continue;
      visitedMessageIds.add(message.id);
      messages.push(message);
    }
    const nextCursor = page.next_cursor ?? undefined;
    if (!nextCursor) return messages;
    if (visitedCursors.has(nextCursor)) throw new Error("message_cursor_cycle");
    visitedCursors.add(nextCursor);
    cursor = nextCursor;
  }

  throw Object.assign(new Error("request_cancelled"), {
    code: "request_cancelled",
    name: "AbortError",
    status: 499,
  });
}

export async function listCompleteChats(
  client: AiPublicClient,
  context: AuthContext,
  status: ChatStatus,
): Promise<Chat[]> {
  const chats: Chat[] = [];
  const visitedChatIds = new Set<string>();
  const visitedCursors = new Set<string>();
  let cursor: string | undefined;

  while (!context.signal?.aborted) {
    const page = await client.listChats(context, status, cursor);
    for (const chat of page.items) {
      if (visitedChatIds.has(chat.id)) continue;
      visitedChatIds.add(chat.id);
      chats.push(chat);
    }
    const nextCursor = page.next_cursor ?? undefined;
    if (!nextCursor) return chats;
    if (visitedCursors.has(nextCursor)) throw new Error("chat_cursor_cycle");
    visitedCursors.add(nextCursor);
    cursor = nextCursor;
  }

  throw Object.assign(new Error("request_cancelled"), {
    code: "request_cancelled",
    name: "AbortError",
    status: 499,
  });
}
