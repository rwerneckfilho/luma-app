export type SupabaseAuthCallback = {
  code?: string;
  tokenHash?: string;
  type?: string;
};

function appendParams(target: URLSearchParams, raw: string) {
  const params = new URLSearchParams(raw.replace(/^[?#]/, ""));
  params.forEach((value, key) => {
    if (!target.has(key)) target.set(key, value);
  });
}

/** Parse only PKCE and recovery token-hash callbacks without logging secrets. */
export function parseSupabaseAuthCallback(url: string): SupabaseAuthCallback {
  const parsed = new URL(url);
  const params = new URLSearchParams(parsed.search);
  appendParams(params, parsed.hash);

  return {
    code: params.get("code") ?? undefined,
    tokenHash: params.get("token_hash") ?? undefined,
    type: params.get("type") ?? undefined,
  };
}

export function isPasswordRecoveryCallback(callback: SupabaseAuthCallback) {
  return callback.type === "recovery" || callback.type === "password_recovery";
}

function normalizedPathname(url: URL) {
  return url.pathname.replace(/\/+$/, "") || "/";
}

/**
 * PKCE recovery redirects may contain only `code`, so trust the exact configured
 * redirect route rather than accepting any URL with a familiar pathname.
 */
export function isTrustedPasswordRecoveryUrl(url: string, configuredRedirectUrl: string) {
  try {
    const incoming = new URL(url);
    const configured = new URL(configuredRedirectUrl);
    if (configured.protocol !== "luma:" && configured.protocol !== "https:") return false;
    if (incoming.protocol !== configured.protocol) return false;
    if (incoming.username || incoming.password || configured.username || configured.password) {
      return false;
    }

    return (
      incoming.hostname.toLowerCase() === configured.hostname.toLowerCase() &&
      incoming.port === configured.port &&
      normalizedPathname(incoming) === normalizedPathname(configured)
    );
  } catch {
    return false;
  }
}

/** Only accept internal app routes from remote notification payloads. */
export function normalizeInternalRoute(value: unknown, fallback = "/") {
  if (typeof value !== "string" || !value.trim()) return fallback;
  const route = value.trim();

  if (route.startsWith("/") && !route.startsWith("//")) {
    return route;
  }

  try {
    const parsed = new URL(route);
    if (parsed.protocol === "luma:") {
      const host = parsed.hostname ? `/${parsed.hostname}` : "";
      return `${host}${parsed.pathname}${parsed.search}` || fallback;
    }
  } catch {
    return fallback;
  }

  return fallback;
}
