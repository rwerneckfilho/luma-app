import type {
  AcceptedMessage,
  Message,
  PendingAction,
  RunEvent,
} from "./contracts";

export type ChatSurfacePhase =
  | "idle"
  | "loading"
  | "empty"
  | "ready"
  | "submitting"
  | "streaming"
  | "waiting_confirmation"
  | "reconnecting"
  | "handoff"
  | "access_changed"
  | "error";

export type SecureHandoff =
  | { status: "idle" }
  | { status: "opening"; capabilityId: string }
  | { status: "awaiting_return"; capabilityId: string }
  | { status: "completed"; capabilityId: string }
  | { status: "failed"; capabilityId: string; errorCode: string };

export type EphemeralChatState = {
  phase: ChatSurfacePhase;
  chatId: string | null;
  messages: Message[];
  activeRunId: string | null;
  lastEventId: number;
  assistantDraft: string;
  pendingAction: PendingAction | null;
  handoff: SecureHandoff;
  needsTranscriptRefresh: boolean;
  errorCode: string | null;
};

export const initialEphemeralChatState: EphemeralChatState = {
  phase: "idle",
  chatId: null,
  messages: [],
  activeRunId: null,
  lastEventId: 0,
  assistantDraft: "",
  pendingAction: null,
  handoff: { status: "idle" },
  needsTranscriptRefresh: false,
  errorCode: null,
};

export type ChatStateEvent =
  | { type: "load.started"; chatId: string }
  | { type: "load.succeeded"; chatId: string; messages: Message[] }
  | { type: "message.submitting" }
  | { type: "message.accepted"; accepted: AcceptedMessage }
  | { type: "stream.event"; event: RunEvent }
  | { type: "stream.disconnected" }
  | { type: "handoff.started"; capabilityId: string }
  | { type: "handoff.awaiting_return" }
  | { type: "handoff.completed" }
  | { type: "handoff.failed"; errorCode: string }
  | { type: "access.changed" }
  | { type: "failed"; errorCode: string }
  | { type: "reset" };

function reduceRunEvent(
  state: EphemeralChatState,
  event: RunEvent,
): EphemeralChatState {
  if (
    state.activeRunId !== event.run_id ||
    event.sequence <= state.lastEventId
  ) {
    return state;
  }

  const replayState = { ...state, lastEventId: event.sequence };
  switch (event.type) {
    case "run.started":
      return { ...replayState, phase: "streaming" };
    case "assistant.delta":
      return {
        ...replayState,
        phase: "streaming",
        assistantDraft: `${state.assistantDraft}${event.delta}`,
      };
    case "action.required":
      return {
        ...replayState,
        phase: "waiting_confirmation",
        pendingAction: event.action,
      };
    case "run.completed":
      return {
        ...replayState,
        phase: state.messages.length > 0 ? "ready" : "empty",
        activeRunId: null,
        assistantDraft: "",
        pendingAction: null,
        needsTranscriptRefresh: true,
      };
    case "run.failed":
      return {
        ...replayState,
        phase: "error",
        activeRunId: null,
        pendingAction: null,
        errorCode: event.error_code,
      };
  }
}

export function reduceEphemeralChatState(
  state: EphemeralChatState,
  event: ChatStateEvent,
): EphemeralChatState {
  switch (event.type) {
    case "load.started":
      return {
        ...initialEphemeralChatState,
        phase: "loading",
        chatId: event.chatId,
      };
    case "load.succeeded":
      return {
        ...initialEphemeralChatState,
        phase: event.messages.length > 0 ? "ready" : "empty",
        chatId: event.chatId,
        messages: event.messages,
      };
    case "message.submitting":
      return { ...state, phase: "submitting", errorCode: null };
    case "message.accepted":
      return {
        ...state,
        phase: "streaming",
        messages: [...state.messages, event.accepted.message],
        activeRunId: event.accepted.run.id,
        lastEventId: 0,
        assistantDraft: "",
        pendingAction: null,
        needsTranscriptRefresh: false,
      };
    case "stream.event":
      return reduceRunEvent(state, event.event);
    case "stream.disconnected":
      return state.activeRunId ? { ...state, phase: "reconnecting" } : state;
    case "handoff.started":
      return {
        ...state,
        phase: "handoff",
        handoff: { status: "opening", capabilityId: event.capabilityId },
      };
    case "handoff.awaiting_return":
      return state.handoff.status === "opening"
        ? {
            ...state,
            handoff: {
              status: "awaiting_return",
              capabilityId: state.handoff.capabilityId,
            },
          }
        : state;
    case "handoff.completed":
      return state.handoff.status === "opening" ||
        state.handoff.status === "awaiting_return"
        ? {
            ...state,
            phase: state.messages.length > 0 ? "ready" : "empty",
            handoff: {
              status: "completed",
              capabilityId: state.handoff.capabilityId,
            },
            needsTranscriptRefresh: true,
          }
        : state;
    case "handoff.failed":
      return state.handoff.status === "opening" ||
        state.handoff.status === "awaiting_return"
        ? {
            ...state,
            phase: "error",
            handoff: {
              status: "failed",
              capabilityId: state.handoff.capabilityId,
              errorCode: event.errorCode,
            },
            errorCode: event.errorCode,
          }
        : state;
    case "access.changed":
      return {
        ...state,
        phase: "access_changed",
        activeRunId: null,
        assistantDraft: "",
        pendingAction: null,
        errorCode: "access_changed",
      };
    case "failed":
      return { ...state, phase: "error", errorCode: event.errorCode };
    case "reset":
      return initialEphemeralChatState;
  }
}
