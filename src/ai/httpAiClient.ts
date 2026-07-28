import { fetch as expoFetch } from "expo/fetch";
import type { z } from "zod";
import { notifyAuthSessionInvalid } from "../lib/apiClient";
import {
  AiClientConfigurationError,
  normalizeAiApiBaseUrl,
} from "./baseUrl";
import {
  acceptedMessageSchema,
  actionSchema,
  channelLinkPageSchema,
  chatPageSchema,
  chatSchema,
  chatExportRecordSchema,
  completeExportRecordSchema,
  errorEnvelopeSchema,
  linkChallengeSchema,
  messagePageSchema,
  messageExportRecordSchema,
  runEventSchema,
  runSchema,
} from "./contractSchemas";
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
  MessagePage,
  MutationContext,
  Run,
  RunEvent,
} from "./contracts";
import { createClientRequestId } from "./requestIds";
import { decodeSse, SseProtocolError } from "./sse";

const MAX_JSON_RESPONSE_BYTES = 5 * 1024 * 1024;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AiFetch = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export type HttpAiClientOptions = {
  allowInsecureLoopback?: boolean;
  baseUrl: string;
  fetch?: AiFetch;
  requestIdFactory?: () => string;
};

export class AiHttpError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    public readonly correlationId?: string,
  ) {
    super(code);
    this.name = code === "request_cancelled" ? "AbortError" : "AiHttpError";
  }
}

type RequestLease = {
  release: () => void;
  signal: AbortSignal;
};

type OpenResponse = RequestLease & { response: Response };

type RequestSpec = {
  accept?: string;
  body?: unknown;
  context: AuthContext;
  expectedStatuses: readonly number[];
  idempotencyKey?: string;
  method?: "DELETE" | "GET" | "PATCH" | "POST";
  path: string;
};

function safeUuid(value: string) {
  return UUID_PATTERN.test(value) && !/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(value);
}

export { AiClientConfigurationError, normalizeAiApiBaseUrl } from "./baseUrl";

function requireUuid(value: string) {
  if (!safeUuid(value)) throw new AiClientConfigurationError();
  return value;
}

function requireAccessToken(context: AuthContext) {
  const token = context.accessToken;
  if (!token || token !== token.trim() || /[\r\n]/.test(token)) {
    throw new AiHttpError("unauthenticated", 401);
  }
  return token;
}

function mediaType(response: Response) {
  return response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
}

function abortError() {
  return new AiHttpError("request_cancelled", 499);
}

async function responseText(response: Response) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_JSON_RESPONSE_BYTES) {
    throw new AiHttpError("invalid_contract_response", 502);
  }
  const text = await response.text();
  if (text.length > MAX_JSON_RESPONSE_BYTES) {
    throw new AiHttpError("invalid_contract_response", 502);
  }
  return text;
}

async function parseJson(response: Response): Promise<unknown> {
  if (mediaType(response) !== "application/json") {
    throw new AiHttpError("invalid_contract_response", 502);
  }
  const text = await responseText(response);
  try {
    return JSON.parse(text) as unknown;
  } catch {
    throw new AiHttpError("invalid_contract_response", 502);
  }
}

function parseContract<T>(schema: z.ZodType<T>, payload: unknown): T {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) throw new AiHttpError("invalid_contract_response", 502);
  return parsed.data;
}

type ExportValidationState = {
  complete: boolean;
  messageCount: number;
  sawChat: boolean;
};

