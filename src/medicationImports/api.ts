import { apiRequest, requireAccessToken } from "../lib/apiClient";
import type { MedicationImportDraft } from "./types";

export type NativeUploadFile = {
  name: string;
  type: string;
  uri: string;
};

export function parseMedicationText(
  accessToken: string | null | undefined,
  text: string,
) {
  return apiRequest<MedicationImportDraft>("/v1/medication-imports/parse-text", {
    accessToken: requireAccessToken(accessToken),
    body: { text },
    method: "POST",
  });
}

export function parseMedicationFile(
  accessToken: string | null | undefined,
  file: NativeUploadFile,
) {
  const body = new FormData();
  // React Native accepts a URI-backed file part even though the DOM typings do not expose it.
  body.append("file", file as unknown as Blob);
  return apiRequest<MedicationImportDraft>("/v1/medication-imports/parse-file", {
    accessToken: requireAccessToken(accessToken),
    body,
    method: "POST",
  });
}
