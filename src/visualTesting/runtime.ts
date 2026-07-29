import type { VisualScenario } from "./types";
import { getVisualScenario } from "./fixtures";

let activeScenario: VisualScenario | null = null;
const listeners = new Set<(scenario: VisualScenario | null) => void>();

export function activateVisualScenario(name: string) {
  if (!__DEV__) return null;
  activeScenario = getVisualScenario(name);
  listeners.forEach((listener) => listener(activeScenario));
  return activeScenario;
}

export function getActiveVisualScenario() {
  return activeScenario;
}

export function subscribeVisualScenario(listener: (scenario: VisualScenario | null) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
