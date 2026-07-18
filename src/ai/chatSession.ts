import type {
  AiPublicClient,
  AuthContext,
  Message,
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
  const visitedCursors = new Set<string>();
  let cursor: string | undefined;

  do {
    const page = await client.listMessages(context, chatId, cursor);
    messages.push(...page.items);
    const nextCursor = page.next_cursor ?? undefined;
    if (!nextCursor) return messages;
    if (visitedCursors.has(nextCursor)) throw new Error("message_cursor_cycle");
    visitedCursors.add(nextCursor);
    cursor = nextCursor;
  } while (!context.signal?.aborted);

  return messages;
}
