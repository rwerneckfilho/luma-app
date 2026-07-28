import { env } from "../config/env";

export type ApiErrorDetail = string | Record<string, unknown>[] | Record<string, unknown>;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly detail?: ApiErrorDetail,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiRequestOptions = Omit<RequestInit, "body" | "headers"> & {
  accessToken?: string | null;
  body?: unknown;
  headers?: HeadersInit;
};

const authInvalidListeners = new Set<() => void>();

export function onAuthSessionInvalid(listener: () => void) {
  authInvalidListeners.add(listener);
  return () => authInvalidListeners.delete(listener);
}

export function notifyAuthSessionInvalid() {
  authInvalidListeners.forEach((listener) => listener());
}

export function requireAccessToken(accessToken: string | null | undefined) {
  if (!accessToken) throw new ApiError("Sessão expirada.", 401);
  return accessToken;
}

export function resolveApiUrl(path: string) {
  if (/^https?:\/\//.test(path)) return path;
  if (!env.apiBaseUrl) throw new ApiError("API não configurada.", 0);
  return `${env.apiBaseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function parseBody(text: string): unknown {
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { accessToken, body, headers: customHeaders, ...requestOptions } = options;
  const headers = new Headers(customHeaders);
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  if (!isFormData && body !== undefined) headers.set("Content-Type", "application/json");
  if (accessToken) headers.set("Authorization", `Bearer ${accessToken}`);

  let response: Response;
  try {
    response = await fetch(resolveApiUrl(path), {
      ...requestOptions,
      body: body === undefined ? undefined : isFormData ? (body as FormData) : JSON.stringify(body),
      headers,
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError("Não foi possível conectar ao servidor.", 0);
  }

  const data = parseBody(await response.text());
  if (!response.ok) {
    const detail = data && typeof data === "object" && "detail" in data
      ? (data as { detail?: ApiErrorDetail }).detail
      : (data as ApiErrorDetail | undefined);
    // Public one-time push-action tokens can legitimately expire with 401. Only an
    // authenticated request proves that the current Supabase session is invalid.
    if (response.status === 401 && accessToken) {
      notifyAuthSessionInvalid();
    }
    const message = typeof detail === "string" && detail.trim()
      ? detail
      : response.status === 401
        ? "Sua sessão expirou. Entre novamente."
        : `A solicitação falhou (${response.status}).`;
    throw new ApiError(message, response.status, detail);
  }
  return data as T;
}