function validateExportLine(
  line: string,
  expectedChatId: string,
  state: ExportValidationState,
) {
  if (!line || line.length > MAX_JSON_RESPONSE_BYTES || state.complete) {
    throw new AiHttpError("invalid_contract_response", 502);
  }
  let payload: unknown;
  try {
    payload = JSON.parse(line) as unknown;
  } catch {
    throw new AiHttpError("invalid_contract_response", 502);
  }
  if (!payload || typeof payload !== "object" || !("type" in payload)) {
    throw new AiHttpError("invalid_contract_response", 502);
  }
  const recordType = (payload as { type?: unknown }).type;
  if (recordType === "chat" && !state.sawChat) {
    const record = parseContract(chatExportRecordSchema, payload);
    if (record.chat.id !== expectedChatId) {
      throw new AiHttpError("invalid_contract_response", 502);
    }
    state.sawChat = true;
    return;
  }
  if (recordType === "message" && state.sawChat) {
    const record = parseContract(messageExportRecordSchema, payload);
    if (record.message.chat_id !== expectedChatId) {
      throw new AiHttpError("invalid_contract_response", 502);
    }
    state.messageCount += 1;
    return;
  }
  if (recordType === "complete" && state.sawChat) {
    const record = parseContract(completeExportRecordSchema, payload);
    if (record.message_count !== state.messageCount) {
      throw new AiHttpError("invalid_contract_response", 502);
    }
    state.complete = true;
    return;
  }
  throw new AiHttpError("invalid_contract_response", 502);
}

export class HttpAiPublicClient implements AiPublicClient {
  private readonly activeRequests = new Set<AbortController>();
  private readonly baseUrl: string;
  private readonly fetcher: AiFetch;
  private readonly requestIdFactory: () => string;

  constructor(options: HttpAiClientOptions) {
    this.baseUrl = normalizeAiApiBaseUrl(
      options.baseUrl,
      options.allowInsecureLoopback,
    );
    this.fetcher = options.fetch ?? ((input, init) => expoFetch(input, init));
    this.requestIdFactory = options.requestIdFactory ?? createClientRequestId;
  }

  cancelAll() {
    for (const controller of this.activeRequests) controller.abort();
    this.activeRequests.clear();
  }

  async createChat(
    context: MutationContext,
    request: { patient_selection_ref: string; title?: string },
  ): Promise<Chat> {
    return this.requestJson({
      body: request,
      context,
      expectedStatuses: [201],
      idempotencyKey: context.idempotencyKey,
      method: "POST",
      path: "/v1/chats",
      schema: chatSchema,
    });
  }

  async listChats(
    context: AuthContext,
    status?: ChatStatus,
    cursor?: string,
  ): Promise<ChatPage> {
    const query = new URLSearchParams();
    if (status) query.set("status", status);
    if (cursor) query.set("cursor", cursor);
    return this.requestJson({
      context,
      expectedStatuses: [200],
      path: `/v1/chats${query.size ? `?${query}` : ""}`,
      schema: chatPageSchema,
    });
  }

  async getChat(context: AuthContext, chatId: string): Promise<Chat> {
    return this.requestJson({
      context,
      expectedStatuses: [200],
      path: `/v1/chats/${encodeURIComponent(requireUuid(chatId))}`,
      schema: chatSchema,
    });
  }

  async listMessages(
    context: AuthContext,
    chatId: string,
    cursor?: string,
  ): Promise<MessagePage> {
    const query = new URLSearchParams();
    if (cursor) query.set("cursor", cursor);
    return this.requestJson({
      context,
      expectedStatuses: [200],
      path: `/v1/chats/${encodeURIComponent(requireUuid(chatId))}/messages${
        query.size ? `?${query}` : ""
      }`,
      schema: messagePageSchema,
    });
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
    requireUuid(request.client_message_id);
    return this.requestJson({
      body: { ...request, channel: "app" },
      context,
      expectedStatuses: [202],
      method: "POST",
      path: `/v1/chats/${encodeURIComponent(requireUuid(chatId))}/messages`,
      schema: acceptedMessageSchema,
    });
  }

  async getRun(context: AuthContext, runId: string): Promise<Run> {
    return this.requestJson({
      context,
      expectedStatuses: [200],
      path: `/v1/runs/${encodeURIComponent(requireUuid(runId))}`,
      schema: runSchema,
    });
  }

