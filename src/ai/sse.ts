const MAX_SSE_LINE_LENGTH = 256 * 1024;
const MAX_SSE_EVENT_LENGTH = 512 * 1024;

export type SseFrame = {
  data: string;
  event: string;
  id?: string;
};

export class SseProtocolError extends Error {
  readonly code = "invalid_sse_stream";

  constructor() {
    super("invalid_sse_stream");
    this.name = "SseProtocolError";
  }
}

type PendingFrame = {
  data: string[];
  event: string;
  id?: string;
  size: number;
};

function emptyFrame(): PendingFrame {
  return { data: [], event: "message", size: 0 };
}

function consumeLine(frame: PendingFrame, line: string): SseFrame | null {
  if (line.length > MAX_SSE_LINE_LENGTH) throw new SseProtocolError();
  if (line === "") {
    if (frame.data.length === 0) return null;
    return {
      data: frame.data.join("\n"),
      event: frame.event,
      ...(frame.id === undefined ? {} : { id: frame.id }),
    };
  }
  if (line.startsWith(":")) return null;

  const separator = line.indexOf(":");
  const field = separator === -1 ? line : line.slice(0, separator);
  const rawValue = separator === -1 ? "" : line.slice(separator + 1);
  const value = rawValue.startsWith(" ") ? rawValue.slice(1) : rawValue;
  frame.size += line.length;
  if (frame.size > MAX_SSE_EVENT_LENGTH) throw new SseProtocolError();

  if (field === "data") frame.data.push(value);
  else if (field === "event") frame.event = value || "message";
  else if (field === "id" && !value.includes("\0")) frame.id = value;
  return null;
}

export async function* decodeSse(
  body: ReadableStream<Uint8Array>,
): AsyncIterable<SseFrame> {
  const decoder = new TextDecoder("utf-8");
  const reader = body.getReader();
  let buffer = "";
  let frame = emptyFrame();

  const drainLines = function* (final: boolean): Iterable<SseFrame> {
    while (true) {
      const newline = buffer.indexOf("\n");
      if (newline === -1) break;
      let line = buffer.slice(0, newline);
      buffer = buffer.slice(newline + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      const complete = consumeLine(frame, line);
      if (complete) {
        yield complete;
        frame = emptyFrame();
      } else if (line === "") {
        frame = emptyFrame();
      }
    }

    if (final && buffer) {
      const complete = consumeLine(frame, buffer.endsWith("\r") ? buffer.slice(0, -1) : buffer);
      buffer = "";
      if (complete) yield complete;
    }
  };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      if (buffer.length > MAX_SSE_EVENT_LENGTH) throw new SseProtocolError();
      yield* drainLines(false);
    }
    buffer += decoder.decode();
    yield* drainLines(true);
    if (frame.data.length > 0) throw new SseProtocolError();
  } finally {
    reader.releaseLock();
  }
}
