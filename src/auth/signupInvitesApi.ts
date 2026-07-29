import { apiRequest } from "../lib/apiClient";

export function validateSignupInvite(code: string) {
  return apiRequest<{ valid: boolean }>("/v1/signup-invites/validate", {
    body: { code },
    method: "POST",
  });
}
