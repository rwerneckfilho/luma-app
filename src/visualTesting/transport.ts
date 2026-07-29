import type { ApiRequestOptionsForVisualTesting } from "../lib/apiClient";
import { getActiveVisualScenario } from "./runtime";

function pathname(path: string) {
  return path.split("?")[0];
}

export function resolveVisualApiRequest(path: string, options: ApiRequestOptionsForVisualTesting) {
  const scenario = getActiveVisualScenario();
  if (!scenario) return undefined;
  const fixture = scenario.fixture;
  const route = pathname(path);
  const method = options.method ?? "GET";

  if (route === "/v1/me/profile") return fixture.profile;
  if (route === "/v1/me/notification-preferences") return fixture.notificationPreferences;
  if (route === "/v1/me/daily-medications") return fixture.dashboard;
  if (route === "/v1/medications" && method === "GET") return { items: fixture.medications };
  if (route === "/v1/routines" && method === "GET") return { items: fixture.routines };
  if (route === "/v1/as-needed-usage-logs" && method === "GET") return fixture.asNeededUsageLogs;
  if (route === "/v1/me/adherence-history/filters") {
    return {
      doctors: ["Dra. Ana Lima", "Dr. Caio Alves"],
      medications: fixture.medications.map(({ id, name }) => ({ id, name })),
      statuses: ["scheduled", "upcoming", "due", "overdue", "taken", "skipped"],
    };
  }
  if (route === "/v1/me/adherence-history") return fixture.history;
  if (route === "/v1/care/relationships" && method === "GET") return fixture.care;
  if (route === "/v1/care/invitations" && method === "GET") return { invitations: [] };
  if (/\/v1\/care\/relationships\/[^/]+\/timeline\/filters$/.test(route)) {
    return {
      doctors: ["Dra. Ana Lima", "Dr. Caio Alves"],
      medications: fixture.medications.map(({ id, name }) => ({ id, name })),
      statuses: ["scheduled", "upcoming", "due", "overdue", "taken", "skipped"],
    };
  }
  if (/\/v1\/care\/relationships\/[^/]+\/timeline$/.test(route)) {
    return {
      ...fixture.history,
      as_needed_usage_logs: fixture.asNeededUsageLogs,
      patient_display_name: fixture.profile?.full_name ?? "Paciente",
    };
  }
  if (/\/v1\/care\/relationships\/[^/]+\/routines$/.test(route)) {
    return { medications: fixture.medications, routines: fixture.routines };
  }
  if (route.endsWith("/preview")) return { requires_confirmation: false, warnings: [] };
  if (method !== "GET") return options.body ?? {};
  throw new Error(`Visual fixture missing for ${method} ${route}`);
}
