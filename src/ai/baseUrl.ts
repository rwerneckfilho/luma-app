export class AiClientConfigurationError extends Error {
  readonly code = "invalid_ai_client_configuration";
  readonly status = 503;

  constructor() {
    super("invalid_ai_client_configuration");
    this.name = "AiClientConfigurationError";
  }
}

function isLoopbackHostname(hostname: string) {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    normalized === "127.0.0.1" ||
    normalized === "[::1]" ||
    normalized === "10.0.2.2"
  );
}

export function normalizeAiApiBaseUrl(
  rawBaseUrl: string,
  allowInsecureLoopback = false,
) {
  const candidate = rawBaseUrl.trim();
  if (!candidate) throw new AiClientConfigurationError();

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new AiClientConfigurationError();
  }

  const secure = url.protocol === "https:";
  const allowedDevelopmentHttp =
    allowInsecureLoopback &&
    url.protocol === "http:" &&
    isLoopbackHostname(url.hostname);
  if (
    (!secure && !allowedDevelopmentHttp) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new AiClientConfigurationError();
  }

  url.pathname = url.pathname.replace(/\/+$/, "");
  return url.toString().replace(/\/+$/, "");
}

export function isValidAiApiBaseUrl(
  rawBaseUrl: string,
  allowInsecureLoopback = false,
) {
  try {
    normalizeAiApiBaseUrl(rawBaseUrl, allowInsecureLoopback);
    return true;
  } catch {
    return false;
  }
}