  async *streamRunEvents(
    context: AuthContext,
    runId: string,
    lastEventId = 0,
  ): AsyncIterable<RunEvent> {
    if (!Number.isSafeInteger(lastEventId) || lastEventId < 0) {
      throw new AiClientConfigurationError();
    }
    const expectedRunId = requireUuid(runId);
    const opened = await this.open({
      accept: "text/event-stream",
      context,
      expectedStatuses: [200],
      path: `/v1/runs/${encodeURIComponent(expectedRunId)}/events`,
    }, lastEventId > 0 ? { "Last-Event-ID": String(lastEventId) } : undefined);

    try {
      if (mediaType(opened.response) !== "text/event-stream" || !opened.response.body) {
        throw new AiHttpError("invalid_contract_response", 502);
      }
      let cursor = lastEventId;
      for await (const frame of decodeSse(opened.response.body)) {
        let payload: unknown;
        try {
          payload = JSON.parse(frame.data) as unknown;
        } catch {
          throw new AiHttpError("invalid_contract_response", 502);
        }
        const event = parseContract(runEventSchema, payload);
        const frameSequence = frame.id && /^\d+$/.test(frame.id) ? Number(frame.id) : NaN;
        if (
          !Number.isSafeInteger(frameSequence) ||
          frameSequence !== event.sequence ||
          frame.event !== event.type ||
          event.run_id !== expectedRunId
        ) {
          throw new AiHttpError("invalid_contract_response", 502);
        }
        if (event.sequence <= cursor) continue;
        cursor = event.sequence;
        yield event;
      }
    } catch (error) {
      if (opened.signal.aborted) throw abortError();
      if (error instanceof SseProtocolError) {
        throw new AiHttpError("invalid_contract_response", 502);
      }
      throw error;
    } finally {
      opened.release();
    }
  }

  async decideAction(
    context: MutationContext,
    chatId: string,
    actionId: string,
    decision: "confirm" | "cancel",
    request: ActionDecisionRequest,
  ): Promise<ChatAction> {
    return this.requestJson({
      body: request,
      context,
      expectedStatuses: decision === "confirm" ? [202] : [200],
      idempotencyKey: context.idempotencyKey,
      method: "POST",
      path: `/v1/chats/${encodeURIComponent(requireUuid(chatId))}/actions/${encodeURIComponent(
        requireUuid(actionId),
      )}/${decision}`,
      schema: actionSchema,
    });
  }

  async createWhatsAppLinkChallenge(
    context: MutationContext,
    request: {
      locale: "pt-BR" | "en" | "es";
      relink_policy?: "reject" | "replace_after_confirmation";
    },
  ): Promise<LinkChallenge> {
    return this.requestJson({
      body: request,
      context,
      expectedStatuses: [201],
      idempotencyKey: context.idempotencyKey,
      method: "POST",
      path: "/v1/channel-links/whatsapp/challenges",
      schema: linkChallengeSchema,
    });
  }

  async listChannelLinks(context: AuthContext): Promise<ChannelLinkPage> {
    return this.requestJson({
      context,
      expectedStatuses: [200],
      path: "/v1/channel-links",
      schema: channelLinkPageSchema,
    });
  }

  async revokeChannelLink(
    context: MutationContext,
    linkId: string,
  ): Promise<ChannelLink> {
    return this.requestJson({
      context,
      expectedStatuses: [202],
      idempotencyKey: context.idempotencyKey,
      method: "DELETE",
      path: `/v1/channel-links/${encodeURIComponent(requireUuid(linkId))}`,
      schema: channelLinkPageSchema.shape.items.element,
    });
  }

