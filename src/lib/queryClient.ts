import { AppState } from "react-native";
import { focusManager, QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    mutations: { retry: false },
    queries: {
      retry: (count, error) =>
        !(error && typeof error === "object" && "status" in error && error.status === 401) &&
        count < 1,
      staleTime: 30_000,
    },
  },
});

let appStateConfigured = false;
export function configureQueryAppState() {
  if (appStateConfigured) return () => undefined;
  appStateConfigured = true;
  const subscription = AppState.addEventListener("change", (state) => {
    focusManager.setFocused(state === "active");
  });
  return () => {
    appStateConfigured = false;
    subscription.remove();
  };
}
