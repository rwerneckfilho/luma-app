import { onAuthSessionInvalid } from "../lib/apiClient";
import { contractFixture } from "./__fixtures__/c-ai-public-0.1.0";
import type { AiFetch } from "./httpAiClient";
import {
  AiClientConfigurationError,
  AiHttpError,
  HttpAiPublicClient,
  normalizeAiApiBaseUrl,
} from "./httpAiClient";

const requestId = "00000000-0000-4000-8000-000000000801";
const idempotencyKey = "00000000-0000-4000-8000-000000000802";
const clientMessageId = "00000000-0000-4000-8000-000000000803";
const auth = { accessToken: "synthetic.jwt.token" };
const mutation = { ...auth, idempotencyKey };

function headers(values: Record<string, string>) {
  const normalized = new Map(
    Object.entries(values).map(([key, value]) => [key.toLowerCase(), value]),
  );
  return { get: (name: string) => normalized.get(name.toLowerCase()) ?? null };
}

function byteStream(chunks: string[]) {
  const encoder = new TextEncoder();
  let index = 0;
  return {
    getReader: () => ({
      read: async () =>
        index < chunks.length
          ? { done: false as const, value: encoder.encode(chunks[index++]) }
          : { done: true as const, value: undefined },
      releaseLock: () => undefined,
    }),
  } as unknown as ReadableStream<Uint8Array>;
}

function jsonResponse(payload: unknown, status = 200): Response {
  const text = JSON.stringify(payload);
  return {
    body: byteStream([text]),
    headers: headers({
      "content-length": String(text.length),
      "content-type": "application/json; charset=utf-8",
    }),
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
  } as unknown as Response;
}

function streamResponse(
  chunks: string[],
  contentType = "text/event-stream; charset=utf-8",
): Response {
  return {
    body: byteStream(chunks),
    headers: headers({ "content-type": contentType }),
    ok: true,
    status: 200,
    text: async () => chunks.join(""),
  } as unknown as Response;
}

function queuedFetch(responses: Response[]) {
  const fetcher: jest.MockedFunction<AiFetch> = jest.fn(
    async (_input: string | URL, _init?: RequestInit) => {
      const response = responses.shift();
      if (!response) throw new Error("missing_test_response");
      return response;
    },
  );
  return fetcher;
}

function client(fetcher: AiFetch) {
  return new HttpAiPublicClient({
    allowInsecureLoopback: true,
    baseUrl: "http://localhost:8081",
    fetch: fetcher,
    requestIdFactory: () => requestId,
  });
}

