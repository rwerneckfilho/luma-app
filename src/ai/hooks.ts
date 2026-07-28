import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { AppState } from "react-native";
import type { Chat, ChatStatus } from "./contracts";
import {
  consumeRunEvents,
  aiUiErrorCode,
  isAbortError,
  listCompleteChats,
  listCompleteTranscript,
  submitActionDecision,
} from "./chatSession";
import {
  initialEphemeralChatState,
  reduceEphemeralChatState,
  type EphemeralChatState,
} from "./chatState";
import { createClientRequestId } from "./requestIds";
import { useAiRuntime } from "./runtime";

const AI_EPHEMERAL_KEY = ["ai", "ephemeral"] as const;

export const aiQueryKeys = {
  all: AI_EPHEMERAL_KEY,
  chat: (scope: string, chatId: string) =>
    [...AI_EPHEMERAL_KEY, scope, "chat", chatId] as const,
  chats: (scope: string, status: ChatStatus) =>
    [...AI_EPHEMERAL_KEY, scope, "chats", status] as const,
};

function requireClient(runtime: ReturnType<typeof useAiRuntime>) {
  if (!runtime.client) throw new Error("ai_client_unavailable");
  return runtime.client;
}

function sortChats(chats: Chat[]) {
  return [...chats].sort((left, right) =>
    right.updated_at.localeCompare(left.updated_at),
  );
}

export function useAiChats(status: ChatStatus = "active") {
  const runtime = useAiRuntime();
  return useQuery({
    enabled: runtime.isReady,
    queryFn: async () => {
      const chats = await listCompleteChats(
        requireClient(runtime),
        runtime.authContext(),
        status,
      );
      return sortChats(chats);
    },
    queryKey: aiQueryKeys.chats(runtime.cacheScope, status),
  });
}

export function useAiChat(chatId: string) {
  const runtime = useAiRuntime();
  return useQuery({
    enabled: runtime.isReady && Boolean(chatId),
    queryFn: () =>
      requireClient(runtime).getChat(runtime.authContext(), chatId),
    queryKey: aiQueryKeys.chat(runtime.cacheScope, chatId),
  });
}

export function useCreateAiChat() {
  const runtime = useAiRuntime();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ title }: { title?: string } = {}) =>
      requireClient(runtime).createChat(
        runtime.mutationContext(createClientRequestId()),
        {
          patient_selection_ref: "self",
          ...(title?.trim() ? { title: title.trim() } : {}),
        },
      ),
    onSuccess: (chat) => {
      queryClient.setQueryData(
        aiQueryKeys.chat(runtime.cacheScope, chat.id),
        chat,
      );
      void queryClient.invalidateQueries({ queryKey: aiQueryKeys.all });
    },
  });
}

function reconnectDelay(attempt: number, signal?: AbortSignal) {
  const duration = Math.min(2_000, 250 * 2 ** (attempt - 1));
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(
        Object.assign(new Error("request_cancelled"), { name: "AbortError" }),
      );
      return;
    }
    const timeout = setTimeout(resolve, duration);
    signal?.addEventListener(
      "abort",
      () => {
        clearTimeout(timeout);
        reject(
          Object.assign(new Error("request_cancelled"), { name: "AbortError" }),
        );
      },
      { once: true },
    );
  });
}