  async exportChat(context: AuthContext, chatId: string): Promise<ChatExport> {
    const expectedChatId = requireUuid(chatId);
    const opened = await this.open({
      accept: "application/x-ndjson",
      context,
      expectedStatuses: [200],
      path: `/v1/chats/${encodeURIComponent(expectedChatId)}/export`,
    });
    if (mediaType(opened.response) !== "application/x-ndjson" || !opened.response.body) {
      opened.release();
      throw new AiHttpError("invalid_contract_response", 502);
    }

    const body = opened.response.body;
    const signal = opened.signal;
    const release = opened.release;
    return {
      mediaType: "application/x-ndjson",
      chunks: (async function* () {
        const reader = body.getReader();
        const decoder = new TextDecoder("utf-8");
        const state: ExportValidationState = {
          complete: false,
          messageCount: 0,
          sawChat: false,
        };
        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            if (buffer.length > MAX_JSON_RESPONSE_BYTES) {
              throw new AiHttpError("invalid_contract_response", 502);
            }
            while (true) {
              const newline = buffer.indexOf("\n");
              if (newline === -1) break;
              const line = buffer.slice(0, newline).replace(/\r$/, "");
              buffer = buffer.slice(newline + 1);
              if (!line) continue;
              validateExportLine(line, expectedChatId, state);
              yield `${line}\n`;
            }
          }
          buffer += decoder.decode();
          const tail = buffer.replace(/\r$/, "");
          if (tail) {
            validateExportLine(tail, expectedChatId, state);
            yield tail;
          }
          if (!state.complete) {
            throw new AiHttpError("invalid_contract_response", 502);
          }
        } catch (error) {
          if (signal.aborted) throw abortError();
          throw error;
        } finally {
          reader.releaseLock();
          release();
        }
      })(),
    };
  }

  private lease(sourceSignal?: AbortSignal): RequestLease {
    const controller = new AbortController();
    const abort = () => controller.abort();
    if (sourceSignal?.aborted) controller.abort();
    else sourceSignal?.addEventListener("abort", abort, { once: true });
    this.activeRequests.add(controller);
    let released = false;
    return {
      signal: controller.signal,
      release: () => {
        if (released) return;
        released = true;
        sourceSignal?.removeEventListener("abort", abort);
        this.activeRequests.delete(controller);
      },
    };
  }

  private async open(
    spec: RequestSpec,
    additionalHeaders?: Record<string, string>,
  ): Promise<OpenResponse> {
    const accessToken = requireAccessToken(spec.context);
    const requestId = this.requestIdFactory();
    if (!safeUuid(requestId)) throw new AiClientConfigurationError();
    if (spec.idempotencyKey) requireUuid(spec.idempotencyKey);

    const lease = this.lease(spec.context.signal);
    if (lease.signal.aborted) {
      lease.release();
      throw abortError();
    }
    const headers = new Headers(additionalHeaders);
    headers.set("Accept", spec.accept ?? "application/json");
    headers.set("Authorization", `Bearer ${accessToken}`);
    headers.set("X-Request-ID", requestId);
    if (spec.idempotencyKey) headers.set("Idempotency-Key", spec.idempotencyKey);
    if (spec.body !== undefined) headers.set("Content-Type", "application/json");

    let response: Response;
    try {
      response = await this.fetcher(`${this.baseUrl}${spec.path}`, {
        body: spec.body === undefined ? undefined : JSON.stringify(spec.body),
        credentials: "omit",
        headers,
        method: spec.method ?? "GET",
        redirect: "error",
        signal: lease.signal,
      });
    } catch (error) {
      lease.release();
      if (lease.signal.aborted || (error && typeof error === "object" && "name" in error && error.name === "AbortError")) {
        throw abortError();
      }
      throw new AiHttpError("connection_unavailable", 503);
    }

    if (!spec.expectedStatuses.includes(response.status)) {
      try {
        if (response.status === 401) notifyAuthSessionInvalid();
        const envelope = parseContract(errorEnvelopeSchema, await parseJson(response));
        throw new AiHttpError(
          envelope.error.code,
          response.status,
          envelope.error.correlation_id,
        );
      } catch (error) {
        lease.release();
        if (error instanceof AiHttpError) throw error;
        throw new AiHttpError("invalid_contract_response", 502);
      }
    }
    return { ...lease, response };
  }

  private async requestJson<T>(
    spec: RequestSpec & { schema: z.ZodType<T> },
  ): Promise<T> {
    const opened = await this.open(spec);
    try {
      return parseContract(spec.schema, await parseJson(opened.response));
    } finally {
      opened.release();
    }
  }
}
