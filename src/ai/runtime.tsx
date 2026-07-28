import type { PropsWithChildren } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
} from "react";
import { useAuth } from "../auth/useAuth";
import { env } from "../config/env";
import type { AiPublicClient, AuthContext, MutationContext } from "./contracts";
import { FakeAiClient } from "./fakeAiClient";
import { HttpAiPublicClient } from "./httpAiClient";

export type AiClientMode = "disabled" | "fake" | "public";

export type AiClientAdapter = {
  client: AiPublicClient;
  mode: Exclude<AiClientMode, "disabled">;
  resolveAccessToken: (sessionAccessToken: string, userId: string) => string;
  cancelAll?: () => void;
};

type AiRuntimeValue = {
  authContext: (signal?: AbortSignal) => AuthContext;
  cacheScope: string;
  client: AiPublicClient | null;
  isReady: boolean;
  mode: AiClientMode;
  mutationContext: (
    idempotencyKey: string,
    signal?: AbortSignal,
  ) => MutationContext;
};

export class AiClientUnavailableError extends Error {
  readonly code = "ai_client_unavailable";
  readonly status = 503;

  constructor() {
    super("ai_client_unavailable");
    this.name = "AiClientUnavailableError";
  }
}

const AiRuntimeContext = createContext<AiRuntimeValue | null>(null);

function developmentAdapter(): AiClientAdapter | null {
  if (!__DEV__ && process.env.NODE_ENV !== "test") return null;
  return {
    client: new FakeAiClient(),
    mode: "fake",
    resolveAccessToken: (_sessionAccessToken, userId) => `fake-user-${userId}`,
  };
}

function configuredAdapter(): AiClientAdapter | null {
  if (!env.aiApiBaseUrl) return developmentAdapter();
  try {
    const client = new HttpAiPublicClient({
      allowInsecureLoopback: __DEV__ || process.env.NODE_ENV === "test",
      baseUrl: env.aiApiBaseUrl,
    });
    return {
      cancelAll: () => client.cancelAll(),
      client,
      mode: "public",
      resolveAccessToken: (sessionAccessToken) => sessionAccessToken,
    };
  } catch {
    return null;
  }
}

export function AiClientProvider({
  adapter,
  children,
}: PropsWithChildren<{ adapter?: AiClientAdapter | null }>) {
  const { accessToken, registerBeforeSignOutCleanup, user } = useAuth();
  const userId = user?.id;
  const selectedAdapter = useMemo(
    () => (adapter === undefined ? configuredAdapter() : adapter),
    [adapter],
  );
  const isReady = Boolean(selectedAdapter && accessToken && userId);

  const authContext = useCallback(
    (signal?: AbortSignal): AuthContext => {
      if (!selectedAdapter || !accessToken || !userId)
        throw new AiClientUnavailableError();
      return {
        accessToken: selectedAdapter.resolveAccessToken(accessToken, userId),
        ...(signal ? { signal } : {}),
      };
    },
    [accessToken, selectedAdapter, userId],
  );

  const mutationContext = useCallback(
    (idempotencyKey: string, signal?: AbortSignal): MutationContext => ({
      ...authContext(signal),
      idempotencyKey,
    }),
    [authContext],
  );

  useEffect(
    () =>
      registerBeforeSignOutCleanup(async () => {
        selectedAdapter?.cancelAll?.();
      }),
    [registerBeforeSignOutCleanup, selectedAdapter],
  );

  useEffect(
    () => () => {
      selectedAdapter?.cancelAll?.();
    },
    [accessToken, selectedAdapter, userId],
  );

  const value = useMemo<AiRuntimeValue>(
    () => ({
      authContext,
      cacheScope: userId ?? "anonymous",
      client: selectedAdapter?.client ?? null,
      isReady,
      mode: selectedAdapter?.mode ?? "disabled",
      mutationContext,
    }),
    [authContext, isReady, mutationContext, selectedAdapter, userId],
  );

  return (
    <AiRuntimeContext.Provider value={value}>
      {children}
    </AiRuntimeContext.Provider>
  );
}

export function useAiRuntime() {
  const context = useContext(AiRuntimeContext);
  if (!context)
    throw new Error("useAiRuntime must be used inside AiClientProvider");
  return context;
}