export function useAiChatSession(chatId: string) {
  const runtime = useAiRuntime();
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(
    reduceEphemeralChatState,
    initialEphemeralChatState,
  );
  const activeRequest = useRef<AbortController | null>(null);
  const operation = useRef(0);
  const submitting = useRef(false);
  const deciding = useRef(false);
  const decisionKeys = useRef(new Map<string, string>());
  const [actionDecision, setActionDecision] = useState<{
    decision: "confirm" | "cancel" | null;
    errorCode: string | null;
    status: "idle" | "submitting" | "accepted" | "failed";
  }>({ decision: null, errorCode: null, status: "idle" });
  const stateRef = useRef(state);
  const loadTranscriptRef = useRef<(showLoading?: boolean) => Promise<void>>(
    async () => undefined,
  );
  const retryRef = useRef<() => Promise<void>>(async () => undefined);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    deciding.current = false;
    setActionDecision({ decision: null, errorCode: null, status: "idle" });
  }, [state.pendingAction?.action_id]);

  const beginOperation = useCallback(() => {
    operation.current += 1;
    activeRequest.current?.abort();
    const controller = new AbortController();
    activeRequest.current = controller;
    return { controller, id: operation.current };
  }, []);

  const loadTranscript = useCallback(
    async (showLoading = true) => {
      if (!runtime.isReady || !chatId) return;
      const current = beginOperation();
      if (showLoading) dispatch({ type: "load.started", chatId });
      try {
        const messages = await listCompleteTranscript(
          requireClient(runtime),
          runtime.authContext(current.controller.signal),
          chatId,
        );
        if (
          current.id === operation.current &&
          !current.controller.signal.aborted
        ) {
          dispatch({ type: "load.succeeded", chatId, messages });
        }
      } catch (error) {
        if (current.id !== operation.current || isAbortError(error)) return;
        const code = aiUiErrorCode(error);
        dispatch(
          code === "access_changed"
            ? { type: "access.changed" }
            : { type: "failed", errorCode: code },
        );
      }
    },
    [beginOperation, chatId, runtime],
  );

  useEffect(() => {
    void loadTranscript();
    return () => {
      operation.current += 1;
      activeRequest.current?.abort();
    };
  }, [loadTranscript]);

  const consume = useCallback(
    async (runId: string, lastEventId: number, controller: AbortController) =>
      consumeRunEvents({
        client: requireClient(runtime),
        context: runtime.authContext(controller.signal),
        dispatch,
        lastEventId,
        runId,
        waitBeforeReconnect: reconnectDelay,
      }),
    [runtime],
  );

  useEffect(() => {
    loadTranscriptRef.current = loadTranscript;
  }, [loadTranscript]);

  const send = useCallback(
    async (rawContent: string) => {
      const content = rawContent.trim();
      if (
        !content ||
        content.length > 16_000 ||
        submitting.current ||
        !runtime.isReady
      )
        return false;
      submitting.current = true;
      const current = beginOperation();
      let acceptedByBackend = false;
      dispatch({ type: "message.submitting" });
      try {
        const accepted = await requireClient(runtime).createMessage(
          runtime.authContext(current.controller.signal),
          chatId,
          { client_message_id: createClientRequestId(), content },
        );
        acceptedByBackend = true;
        if (
          current.id !== operation.current ||
          current.controller.signal.aborted
        )
          return false;
        dispatch({ type: "message.accepted", accepted });
        const result = await consume(accepted.run.id, 0, current.controller);
        if (
          result.outcome === "completed" &&
          current.id === operation.current
        ) {
          const messages = await listCompleteTranscript(
            requireClient(runtime),
            runtime.authContext(current.controller.signal),
            chatId,
          );
          if (
            current.id === operation.current &&
            !current.controller.signal.aborted
          ) {
            dispatch({ type: "load.succeeded", chatId, messages });
            void queryClient.invalidateQueries({ queryKey: aiQueryKeys.all });
          }
        }
        return true;
      } catch (error) {
        if (current.id === operation.current && !isAbortError(error)) {
          const code = aiUiErrorCode(error);
          dispatch(
            code === "access_changed"
              ? { type: "access.changed" }
              : { type: "failed", errorCode: code },
          );
        }
        return acceptedByBackend;
      } finally {
        submitting.current = false;
      }
    },
    [beginOperation, chatId, consume, queryClient, runtime],
  );

  const retry = useCallback(async () => {
    if (!runtime.isReady) return;
    if (!state.activeRunId) {
      await loadTranscript();
      return;
    }
    const current = beginOperation();
    const result = await consume(
      state.activeRunId,
      state.lastEventId,
      current.controller,
    );
    if (result.outcome === "completed" && current.id === operation.current) {
      await loadTranscript(false);
    }
  }, [
    beginOperation,
    consume,
    loadTranscript,
    state.activeRunId,
    state.lastEventId,
    runtime.isReady,
  ]);

  const decideAction = useCallback(
    async (decision: "confirm" | "cancel") => {
      const snapshot = stateRef.current;
      const action = snapshot.pendingAction;
      const runId = snapshot.activeRunId;
      if (
        !runtime.isReady ||
        !action ||
        !runId ||
        snapshot.phase !== "waiting_confirmation" ||
        deciding.current
      ) {
        return false;
      }
      deciding.current = true;
      setActionDecision({ decision, errorCode: null, status: "submitting" });
      const current = beginOperation();
      const keyId = `${action.action_id}:${decision}`;
      let idempotencyKey = decisionKeys.current.get(keyId);
      if (!idempotencyKey) {
        idempotencyKey = createClientRequestId();
        decisionKeys.current.set(keyId, idempotencyKey);
      }
      try {
        await submitActionDecision({
          action,
          chatId,
          client: requireClient(runtime),
          context: runtime.mutationContext(
            idempotencyKey,
            current.controller.signal,
          ),
          decision,
        });
        if (
          current.id !== operation.current ||
          current.controller.signal.aborted
        ) {
          return false;
        }
        setActionDecision({ decision, errorCode: null, status: "accepted" });
        const result = await consume(
          runId,
          snapshot.lastEventId,
          current.controller,
        );
        if (
          result.outcome === "completed" &&
          current.id === operation.current
        ) {
          await loadTranscript(false);
          void queryClient.invalidateQueries({ queryKey: aiQueryKeys.all });
        }
        return true;
      } catch (error) {
        if (current.id !== operation.current || isAbortError(error)) return false;
        const code = aiUiErrorCode(error);
        if (code === "access_changed") dispatch({ type: "access.changed" });
        setActionDecision({ decision, errorCode: code, status: "failed" });
        return false;
      } finally {
        deciding.current = false;
      }
    }, [
      beginOperation,
      chatId,
      consume,
      loadTranscript,
      queryClient,
      runtime,
    ],
  );

  useEffect(() => {
    retryRef.current = retry;
  }, [retry]);

  useEffect(() => {
    let previousState = AppState.currentState;
    const subscription = AppState.addEventListener("change", (nextState) => {
      const wasActive = previousState === "active";
      previousState = nextState;
      const snapshot = stateRef.current;
      const run = snapshot.activeRunId;
      if (nextState !== "active" && snapshot.phase !== "submitting") {
        operation.current += 1;
        activeRequest.current?.abort();
        if (run) dispatch({ type: "stream.disconnected" });
      } else if (nextState === "active" && !wasActive && run) {
        void retryRef.current();
      } else if (
        nextState === "active" &&
        !wasActive &&
        (snapshot.needsTranscriptRefresh || snapshot.phase === "loading")
      ) {
        void loadTranscriptRef.current(snapshot.phase === "loading");
      }
    });
    return () => subscription.remove();
  }, []);

  return {
    actionDecision,
    decideAction,
    reload: loadTranscript,
    retry,
    send,
    state: state as EphemeralChatState,
  };
}
