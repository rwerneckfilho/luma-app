import AsyncStorage from "@react-native-async-storage/async-storage";
import { useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import * as SecureStore from "expo-secure-store";
import {
  type PropsWithChildren,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Linking, Platform } from "react-native";
import { env } from "../config/env";
import {
  isPasswordRecoveryCallback,
  isTrustedPasswordRecoveryUrl,
  parseSupabaseAuthCallback,
} from "../lib/deepLinks";
import { onAuthSessionInvalid } from "../lib/apiClient";
import { configureSupabaseAppState, supabase } from "../lib/supabase";
import { AuthContext, type AuthContextValue, type SignUpInput } from "./authContext";

const RECOVERY_STORAGE_KEY = "luma.auth.passwordRecovery";

async function readRecoveryState() {
  const value =
    Platform.OS === "web"
      ? await AsyncStorage.getItem(RECOVERY_STORAGE_KEY)
      : await SecureStore.getItemAsync(RECOVERY_STORAGE_KEY);
  return value === "true";
}

async function writeRecoveryState(active: boolean) {
  if (Platform.OS === "web") {
    if (active) await AsyncStorage.setItem(RECOVERY_STORAGE_KEY, "true");
    else await AsyncStorage.removeItem(RECOVERY_STORAGE_KEY);
    return;
  }

  if (active) {
    await SecureStore.setItemAsync(RECOVERY_STORAGE_KEY, "true", {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  } else {
    await SecureStore.deleteItemAsync(RECOVERY_STORAGE_KEY);
  }
}

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const previousUserId = useRef<string | null>(null);
  const beforeSignOutCleanups = useRef(new Set<() => Promise<void>>());

  const applySession = useCallback(
    (nextSession: Session | null) => {
      const nextUserId = nextSession?.user.id ?? null;
      if (previousUserId.current && previousUserId.current !== nextUserId) {
        queryClient.clear();
      }
      previousUserId.current = nextUserId;
      setSession(nextSession);
    },
    [queryClient],
  );

  const setRecoveryState = useCallback(async (active: boolean) => {
    setIsPasswordRecovery(active);
    await writeRecoveryState(active);
  }, []);

  const consumeAuthCallback = useCallback(
    async (url: string) => {
      let callback;
      try {
        callback = parseSupabaseAuthCallback(url);
      } catch {
        return false;
      }

      const isTrustedRecoveryRoute = isTrustedPasswordRecoveryUrl(
        url,
        env.authRedirectUrl,
      );
      const hasRecoveryCredential = Boolean(callback.code || callback.tokenHash);
      const hasUnexpectedType = Boolean(
        callback.type && !isPasswordRecoveryCallback(callback),
      );
      if (!isTrustedRecoveryRoute || !hasRecoveryCredential || hasUnexpectedType) {
        return false;
      }

      setRecoveryError(null);
      try {
        if (callback.code) {
          const { error } = await supabase.auth.exchangeCodeForSession(callback.code);
          if (error) throw error;
        } else if (callback.tokenHash) {
          const { error } = await supabase.auth.verifyOtp({
            token_hash: callback.tokenHash,
            type: "recovery",
          });
          if (error) throw error;
        }

        await setRecoveryState(true);
        return true;
      } catch (error) {
        setRecoveryError(
          error instanceof Error ? error.message : "Não foi possível validar o link.",
        );
        await setRecoveryState(false);
        return true;
      }
    },
    [setRecoveryState],
  );

  useEffect(() => {
    let mounted = true;
    const removeAppStateListener = configureSupabaseAppState();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      if (!mounted) return;
      applySession(nextSession);
      if (event === "PASSWORD_RECOVERY" && nextSession) {
        void setRecoveryState(true);
      } else if (event === "SIGNED_OUT" || !nextSession) {
        void setRecoveryState(false);
      }
      setIsLoading(false);
    });

    const bootstrap = async () => {
      const storedRecovery = await readRecoveryState();
      if (mounted) setIsPasswordRecovery(storedRecovery);

      const initialUrl = await Linking.getInitialURL();
      if (initialUrl) await consumeAuthCallback(initialUrl);

      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;

      if (data.session) {
        const { data: userData, error: userError } = await supabase.auth.getUser(
          data.session.access_token,
        );
        if (userError || !userData.user) {
          await supabase.auth.signOut({ scope: "local" });
          if (mounted) applySession(null);
        } else if (mounted) {
          applySession(data.session);
        }
      } else if (mounted) {
        applySession(null);
      }
    };

    void bootstrap()
      .catch(() => {
        if (mounted) applySession(null);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });

    const linkSubscription = Linking.addEventListener("url", ({ url }) => {
      void consumeAuthCallback(url);
    });
    const removeInvalidSessionListener = onAuthSessionInvalid(() => {
      applySession(null);
      void setRecoveryState(false);
      void supabase.auth.signOut({ scope: "local" });
    });

    return () => {
      mounted = false;
      linkSubscription.remove();
      removeInvalidSessionListener();
      removeAppStateListener();
      subscription.unsubscribe();
    };
  }, [applySession, consumeAuthCallback, setRecoveryState]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      await setRecoveryState(false);
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
    },
    [setRecoveryState],
  );

  const signUp = useCallback(async (input: SignUpInput) => {
    const phone = input.phone_e164.replace(/\D/g, "");
    const { error } = await supabase.auth.signUp({
      email: input.email.trim(),
      password: input.password,
      options: {
        data: {
          full_name: input.full_name.trim(),
          phone,
          phone_e164: phone,
        },
      },
    });
    if (error) throw error;
  }, []);

  const registerBeforeSignOutCleanup = useCallback((cleanup: () => Promise<void>) => {
    beforeSignOutCleanups.current.add(cleanup);
    return () => beforeSignOutCleanups.current.delete(cleanup);
  }, []);

  const signOut = useCallback(async () => {
    await Promise.all([...beforeSignOutCleanups.current].map((cleanup) => cleanup()));
    const { error } = await supabase.auth.signOut({ scope: "local" });
    if (error) throw error;
    applySession(null);
    await setRecoveryState(false);
  }, [applySession, setRecoveryState]);

  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: env.authRedirectUrl,
    });
    if (error) throw error;
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
  }, []);

  const clearPasswordRecovery = useCallback(
    () => setRecoveryState(false),
    [setRecoveryState],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      accessToken: session?.access_token ?? null,
      clearPasswordRecovery,
      isLoading,
      isPasswordRecovery,
      recoveryError,
      registerBeforeSignOutCleanup,
      resetPassword,
      session,
      signIn,
      signOut,
      signUp,
      updatePassword,
      user: session?.user ?? null,
    }),
    [
      clearPasswordRecovery,
      isLoading,
      isPasswordRecovery,
      recoveryError,
      registerBeforeSignOutCleanup,
      resetPassword,
      session,
      signIn,
      signOut,
      signUp,
      updatePassword,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