function sse(event: (typeof contractFixture.events)[number]) {
  return `id: ${event.sequence}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

async function collect<T>(iterable: AsyncIterable<T>) {
  const values: T[] = [];
  for await (const value of iterable) values.push(value);
  return values;
}

describe("HttpAiPublicClient C-AI-PUBLIC 0.1.0 adapter", () => {
  it("sends the bearer and opaque request headers while validating the chat fixture", async () => {
    const fetcher = queuedFetch([jsonResponse(contractFixture.chat, 201)]);

    await expect(
      client(fetcher).createChat(mutation, {
        patient_selection_ref: "self",
        title: "Conversa sintética",
      }),
    ).resolves.toEqual(contractFixture.chat);

    const [url, init] = fetcher.mock.calls[0];
    const requestHeaders = new Headers(init?.headers);
    expect(url).toBe("http://localhost:8081/v1/chats");
    expect(init).toMatchObject({
      credentials: "omit",
      method: "POST",
      redirect: "error",
    });
    expect(requestHeaders.get("Authorization")).toBe(`Bearer ${auth.accessToken}`);
    expect(requestHeaders.get("Idempotency-Key")).toBe(idempotencyKey);
    expect(requestHeaders.get("X-Request-ID")).toBe(requestId);
    expect(JSON.parse(String(init?.body))).toEqual({
      patient_selection_ref: "self",
      title: "Conversa sintética",
    });
  });

  it("covers message acceptance, run and channel-link contract fixtures", async () => {
    const accepted = {
      message: contractFixture.message,
      run: contractFixture.run,
    };
    const fetcher = queuedFetch([
      jsonResponse(accepted, 202),
      jsonResponse(contractFixture.run),
      jsonResponse(contractFixture.challenge, 201),
      jsonResponse({ items: [contractFixture.link] }),
      jsonResponse(contractFixture.link, 202),
      jsonResponse(contractFixture.action, 202),
    ]);
    const adapter = client(fetcher);

    await expect(
      adapter.createMessage(auth, contractFixture.chat.id, {
        client_message_id: clientMessageId,
        content: "Conteúdo sintético",
      }),
    ).resolves.toEqual(accepted);
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toMatchObject({
      channel: "app",
      client_message_id: clientMessageId,
    });
    await expect(adapter.getRun(auth, contractFixture.run.id)).resolves.toEqual(
      contractFixture.run,
    );
    await expect(
      adapter.createWhatsAppLinkChallenge(mutation, { locale: "pt-BR" }),
    ).resolves.toEqual(contractFixture.challenge);
    await expect(adapter.listChannelLinks(auth)).resolves.toEqual({
      items: [contractFixture.link],
    });
    await expect(
      adapter.revokeChannelLink(mutation, contractFixture.link.id),
    ).resolves.toEqual(contractFixture.link);
    await expect(
      adapter.decideAction(
        mutation,
        contractFixture.chat.id,
        contractFixture.action.id,
        "confirm",
        {
          confirmation_ref: contractFixture.action.confirmation_ref,
          presented_preview_hash: contractFixture.action.presented_preview_hash,
        },
      ),
    ).resolves.toEqual(contractFixture.action);
  });

  it("resumes fragmented SSE with Last-Event-ID and drops duplicate sequences", async () => {
    const second = sse(contractFixture.events[1]);
    const body = `: heartbeat\n\n${second}${second}${sse(contractFixture.events[2])}`;
    const fetcher = queuedFetch([
      streamResponse([body.slice(0, 17), body.slice(17, 91), body.slice(91)]),
    ]);

    const events = await collect(
      client(fetcher).streamRunEvents(auth, contractFixture.run.id, 1),
    );

    expect(events.map((event) => event.sequence)).toEqual([2, 3]);
    expect(new Headers(fetcher.mock.calls[0][1]?.headers).get("Last-Event-ID")).toBe(
      "1",
    );
  });

  it("fails closed when an SSE frame id or event name disagrees with its payload", async () => {
    const event = contractFixture.events[1];
    const fetcher = queuedFetch([
      streamResponse([
        `id: 99\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
      ]),
    ]);

    await expect(
      collect(client(fetcher).streamRunEvents(auth, contractFixture.run.id)),
    ).rejects.toMatchObject({
      code: "invalid_contract_response",
      status: 502,
    });
  });

  it("rejects a truncated SSE event without its blank-line delimiter", async () => {
    const event = contractFixture.events[1];
    const fetcher = queuedFetch([
      streamResponse([
        `id: ${event.sequence}\nevent: ${event.type}\ndata: ${JSON.stringify(event)}\n`,
      ]),
    ]);

    await expect(
      collect(client(fetcher).streamRunEvents(auth, contractFixture.run.id)),
    ).rejects.toMatchObject({
      code: "invalid_contract_response",
      status: 502,
    });
  });

  it("maps an authenticated 401 to safe session invalidation without retaining server text", async () => {
    const invalidated = jest.fn();
    const removeListener = onAuthSessionInvalid(invalidated);
    const fetcher = queuedFetch([
      jsonResponse(
        {
          error: {
            code: "unauthenticated",
            message: "Sensitive synthetic diagnostic must not escape",
            correlation_id: "00000000-0000-4000-8000-000000000901",
            details: null,
          },
        },
        401,
      ),
    ]);

    const request = client(fetcher).getChat(auth, contractFixture.chat.id);
    await expect(request).rejects.toMatchObject({
      code: "unauthenticated",
      message: "unauthenticated",
      status: 401,
    });
    expect(invalidated).toHaveBeenCalledTimes(1);
    await expect(request.catch((error: unknown) => String(error))).resolves.not.toContain(
      "Sensitive synthetic diagnostic",
    );
    removeListener();
  });

  it("preserves safe 410, idempotency-conflict and action-expiry codes", async () => {
    const errorResponse = (code: string, status: number) =>
      jsonResponse(
        {
          error: {
            code,
            message: "Synthetic server explanation",
            correlation_id: requestId,
          },
        },
        status,
      );
    const fetcher = queuedFetch([
      errorResponse("access_changed", 410),
      errorResponse("idempotency_conflict", 409),
      errorResponse("action_expired", 409),
    ]);
    const adapter = client(fetcher);

    await expect(adapter.getChat(auth, contractFixture.chat.id)).rejects.toMatchObject({
      code: "access_changed",
      status: 410,
    });
    await expect(
      adapter.createChat(mutation, { patient_selection_ref: "self" }),
    ).rejects.toMatchObject({ code: "idempotency_conflict", status: 409 });
    await expect(
      adapter.decideAction(
        mutation,
        contractFixture.chat.id,
        contractFixture.action.id,
        "confirm",
        {
          confirmation_ref: contractFixture.action.confirmation_ref,
          presented_preview_hash: contractFixture.action.presented_preview_hash,
        },
      ),
    ).rejects.toMatchObject({ code: "action_expired", status: 409 });
  });

  it("aborts every live transport request on logout cancellation", async () => {
    const fetcher: AiFetch = async (_url, init) =>
      new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener(
          "abort",
          () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })),
          { once: true },
        );
      });
    const adapter = client(fetcher);
    const pending = adapter.getChat(auth, contractFixture.chat.id);
    await Promise.resolve();

    adapter.cancelAll();

    await expect(pending).rejects.toMatchObject({
      code: "request_cancelled",
      name: "AbortError",
      status: 499,
    });
  });

  it("streams authenticated NDJSON without buffering the export", async () => {
    const chatLine = `${JSON.stringify({ type: "chat", chat: contractFixture.chat })}\n`;
    const messageLine = `${JSON.stringify({
      type: "message",
      message: contractFixture.message,
    })}\n`;
    const completeLine = `${JSON.stringify({
      type: "complete",
      message_count: 1,
      content_sha256: "0".repeat(64),
    })}\n`;
    const fetcher = queuedFetch([
      streamResponse(
        [chatLine.slice(0, 31), `${chatLine.slice(31)}${messageLine}`, completeLine],
        "application/x-ndjson",
      ),
    ]);
    const exported = await client(fetcher).exportChat(auth, contractFixture.chat.id);

    await expect(collect(exported.chunks)).resolves.toEqual([
      chatLine,
      messageLine,
      completeLine,
    ]);
    expect(exported.mediaType).toBe("application/x-ndjson");
    expect(new Headers(fetcher.mock.calls[0][1]?.headers).get("Authorization")).toBe(
      `Bearer ${auth.accessToken}`,
    );
  });

  it("rejects a truncated NDJSON export without its completion record", async () => {
    const chatLine = `${JSON.stringify({ type: "chat", chat: contractFixture.chat })}\n`;
    const fetcher = queuedFetch([
      streamResponse([chatLine], "application/x-ndjson"),
    ]);
    const exported = await client(fetcher).exportChat(auth, contractFixture.chat.id);

    await expect(collect(exported.chunks)).rejects.toMatchObject({
      code: "invalid_contract_response",
      status: 502,
    });
  });
});

describe("AI backend configuration", () => {
  it("requires TLS except for explicit emulator/loopback development origins", () => {
    expect(normalizeAiApiBaseUrl("https://ai.luma.example/")).toBe(
      "https://ai.luma.example",
    );
    expect(normalizeAiApiBaseUrl("http://10.0.2.2:8081/", true)).toBe(
      "http://10.0.2.2:8081",
    );
    expect(() => normalizeAiApiBaseUrl("http://ai.luma.example")).toThrow(
      AiClientConfigurationError,
    );
    expect(() =>
      normalizeAiApiBaseUrl("https://user:secret@ai.luma.example"),
    ).toThrow(AiClientConfigurationError);
  });

  it("rejects arbitrary text as an idempotency key before network I/O", async () => {
    const fetcher = queuedFetch([]);

    await expect(
      client(fetcher).createChat(
        { ...auth, idempotencyKey: "my medication details" },
        { patient_selection_ref: "self" },
      ),
    ).rejects.toBeInstanceOf(AiClientConfigurationError);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("uses safe error identities for transport failures", () => {
    expect(new AiHttpError("connection_unavailable", 503)).toMatchObject({
      message: "connection_unavailable",
      status: 503,
    });
  });
});
