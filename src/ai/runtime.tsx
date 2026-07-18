import type { PropsWithChildren } from "react";
import { createContext, useCallback, useContext, useMemo } from "react";
import { useAuth } from "../auth/useAuth";
import type { AiPublicClient, AuthContext, MutationContext } from "./contracts";
import { FakeAiClient } from "./fakeAiClient";

export type AiClientMode = "disabled" | "fake" | "public";

export type AiClientAdapter = {
  client: AiPublicClient;
  mode: Exclude<AiClientMode, "disabled">;
  resolveAccessToken: (sessionAccessToken: string, userId: string) => string;
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

export function AiClientProvider({
  adapter,
  children,
}: PropsWithChildren<{ adapter?: AiClientAdapter | null }>) {
  const { accessToken, user } = useAuth();
  const userId = user?.id;
  const selectedAdapter = useMemo(
    () => (adapter === undefined ? developmentAdapter() : adapter),
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
